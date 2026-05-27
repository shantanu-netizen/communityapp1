import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { serverUrl } from '../../../config.mjs'
import styles from './FollowListModal.module.css'

/**
 * Instagram-style sheet: list of followers or following for a user.
 */
export default function FollowListModal({ open, onClose, userId, variant, title }) {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !userId || !token) return
    const path = variant === 'followers' ? 'followers' : 'following'
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await axios.get(`${serverUrl}/users/${userId}/${path}`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { page: 1, limit: 50 },
        })
        if (!cancelled) setUsers(res.data?.users || [])
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Could not load list.')
          setUsers([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open, userId, variant, token])

  if (!open) return null

  const goProfile = (u) => {
    if (!u?._id || !u?.username) return
    onClose()
    navigate(`/${u._id}/${u.username}/profile`)
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className={styles.backdrop} aria-label="Close" onClick={onClose} />
      <div className={styles.sheet}>
        <div className={styles.sheetHeader}>
          <h2 className={styles.sheetTitle}>{title}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>
        <div className={styles.sheetBody}>
          {loading && <p className={styles.hint}>Loading…</p>}
          {!loading && error && <p className={styles.err}>{error}</p>}
          {!loading && !error && users.length === 0 && <p className={styles.hint}>No users yet.</p>}
          <ul className={styles.list}>
            {users.map((u) => (
              <li key={u._id}>
                <button type="button" className={styles.row} onClick={() => goProfile(u)}>
                  <span className={styles.avatar} aria-hidden>
                    {u.profilePicture ? (
                      <img src={u.profilePicture} alt="" className={styles.avatarImg} />
                    ) : (
                      (u.username || 'U').slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <span className={styles.name}>{u.username || 'User'}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
