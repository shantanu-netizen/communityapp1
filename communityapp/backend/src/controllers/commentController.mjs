import mongoose from 'mongoose'
import commentModel from '../models/commentModel.mjs'
import postModel from '../models/postModel.mjs'
import { validateCommentPayload, validateObjectId } from '../utils/validate.mjs'
/** This function updates the comment count on a post.

const bumpPostCommentCount = async (postId, delta) => { ... }

postId is the ID of the post whose comment count should change.
delta is the amount to change by: +1 for adding a comment, -1 for removing one.
 */
const bumpPostCommentCount = async (postId, delta) => {
    await postModel.updateOne({ _id: postId, status: 'active' }, { $inc: { commentsCount: delta } })
}
/** All active descendant comment ids under this root (BFS), including root. */
const collectCommentTreeIds = async (rootId, postId) => {
  const oid = new mongoose.Types.ObjectId(rootId);
  const ids = [oid]; //starts the result list with the root comment itself.
  let frontier = [oid]; //The current layer of comments whose children should be searched next
  while (frontier.length) {
    //repeats until there are no more comments to explore.
    const children = await commentModel
      .find({
        postId,
        parentCommentId: { $in: frontier },
        status: "active",
      })
      .select("_id")
      .lean();
    const next = children.map((c) => c._id);
    ids.push(...next);
    frontier = next;
  }
  return ids;
}

/**
 * GET /posts/:postId/comments
 * Query: page, limit, parentId (optional — omit or null = top-level only; set = replies to that comment)
 */
