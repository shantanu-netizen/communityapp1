import React, { useCallback, useEffect, useMemo, useState } from 'react'
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined'
import FavoriteIcon from '@mui/icons-material/Favorite'
import ModeCommentOutlinedIcon from '@mui/icons-material/ModeCommentOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import axios from 'axios'
import { serverUrl } from '../../../config.mjs'
import styles from './PostButtons.module.css'

/**
 * LinkedIn-style post actions + real comments (standalone Comment model on backend).
 */
export default function PostButtons({
  postId,
  /** Post author's user id — allows them to delete any comment on their post */
  postAuthorId,
  likes = 0,
  commentsCount = 0,
  sharesCount = 0,
  likedBy = [],
  onUpdated,
}) {
  const token = localStorage.getItem('token')
  const currentUserId = localStorage.getItem('userId')
  const [busy, setBusy] = useState(null)
  const [showComment, setShowComment] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [localError, setLocalError] = useState('')
  const [comments, setComments] = useState([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [replyingToId, setReplyingToId] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [repliesByParent, setRepliesByParent] = useState({})
  const [deletingId, setDeletingId] = useState(null)

  const isLiked = useMemo(() => {
    if (!currentUserId || !Array.isArray(likedBy)) return false
    return likedBy.some((id) => String(id) === String(currentUserId))
  }, [likedBy, currentUserId])

  const mergeUpdated = (post) => {
    if (post && typeof onUpdated === 'function') onUpdated(post)
  }

  const authHeaders = { Authorization: `Bearer ${token}` }

  const loadComments = useCallback(async () => {
    if (!postId) return
    setLoadingComments(true)
    setLocalError('')
    try {
      const res = await axios.get(`${serverUrl}/posts/${postId}/comments`, {
        headers: authHeaders,
        params: { page: 1, limit: 30 },
      })
      setComments(res.data?.comments || [])
    } catch (err) {
      setLocalError(err?.response?.data?.message || 'Could not load comments.')
    } finally {
      setLoadingComments(false)
    }
  }, [postId, token])

  useEffect(() => {
    if (showComment && postId) {
      loadComments()
    }
  }, [showComment, postId, loadComments])

  const loadReplies = async (commentId) => {
    try {
      const res = await axios.get(`${serverUrl}/posts/${postId}/comments/${commentId}/replies`, {
        headers: authHeaders,
      })
      setRepliesByParent((prev) => ({ ...prev, [commentId]: res.data?.replies || [] }))
    } catch {
      /* ignore */
    }
  }

  const handleLike = async () => {
    if (!postId || busy) return
    setLocalError('')
    setBusy('like')
    try {
      const res = await axios.post(`${serverUrl}/posts/${postId}/like`, {}, { headers: authHeaders })
      mergeUpdated(res.data?.post)
    } catch (err) {
      setLocalError(err?.response?.data?.message || 'Could not update like.')
    } finally {
      setBusy(null)
    }
  }

  const handleShare = async () => {
    if (!postId || busy) return
    setLocalError('')
    setBusy('share')
    try {
      const res = await axios.post(`${serverUrl}/posts/${postId}/share`, {}, { headers: authHeaders })
      mergeUpdated(res.data?.post)
      try {
        await navigator.clipboard.writeText(window.location.origin + '/')
      } catch {
        /* ignore */
      }
    } catch (err) {
      setLocalError(err?.response?.data?.message || 'Could not share.')
    } finally {
      setBusy(null)
    }
  }

  const handleCommentSubmit = async (e) => {
    e.preventDefault()
    const text = commentText.trim()
    if (!text || !postId || busy) return
    setLocalError('')
    setBusy('comment')
    try {
      const res = await axios.post(
        `${serverUrl}/posts/${postId}/comments`,
        { text },
        { headers: { ...authHeaders, 'Content-Type': 'application/json' } }
      )
      mergeUpdated(res.data?.post)
      if (res.data?.comment) {
        setComments((prev) => [res.data.comment, ...prev])
      }
      setCommentText('')
    } catch (err) {
      setLocalError(err?.response?.data?.message || 'Could not post comment.')
    } finally {
      setBusy(null)
    }
  }

  const handleReplySubmit = async (e, parentCommentId) => {
    e.preventDefault()
    const text = replyText.trim()
    if (!text || !postId || busy) return
    setLocalError('')
    setBusy('reply')
    try {
      const res = await axios.post(
        `${serverUrl}/posts/${postId}/comments`,
        { text, parentCommentId },
        { headers: { ...authHeaders, 'Content-Type': 'application/json' } }
      )
      mergeUpdated(res.data?.post)
      setReplyText('')
      setReplyingToId(null)
      await loadReplies(parentCommentId)
    } catch (err) {
      setLocalError(err?.response?.data?.message || 'Could not post reply.')
    } finally {
      setBusy(null)
    }
  }

  const handleCommentLike = async (commentId) => {
    try {
      const res = await axios.post(`${serverUrl}/comments/${commentId}/like`, {}, { headers: authHeaders })
      const updated = res.data?.comment
      if (!updated) return
      setComments((prev) =>
        prev.map((c) => (String(c._id) === String(commentId) ? updated : c))
      )
      setRepliesByParent((prev) => {
        const next = { ...prev }
        Object.keys(next).forEach((pid) => {
          next[pid] = next[pid].map((c) => (String(c._id) === String(commentId) ? updated : c))
        })
        return next
      })
    } catch {
      /* ignore */
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!token) {
      setLocalError('Sign in to delete comments.')
      return
    }
    if (!window.confirm('Delete this comment? Replies will be removed too.')) return
    setDeletingId(commentId)
    setLocalError('')
    try {
      const res = await axios.delete(`${serverUrl}/comments/${commentId}`, { headers: authHeaders })
      mergeUpdated(res.data?.post)
      const deletedIds = new Set(
        (res.data?.deletedIds && res.data.deletedIds.length > 0
          ? res.data.deletedIds
          : [commentId]
        ).map(String)
      )
      setComments((prev) => prev.filter((c) => !deletedIds.has(String(c._id))))
      setRepliesByParent((prev) => {
        const next = { ...prev }
        for (const id of deletedIds) {
          delete next[id]
        }
        Object.keys(next).forEach((pid) => {
          next[pid] = (next[pid] || []).filter((c) => !deletedIds.has(String(c._id)))
        })
        return next
      })
    } catch (err) {
      setLocalError(err?.response?.data?.message || 'Could not delete.')
    } finally {
      setDeletingId(null)
    }
  }

  const formatTime = (iso) => {
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return ''
    }
  }

  const commentAuthorName = (c) => c?.userId?.username || 'Member'
  const commentAuthorId = (c) => {
    const u = c?.userId
    if (u && typeof u === 'object' && u._id != null) return String(u._id)
    if (u != null) return String(u)
    return ''
  }
  const canDeleteComment = (c) => {
    if (!currentUserId) return false
    const authorId = commentAuthorId(c)
    if (authorId && authorId === String(currentUserId)) return true
    if (postAuthorId != null && String(postAuthorId) === String(currentUserId)) return true
    return false
  }
  const isCommentLiked = (c) =>
    currentUserId && Array.isArray(c?.likedBy) && c.likedBy.some((id) => String(id) === String(currentUserId))

  const totalEngagement = (likes || 0) + (commentsCount || 0) + (sharesCount || 0)

  return (
    <div className={styles.wrap}>
      {totalEngagement > 0 && (
        <div className={styles.statsRow}>
          <span className={styles.statsLeft}>
            {likes > 0 && (
              <span className={styles.reactionBadge}>
                <span className={styles.heartDot} aria-hidden />
                <strong>{likes}</strong>
              </span>
            )}
          </span>
          <div className={styles.statsRight}>
            {commentsCount > 0 && <span>{commentsCount} comments</span>}
            {commentsCount > 0 && sharesCount > 0 && <span className={styles.dot}>·</span>}
            {sharesCount > 0 && <span>{sharesCount} reposts</span>}
          </div>
        </div>
      )}

      <div className={styles.divider} />

      <div className={styles.actionsRow}>
        <button
          type="button"
          className={`${styles.actionBtn} ${isLiked ? styles.actionBtnActive : ''}`}
          onClick={handleLike}
          disabled={busy}
          aria-pressed={isLiked}
        >
          {isLiked ? (
            <FavoriteIcon className={styles.icon} fontSize="small" />
          ) : (
            <FavoriteBorderOutlinedIcon className={styles.icon} fontSize="small" />
          )}
          <span>Like</span>
        </button>

        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => setShowComment((v) => !v)}
          disabled={busy}
        >
          <ModeCommentOutlinedIcon className={styles.icon} fontSize="small" />
          <span>Comment</span>
        </button>

        <button type="button" className={styles.actionBtn} onClick={handleShare} disabled={busy}>
          <ShareOutlinedIcon className={styles.icon} fontSize="small" />
          <span>Share</span>
        </button>
      </div>

      {localError && <p className={styles.inlineError}>{localError}</p>}

      {showComment && (
        <div className={styles.threadPanel}>
          <form className={styles.commentBox} onSubmit={handleCommentSubmit}>
            <textarea
              className={styles.commentInput}
              placeholder="Add a comment…"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={2}
            />
            <div className={styles.commentActions}>
              <button
                type="submit"
                className={styles.commentSubmit}
                disabled={busy || !commentText.trim()}
              >
                {busy === 'comment' ? 'Posting…' : 'Post'}
              </button>
            </div>
          </form>

          {loadingComments && <p className={styles.threadHint}>Loading comments…</p>}

          {!loadingComments && comments.length === 0 && (
            <p className={styles.threadHint}>Be the first to comment.</p>
          )}

          <ul className={styles.commentList}>
            {comments.map((c) => (
              <li key={c._id} className={styles.commentItem}>
                <div className={styles.commentAvatar} aria-hidden>
                  {(commentAuthorName(c) || 'M').slice(0, 1).toUpperCase()}
                </div>
                <div className={styles.commentBody}>
                  <div className={styles.commentBubble}>
                    <div className={styles.commentHeader}>
                      <span className={styles.commentName}>{commentAuthorName(c)}</span>
                      <span className={styles.commentTime}>{formatTime(c.createdAt)}</span>
                    </div>
                    <p className={styles.commentText}>{c.text}</p>
                  </div>
                  <div className={styles.commentToolbar}>
                    <button
                      type="button"
                      className={`${styles.miniBtn} ${isCommentLiked(c) ? styles.miniBtnActive : ''}`}
                      onClick={() => handleCommentLike(c._id)}
                    >
                      {isCommentLiked(c) ? 'Unlike' : 'Like'}
                      {c.likes > 0 ? ` · ${c.likes}` : ''}
                    </button>
                    <button
                      type="button"
                      className={styles.miniBtn}
                      onClick={() => {
                        setReplyingToId((id) => (id === c._id ? null : c._id))
                        setReplyText('')
                        if (!repliesByParent[c._id]) loadReplies(c._id)
                      }}
                    >
                      Reply
                    </button>
                    {canDeleteComment(c) && (
                      <button
                        type="button"
                        className={styles.miniBtnDanger}
                        onClick={() => handleDeleteComment(c._id)}
                        disabled={deletingId === c._id}
                      >
                        {deletingId === c._id ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                  </div>

                  {Array.isArray(repliesByParent[c._id]) && repliesByParent[c._id].length > 0 && (
                    <ul className={styles.replyList}>
                      {repliesByParent[c._id].map((r) => (
                        <li key={r._id} className={styles.replyItem}>
                          <div className={styles.commentAvatarSmall}>{(commentAuthorName(r) || 'M').slice(0, 1)}</div>
                          <div>
                            <div className={styles.commentBubbleReply}>
                              <div className={styles.commentHeader}>
                                <span className={styles.commentName}>{commentAuthorName(r)}</span>
                                <span className={styles.commentTime}>{formatTime(r.createdAt)}</span>
                              </div>
                              <p className={styles.commentText}>{r.text}</p>
                            </div>
                            <div className={styles.commentToolbar}>
                              <button
                                type="button"
                                className={`${styles.miniBtn} ${isCommentLiked(r) ? styles.miniBtnActive : ''}`}
                                onClick={() => handleCommentLike(r._id)}
                              >
                                {isCommentLiked(r) ? 'Unlike' : 'Like'}
                                {r.likes > 0 ? ` · ${r.likes}` : ''}
                              </button>
                              {canDeleteComment(r) && (
                                <button
                                  type="button"
                                  className={styles.miniBtnDanger}
                                  onClick={() => handleDeleteComment(r._id)}
                                  disabled={deletingId === r._id}
                                >
                                  {deletingId === r._id ? 'Deleting…' : 'Delete'}
                                </button>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {replyingToId === c._id && (
                    <form className={styles.replyForm} onSubmit={(e) => handleReplySubmit(e, c._id)}>
                      <textarea
                        className={styles.replyInput}
                        placeholder={`Reply to ${commentAuthorName(c)}…`}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={2}
                      />
                      <div className={styles.replyFormActions}>
                        <button type="button" className={styles.miniBtn} onClick={() => setReplyingToId(null)}>
                          Cancel
                        </button>
                        <button type="submit" className={styles.commentSubmit} disabled={busy === 'reply' || !replyText.trim()}>
                          {busy === 'reply' ? 'Posting…' : 'Reply'}
                        </button>
                      </div>
                    </form>
                  )}

                  {repliesByParent[c._id] === undefined && (
                    <button type="button" className={styles.viewRepliesBtn} onClick={() => loadReplies(c._id)}>
                      View replies
                    </button>
                  )}
                  {Array.isArray(repliesByParent[c._id]) && repliesByParent[c._id].length === 0 && (
                    <p className={styles.threadHint}>No replies yet.</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
