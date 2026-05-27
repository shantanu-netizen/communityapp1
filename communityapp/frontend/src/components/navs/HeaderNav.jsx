import React, { useMemo } from 'react'
import styles from './HeaderNav.module.css'
import logo from '../../assets/logo.png'
import CustomButton from '../buttons/CustomButton'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import HomeIcon from '@mui/icons-material/Home'
import SmartDisplayOutlinedIcon from '@mui/icons-material/SmartDisplayOutlined'
import SmartDisplayIcon from '@mui/icons-material/SmartDisplay'
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined'
import PeopleAltIcon from '@mui/icons-material/PeopleAlt'
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined'
import WorkIcon from '@mui/icons-material/Work'
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'
import NotificationsIcon from '@mui/icons-material/Notifications'
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined'
import ChatBubbleIcon from '@mui/icons-material/ChatBubble'
export default function HeaderNav() {
    const navigate = useNavigate()
    const location = useLocation()
    const userId = localStorage.getItem('userId')

    const navItems = useMemo(() => {
        const uid = userId || ''
        return [
            { key: 'home', label: 'Home', to: '/', icon: (active) => (active ? <HomeIcon /> : <HomeOutlinedIcon />) },
            { key: 'posts', label: 'Posts', to: `/${uid}/posts`, icon: (active) => (active ? <HomeIcon /> : <HomeOutlinedIcon />) },
            { key: 'reels', label: 'Reels', to: `/${uid}/reels`, icon: (active) => (active ? <SmartDisplayIcon /> : <SmartDisplayOutlinedIcon />) },
            { key: 'connect', label: 'Connect', to: `/${uid}/connect`, icon: (active) => (active ? <PeopleAltIcon /> : <PeopleAltOutlinedIcon />) },
            { key: 'jobs', label: 'Jobs', to: `/${uid}/jobs`, icon: (active) => (active ? <WorkIcon /> : <WorkOutlineOutlinedIcon />) },
            { key: 'notifications', label: 'Notifications', to: `/${uid}/notifications`, icon: (active) => (active ? <NotificationsIcon /> : <NotificationsNoneOutlinedIcon />) },
            { key: 'messages', label: 'Messages', to: `/${uid}/messages`, icon: (active) => (active ? <ChatBubbleIcon /> : <ChatBubbleOutlineOutlinedIcon />) },
        ]
    }, [userId])

    const isActive = (to) => {
        const path = location.pathname || ''
        if (to === '/') return path === '/'//Only marks / active when the current path is exactly /
        return path.startsWith(to)
    }

    return (
        <div className={styles.headerNav}>
            <div className={styles.branding}>
                <img src={logo} alt="logo" className={styles.logo} />
                <h1 className={styles.brandingTitle}>Tech Community</h1>
            </div>
            <ul className={styles.menu} aria-label="Primary navigation">
                {navItems.map((item) => {
                    const active = isActive(item.to)
                    return (
                        <li key={item.key} className={styles.menuItem}>
                            <Link className={`${styles.navLink} ${active ? styles.navLinkActive : ''}`} to={item.to}>
                                {item.label}
                            </Link>
                        </li>
                    )
                })}
            </ul>
            <div className={styles.userActions}>
                <CustomButton text="Profile" handler={() => navigate(`/${localStorage.getItem('userId')}/${localStorage.getItem('username')}/profile`)} />
            </div>

            <nav className={styles.bottomNav} aria-label="Bottom navigation">
                {navItems
                    .filter((i) => i.key !== 'posts') /* keep bottom nav minimal like Instagram */
                    //Creates a React Router link with unique key, target route, and conditional CSS classes for active state.
                    .map((item) => {
                        const active = isActive(item.to)
                        return (
                            <Link
                                key={item.key}
                                to={item.to}
                                className={`${styles.bottomLink} ${active ? styles.bottomLinkActive : ''}`}
                                aria-current={active ? 'page' : undefined}
                                title={item.label}
                            >
                                <span className={styles.bottomIcon} aria-hidden>
                                    {item.icon(active)}
                                </span>
                                <span className={styles.bottomLabel}>{item.label}</span>
                            </Link>
                        )
                    })}
            </nav>
        </div>
    )
}
