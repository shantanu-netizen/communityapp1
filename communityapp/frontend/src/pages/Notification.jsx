import React, { useEffect, useMemo, useState } from 'react'
import styles from './Notification.module.css'
import HeaderNav from '../components/navs/HeaderNav'
import axios from 'axios'
import { serverUrl } from '../../config.mjs'
import { useNavigate } from 'react-router-dom'
export default function Notification() {
  const navigate = useNavigate()
  const token = useMemo(() => localStorage.getItem('token'), [])
  const [items, setItems] = useState([])
  const [counts, setCounts] = useState({ all: 0, posts: 0, jobs: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all') // all | post | job
  const [busy, setBusy] = useState(false)

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true })
      return
    }
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await axios.get(`${serverUrl}/notifications`, {
          headers: authHeaders,
          params: { limit: 50 },
        })
        setItems(res.data?.items || [])
        setCounts(res.data?.counts || { all: 0, posts: 0, jobs: 0 })
      } catch (err) {
        if (err?.response?.status === 401) navigate('/login', { replace: true })
        setError(err?.response?.data?.message || 'Could not load notifications.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token, authHeaders, navigate])

  const markSeen = async () => {
    if (!token || busy) return
    setBusy(true)
    try {
      await axios.post(`${serverUrl}/notifications/seen`, {}, { headers: authHeaders })
      setItems([])
      setCounts({ all: 0, posts: 0, jobs: 0 })
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not mark as read.')
    } finally {
      setBusy(false)
    }
  }

  const formatTime = (iso) => {
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return ''
    }
  }

  const shown = items.filter((it) => {
    if (filter === 'all') return true
    return String(it.postType || 'post') === filter
  })

  return (
    <div className={styles.page}>
      <HeaderNav />
      <div className={styles.wrap}>
        <div className={styles.header}>
          <h1 className={styles.title}>Notifications</h1>
          <button type="button" className={styles.markBtn} onClick={markSeen} disabled={busy || counts.all === 0}>
            {busy ? '…' : 'Mark all as read'}
          </button>
        </div>

        <div className={styles.filters}>
          <button
            type="button"
            className={`${styles.filterBtn} ${filter === 'all' ? styles.filterActive : ''}`}
            onClick={() => setFilter('all')}
          >
            All {counts.all ? `(${counts.all})` : ''}
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${filter === 'post' ? styles.filterActive : ''}`}
            onClick={() => setFilter('post')}
          >
            Posts {counts.posts ? `(${counts.posts})` : ''}
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${filter === 'job' ? styles.filterActive : ''}`}
            onClick={() => setFilter('job')}
          >
            Jobs {counts.jobs ? `(${counts.jobs})` : ''}
          </button>
        </div>

        {loading && <div className={styles.hint}>Loading…</div>}
        {!loading && error && <div className={styles.error}>{error}</div>}
        {!loading && !error && shown.length === 0 && (
          <div className={styles.hint}>No new notifications from people you follow.</div>
        )}

        <div className={styles.list}>
          {shown.map((n) => {
            const author = n?.userId?.username || 'Member'
            const isJob = n.postType === 'job'
            const title = isJob ? n?.job?.title || 'New job' : 'New post'
            const snippet = (n?.content || '').slice(0, 160)
            return (
              <article key={n._id} className={styles.item}>
                <div className={styles.avatar} aria-hidden>
                  {author.slice(0, 1).toUpperCase()}
                </div>
                <div className={styles.body}>
                  <div className={styles.rowTop}>
                    <div className={styles.line}>
                      <strong>@{author}</strong> · <span className={styles.muted}>{formatTime(n.createdAt)}</span>
                    </div>
                    {isJob && <span className={styles.badge}>JOB</span>}
                  </div>
                  <div className={styles.titleLine}>{title}</div>
                  {snippet && <div className={styles.snip}>{snippet}{n?.content?.length > 160 ? '…' : ''}</div>}
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