const getCommentsByPost = async (req, res) => {
    try {
      const { postId } = req.params;
      const parentId = req.query.parentId;
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(
        50,
        Math.max(1, parseInt(req.query.limit, 10) || 20),
      );
      const skip = (page - 1) * limit; //Calculates how many records to skip for the current page

      if (!validateObjectId(postId)) {
        return res.status(400).send({ message: "Invalid post id" });
      }

      const post = await postModel
        .findOne({ _id: postId, status: "active" })
        .select("_id");
      if (!post) {
        return res.status(404).send({ message: "Post not found" });
      }

      const filter = {
        postId,
        status: "active",
      };
      if (parentId && validateObjectId(parentId)) {
        filter.parentCommentId = parentId;
      } else {
        filter.parentCommentId = null;
      }

      const [comments, total] = await Promise.all([
        commentModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("userId", "username profilePicture")
          .lean(),
        commentModel.countDocuments(filter),
      ]);

      return res.status(200).send({
        message: "Comments fetched",
        page,
        limit,
        total,
        comments,
      });
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

/**
 * GET /posts/:postId/comments/:commentId/replies
 */
const getRepliesToComment = async (req, res) => {
    try {
        const { postId, commentId } = req.params
        if (!validateObjectId(postId) || !validateObjectId(commentId)) {
            return res.status(400).send({ message: 'Invalid id' })
        }

        const parent = await commentModel.findOne({
            _id: commentId,
            postId,
            status: 'active',
        })
        if (!parent) {
            return res.status(404).send({ message: 'Comment not found' })
        }

        const replies = await commentModel
            .find({
                postId,
                parentCommentId: commentId,
                status: 'active',
            })
            .sort({ createdAt: 1 })
            .populate('userId', 'username profilePicture')
            .lean()

        return res.status(200).send({ message: 'Replies fetched', replies })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

/**
 * POST /posts/:postId/comments
 * body: { text, parentCommentId? }
 */
const createComment = async (req, res) => {
    try {
        const userId = req.user?.id
        const { postId } = req.params
        if (!userId || !validateObjectId(userId) || !validateObjectId(postId)) {
            return res.status(400).send({ message: 'Invalid request' })
        }

        const validation = validateCommentPayload(req.body)
        if (!validation.valid) {
            return res.status(400).send({ message: validation.message })
        }

        const { text, parentCommentId } = validation.data

        const post = await postModel.findOne({ _id: postId, status: 'active' })
        if (!post) {
            return res.status(404).send({ message: 'Post not found' })
        }

        let parentOid = null
        if (parentCommentId) {
            if (!validateObjectId(parentCommentId)) {
                return res.status(400).send({ message: 'Invalid parent comment' })
            }
            const parent = await commentModel.findOne({
                _id: parentCommentId,
                postId,
                status: 'active',
            })
            if (!parent) {
                return res.status(404).send({ message: 'Parent comment not found' })
            }
            parentOid = new mongoose.Types.ObjectId(parentCommentId)
        }

        const comment = await commentModel.create({
            postId,
            userId,
            parentCommentId: parentOid,
            text,
        })

        await bumpPostCommentCount(post._id, 1)

        const populated = await commentModel
            .findById(comment._id)
            .populate('userId', 'username profilePicture')

        const updatedPost = await postModel
            .findById(postId)
            .populate('userId', 'username profilePicture')

        return res.status(201).send({
            message: 'Comment added',
            comment: populated,
            post: updatedPost,
        })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

/**
 * DELETE /comments/:commentId — comment author OR post owner; cascades soft-delete to replies.
 */
const deleteComment = async (req, res) => {
    try {
        const rawUserId = req.user?.id ?? req.user?._id
        const userId = rawUserId != null ? String(rawUserId) : ''
        const { commentId } = req.params
        if (!userId || !validateObjectId(userId) || !validateObjectId(commentId)) {
            return res.status(400).send({ message: 'Invalid request' })
        }

        const comment = await commentModel.findOne({
            _id: commentId,
            status: 'active',
        })
        if (!comment) {
            return res.status(404).send({ message: 'Comment not found' })
        }

        const post = await postModel.findOne({ _id: comment.postId, status: 'active' }).select('userId').lean()
        if (!post) {
            return res.status(404).send({ message: 'Post not found' })
        }

        const isCommentAuthor = String(comment.userId) === userId
        const isPostOwner = String(post.userId) === userId
        if (!isCommentAuthor && !isPostOwner) {
            return res.status(403).send({ message: 'Not allowed to delete this comment' })
        }

        const treeIds = await collectCommentTreeIds(commentId, comment.postId)
        const deletedCount = treeIds.length

        await commentModel.updateMany({ _id: { $in: treeIds } }, { $set: { status: 'deleted' } })

        await bumpPostCommentCount(comment.postId, -deletedCount)

        const updatedPost = await postModel
            .findById(comment.postId)
            .populate('userId', 'username profilePicture')

        const deletedIds = treeIds.map((id) => String(id))

        return res.status(200).send({
            message: 'Comment deleted',
            post: updatedPost,
            deletedIds,
        })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

/**
 * POST /comments/:commentId/like
 */
const toggleLikeComment = async (req, res) => {
    try {
        const userId = req.user?.id
        const { commentId } = req.params
        if (!userId || !validateObjectId(userId) || !validateObjectId(commentId)) {
            return res.status(400).send({ message: 'Invalid request' })
        }

        const comment = await commentModel.findOne({ _id: commentId, status: 'active' })
        if (!comment) {
            return res.status(404).send({ message: 'Comment not found' })
        }

        const uid = new mongoose.Types.ObjectId(userId)
        const likedBy = comment.likedBy || []
        const idx = likedBy.findIndex((id) => id.equals(uid))
        if (idx >= 0) {
            likedBy.splice(idx, 1)
            comment.likes = Math.max(0, (comment.likes || 0) - 1)
        } else {
            likedBy.push(uid)
            comment.likes = (comment.likes || 0) + 1
        }
        comment.likedBy = likedBy
        await comment.save()

        const updated = await commentModel.findById(comment._id).populate('userId', 'username profilePicture')
        return res.status(200).send({ message: 'OK', comment: updated })
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

export { getCommentsByPost, getRepliesToComment, createComment, deleteComment, toggleLikeComment }
