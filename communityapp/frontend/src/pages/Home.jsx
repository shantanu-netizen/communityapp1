import React, { useEffect, useMemo, useState } from 'react'
import HeaderNav from '../components/navs/HeaderNav'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { serverUrl } from '../../config.mjs'
import styles from './Home.module.css'
import PostButtons from '../components/postButtons/PostButtons'
export default function Home() {
    const navigate = useNavigate()
    const token = localStorage.getItem('token')
    const currentUsername = localStorage.getItem('username') || ''
    const [posts, setPosts] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    /** Set of user ids the current user follows (from API) */
    const [followingIds, setFollowingIds] = useState(() => new Set())

    const sortedPosts = useMemo(
      () => [...posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      [posts]
    )

    useEffect(() => {
        if (!token) {
            navigate('/login', { replace: true })
            return
        }

        const fetchPosts = async () => {
          setLoading(true)
          setError('')
          try {
            const res = await axios.get(`${serverUrl}/posts`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            setPosts(res.data?.posts || [])
          } catch (err) {
            if (err?.response?.status === 401) navigate('/login', { replace: true })
            setError(err?.response?.data?.message || 'Unable to load feed.')
          } finally {
            setLoading(false)
          }
        }

        fetchPosts()

        const fetchFollowing = async () => {
          try {
            const res = await axios.get(`${serverUrl}/profile`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            const ids = res.data?.user?.followingIds || []
            setFollowingIds(new Set(ids.map(String)))
          } catch {
            /* ignore */
          }
        }
        fetchFollowing()
    }, [navigate, token])

    const formatDate = (isoString) => {
      try {
        return new Date(isoString).toLocaleString()
      } catch {
        return 'Just now'
      }
    }

    const toggleFollow = async (authorId, authorName) => {
      if (!authorId || !token) return
      if (authorName === currentUsername) return
      const idStr = String(authorId)
      const isFollowing = followingIds.has(idStr)
      try {
        if (isFollowing) {
          await axios.post(
            `${serverUrl}/unfollow`,
            { followingUserId: idStr },
            { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
          )
          setFollowingIds((prev) => {
            const next = new Set(prev)
            next.delete(idStr)
            return next
          })
        } else {
          await axios.post(
            `${serverUrl}/follow`,
            { followingUserId: idStr },
            { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
          )
          setFollowingIds((prev) => new Set([...prev, idStr]))
        }
      } catch (err) {
        setError(err?.response?.data?.message || 'Could not update follow.')
      }
    }

    const handlePostUpdated = (updated) => {
      if (!updated?._id) return
      setPosts((prev) =>
        prev.map((p) =>
          String(p._id) === String(updated._id)
            ? {
                ...p,
                likes: updated.likes,
                likedBy: updated.likedBy || [],
                commentsCount: updated.commentsCount,
                sharesCount: updated.sharesCount,
                comments: updated.comments,
              }
            : p
        )
      )
    }

  return (
    <div className={styles.homePage}>
        <HeaderNav />
        <main className={styles.feedContainer}>

          {loading && <div className={styles.placeholder}>Loading posts...</div>}
          {!loading && error && <div className={styles.error}>{error}</div>}

          {!loading && !error && sortedPosts.length === 0 && (
            <div className={styles.placeholder}>No posts yet. Follow people and check back soon.</div>
          )}

          {!loading && !error && sortedPosts.length > 0 && (
            <div className={styles.feedList}>
              {sortedPosts.map((post) => {
                const author = post?.userId?.username || 'Unknown'
                const authorId = post?.userId?._id ?? post?.userId
                const isOwnPost = author === currentUsername
                const isFollowed = authorId && followingIds.has(String(authorId))
                const postMediaType = String(post?.mediaType || '')

                return (
                  <article className={styles.feedCard} key={post._id}>
                    <div className={styles.cardHeader}>
                      <div className={styles.authorBlock}>
                        <span className={styles.avatar} aria-hidden>
                          {post?.userId?.profilePicture ? (
                            <img src={post.userId.profilePicture} alt="" className={styles.avatarImg} />
                          ) : (
                            (author || 'U').slice(0, 1).toUpperCase()
                          )}
                        </span>
                        <div>
                          <p className={styles.authorName}>{author}</p>
                          <p className={styles.postMeta}>{formatDate(post.createdAt)}</p>
                        </div>
                      </div>
                      {!isOwnPost && authorId && (
                        <button
                          type="button"
                          className={`${styles.followBtn} ${isFollowed ? styles.following : ''}`}
                          onClick={() => toggleFollow(authorId, author)}
                        >
                          {isFollowed ? 'Following' : 'Follow'}
                        </button>
                      )}
                    </div>

                    {post?.content && <p className={styles.postContent}>{post.content}</p>}

                    {post?.media && (
                      <div className={styles.mediaWrap}>
                        {postMediaType.includes('video') ? (
                          <video controls src={post.media} className={styles.postMedia} />
                        ) : (
                          <img src={post.media} alt="Post media" className={styles.postMedia} />
                        )}
                      </div>
                    )}
                    <PostButtons
                      postId={post._id}
                      postAuthorId={post?.userId?._id ?? post?.userId}
                      likes={post.likes}
                      commentsCount={post.commentsCount}
                      sharesCount={post.sharesCount}
                      likedBy={post.likedBy || []}
                      onUpdated={handlePostUpdated}
                    />
                  </article>
                )
              })}
            </div>
          )}
        </main>
    </div>
  )
}
