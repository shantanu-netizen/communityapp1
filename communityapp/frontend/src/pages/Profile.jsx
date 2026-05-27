import React, { useEffect, useMemo, useState, useCallback } from 'react'
import axios from 'axios'
import { useNavigate, useParams } from 'react-router-dom'
import styles from './Profile.module.css'
import HeaderNav from '../components/navs/HeaderNav'
import { serverUrl } from '../../config.mjs'
import CustomButton from '../components/buttons/CustomButton'
import FollowListModal from '../components/followList/FollowListModal'

export default function Profile() {
  const navigate = useNavigate()
  const { userId: routeUserId, username: routeUsername } = useParams()
  const token = useMemo(() => localStorage.getItem('token'), [])
  const currentUserId = localStorage.getItem('userId') || ''
  const isOwnProfile = String(routeUserId) === String(currentUserId)

  const [user, setUser] = useState(null)
  /** Public profile when viewing someone else */
  const [publicProfile, setPublicProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [isEditing, setIsEditing] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [profilePictureFile, setProfilePictureFile] = useState(null)
  const [followBusy, setFollowBusy] = useState(false)

  const [listModal, setListModal] = useState(null)

  const [form, setForm] = useState({
    username: '',
    email: '',
    phoneNumber: '',
    bio: '',
    address: '',
    education: '',
    dob: '',
    gender: '',
    maritalStatus: '',
    occupation: '',
  })

  const authHeaders = { Authorization: `Bearer ${token}` }

  const loadProfile = useCallback(async () => {
    if (!routeUserId) return
    setLoading(true)//Sets loading to true and clears any previous error.
    setError('')
    try {
      if (isOwnProfile) {
        const res = await axios.get(`${serverUrl}/profile`, { headers: authHeaders })
        setUser(res.data?.user || null)
        setPublicProfile(null)
      } else {
        const res = await axios.get(`${serverUrl}/users/${routeUserId}`, { headers: authHeaders })
        setPublicProfile(res.data?.profile || null)
        setUser(null)
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to load profile.'
      setError(msg)
      setUser(null)
      setPublicProfile(null)
      if (err?.response?.status === 401) navigate('/login', { replace: true })
    } finally {
      setLoading(false)
    }
  }, [routeUserId, isOwnProfile, token, navigate])//it only changes when one of those values changes.

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true })
      return
    }
    loadProfile()
  }, [token, navigate, loadProfile])
  
  //This useEffect block populates the edit form when the currently viewed profile is the user's own profile.
 useEffect(() => {
    const src = isOwnProfile ? user : null
    if (!src) return
    const addressString =
      typeof src.address === 'string' ? src.address : src.address?.street || ''

    const educationString = Array.isArray(src.education)
      ? src.education.join(', ')
      : src.education || ''

    const dobString = src.dob ? new Date(src.dob).toISOString().slice(0, 10) : ''

    setForm({
      username: src.username || '',
      email: src.email || '',
      phoneNumber: src.phoneNumber || '',
      bio: src.bio || '',
      address: addressString,
      education: educationString,
      dob: dobString,
      gender: src.gender || '',
      maritalStatus: src.maritalStatus || '',
      occupation: src.occupation || '',
    })
  }, [user, isOwnProfile])

  const displayName = isOwnProfile ? user?.username : publicProfile?.username
  const displayBio = isOwnProfile ? user?.bio : publicProfile?.bio
  const displayOccupation = isOwnProfile ? user?.occupation : publicProfile?.occupation
  const displayPicture = isOwnProfile ? user?.profilePicture : publicProfile?.profilePicture

  const followersCount = isOwnProfile
    ? user?.followersCount ?? 0
    : publicProfile?.followersCount ?? 0
  const followingCount = isOwnProfile
    ? user?.followingCount ?? 0
    : publicProfile?.followingCount ?? 0
  const isFollowing = !isOwnProfile && !!publicProfile?.isFollowing

  const avatarText = useMemo(() => {
    const name = displayName || ''
    return name ? name.trim().slice(0, 1).toUpperCase() : 'U'
  }, [displayName])

  const formatAddress = (addressValue) => {
    if (!addressValue) return '—'
    if (typeof addressValue === 'string') return addressValue
    const parts = []
    if (addressValue.street) parts.push(addressValue.street)
    if (addressValue.city) parts.push(addressValue.city)
    if (addressValue.state) parts.push(addressValue.state)
    if (addressValue.zip) parts.push(addressValue.zip)
    if (addressValue.country) parts.push(addressValue.country)
    return parts.length ? parts.join(', ') : '—'
  }
  // if a follow/unfollow operation is already in progress,
  const handleFollowToggle = async () => {
    if (!routeUserId || followBusy || isOwnProfile) return
    setFollowBusy(true)
    try {
      if (isFollowing) {
        const res = await axios.post(
          `${serverUrl}/unfollow`,
          { followingUserId: routeUserId },
          { headers: { ...authHeaders, 'Content-Type': 'application/json' } }
        )
        const fc = res.data?.followersCount
        setPublicProfile((prev) =>
          prev
            ? {
                ...prev,
                isFollowing: false,
                followersCount: typeof fc === 'number' ? fc : Math.max(0, (prev.followersCount || 0) - 1),
              }
            : prev
        )
      } else {
        const res = await axios.post(
          `${serverUrl}/follow`,
          { followingUserId: routeUserId },
          { headers: { ...authHeaders, 'Content-Type': 'application/json' } }
        )
        const fc = res.data?.followersCount
        setPublicProfile((prev) =>
          prev
            ? {
                ...prev,
                isFollowing: true,
                followersCount: typeof fc === 'number' ? fc : (prev.followersCount || 0) + 1,
              }
            : prev
        )
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not update follow.')
    } finally {
      setFollowBusy(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitLoading(true)
    setSubmitError('')
    try {
      const formData = new FormData()
      formData.append('username', form.username)
      formData.append('email', form.email)
      formData.append('phoneNumber', form.phoneNumber)
      formData.append('bio', form.bio)
      formData.append('address', form.address)
      formData.append('education', form.education)
      formData.append('dob', form.dob)
      formData.append('gender', form.gender)
      formData.append('maritalStatus', form.maritalStatus)
      formData.append('occupation', form.occupation)
      if (profilePictureFile) {
        formData.append('profilePicture', profilePictureFile)
      }

      await axios.put(`${serverUrl}/profile`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      })

      setIsEditing(false)
      setProfilePictureFile(null)
      await loadProfile()
    } catch (err) {
      setSubmitError(err?.response?.data?.message || 'Profile update failed.')
      if (err?.response?.status === 401) navigate('/login', { replace: true })
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    localStorage.removeItem('username')
    navigate('/login')
  }

  const profileLoaded = isOwnProfile ? !!user : !!publicProfile

  return (
    <>
      <HeaderNav />
      <div className={styles.profilePage}>
        <div className={styles.profileCard}>
          <div className={styles.profileTop}>
            {displayPicture ? (
              <img src={displayPicture} alt="Profile" className={styles.profileAvatarImg} />
            ) : (
              <div className={styles.profileAvatar} aria-hidden="true">
                {avatarText}
              </div>
            )}
            <div className={styles.profileHeading}>
              <h1 className={styles.profileName}>{displayName || 'Loading...'}</h1>
              {isOwnProfile && <p className={styles.profileEmail}>{user?.email || ''}</p>}
              {routeUsername && (
                <p className={styles.routeHint} title="URL segment">
                  @{routeUsername}
                </p>
              )}
            </div>
          </div>

          {!isOwnProfile && profileLoaded && (
            <div className={styles.profileActions}>
              <button
                type="button"
                className={isFollowing ? styles.followingBtn : styles.followBtnPrimary}
                onClick={handleFollowToggle}
                disabled={followBusy}
              >
                {followBusy ? '…' : isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
          )}

          {profileLoaded && (
            <div className={styles.statsRow}>
              <button
                type="button"
                className={styles.statBtn}
                onClick={() => setListModal('followers')}
              >
                <span className={styles.statNumber}>{followersCount}</span>
                <span className={styles.statLabel}>followers</span>
              </button>
              <button
                type="button"
                className={styles.statBtn}
                onClick={() => setListModal('following')}
              >
                <span className={styles.statNumber}>{followingCount}</span>
                <span className={styles.statLabel}>following</span>
              </button>
            </div>
          )}

          {loading && <div className={styles.loading}>Loading profile…</div>}
          {!loading && error && <div className={styles.error}>{error}</div>}

          {!loading && !error && profileLoaded && (
            <>
              {isOwnProfile && (
                <div className={styles.profileActions}>
                  <button
                    type="button"
                    className={styles.editButton}
                    onClick={() => {
                      setSubmitError('')
                      setIsEditing(true)
                    }}
                  >
                    Edit profile
                  </button>
                </div>
              )}

              {!isEditing || !isOwnProfile ? (
                <div className={styles.profileGrid}>
                  <div className={styles.profileItem}>
                    <div className={styles.profileLabel}>Username</div>
                    <div className={styles.profileValue}>{displayName}</div>
                  </div>
                  {isOwnProfile && (
                    <>
                      <div className={styles.profileItem}>
                        <div className={styles.profileLabel}>Phone Number</div>
                        <div className={styles.profileValue}>{user?.phoneNumber}</div>
                      </div>
                      <div className={styles.profileItem}>
                        <div className={styles.profileLabel}>Email</div>
                        <div className={styles.profileValue}>{user?.email}</div>
                      </div>
                    </>
                  )}
                  <div className={styles.profileItem}>
                    <div className={styles.profileLabel}>Bio</div>
                    <div className={styles.profileValue}>{displayBio || '—'}</div>
                  </div>
                  {isOwnProfile && (
                    <div className={styles.profileItem}>
                      <div className={styles.profileLabel}>Address</div>
                      <div className={styles.profileValue}>{formatAddress(user?.address)}</div>
                    </div>
                  )}
                  <div className={styles.profileItem}>
                    <div className={styles.profileLabel}>Occupation</div>
                    <div className={styles.profileValue}>{displayOccupation || '—'}</div>
                  </div>
                </div>
              ) : (
                <form className={styles.editForm} onSubmit={handleSubmit}>
                  <div className={styles.editGrid}>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Username</span>
                      <input
                        className={styles.fieldInput}
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                        required
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Email</span>
                      <input
                        className={styles.fieldInput}
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        required
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Phone Number</span>
                      <input
                        className={styles.fieldInput}
                        value={form.phoneNumber}
                        onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                        required
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Profile Picture</span>
                      <input
                        className={styles.fieldInput}
                        type="file"
                        accept="image/*"
                        onChange={(e) => setProfilePictureFile(e.target.files?.[0] || null)}
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Bio</span>
                      <textarea
                        className={styles.fieldInput}
                        value={form.bio}
                        onChange={(e) => setForm({ ...form, bio: e.target.value })}
                        rows={3}
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Address</span>
                      <input
                        className={styles.fieldInput}
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Education</span>
                      <input
                        className={styles.fieldInput}
                        value={form.education}
                        onChange={(e) => setForm({ ...form, education: e.target.value })}
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>DOB</span>
                      <input
                        className={styles.fieldInput}
                        value={form.dob}
                        onChange={(e) => setForm({ ...form, dob: e.target.value })}
                        placeholder="YYYY-MM-DD"
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Gender</span>
                      <input
                        className={styles.fieldInput}
                        value={form.gender}
                        onChange={(e) => setForm({ ...form, gender: e.target.value })}
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Marital Status</span>
                      <input
                        className={styles.fieldInput}
                        value={form.maritalStatus}
                        onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Occupation</span>
                      <input
                        className={styles.fieldInput}
                        value={form.occupation}
                        onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                      />
                    </label>
                  </div>

                  {submitError && <div className={styles.submitError}>{submitError}</div>}

                  <div className={styles.editActions}>
                    <button
                      type="button"
                      className={styles.cancelButton}
                      onClick={() => {
                        setSubmitError('')
                        setIsEditing(false)
                        setProfilePictureFile(null)
                      }}
                      disabled={submitLoading}
                    >
                      Cancel
                    </button>
                    <button type="submit" className={styles.saveButton} disabled={submitLoading}>
                      {submitLoading ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
        {isOwnProfile && <CustomButton text="Logout" handler={handleLogout} />}
      </div>

      <FollowListModal
        open={listModal === 'followers'}
        onClose={() => setListModal(null)}
        userId={routeUserId}
        variant="followers"
        title="Followers"
      />
      <FollowListModal
        open={listModal === 'following'}
        onClose={() => setListModal(null)}
        userId={routeUserId}
        variant="following"
        title="Following"
      />
    </>
  )
}
