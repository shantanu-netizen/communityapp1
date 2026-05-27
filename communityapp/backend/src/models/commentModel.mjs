import mongoose from 'mongoose'

/**
 * Standalone comments (LinkedIn-style): top-level on a post + optional replies (threaded).
 */
const commentSchema = new mongoose.Schema(
    {
        postId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Post',
            required: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        /** If set, this comment is a reply to another comment on the same post. */
        parentCommentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Comment',
            default: null,
            index: true,
        },
        text: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000,
        },
        likes: {
            type: Number,
            default: 0,
        },
        likedBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        status: {
            type: String,
            enum: ['active', 'deleted'],
            default: 'active',
            index: true,
        },
    },
    { timestamps: true }
)

commentSchema.index({ postId: 1, parentCommentId: 1, createdAt: -1 })
commentSchema.index({ postId: 1, createdAt: -1 })

const commentModel = mongoose.model('Comment', commentSchema)
export default commentModel
