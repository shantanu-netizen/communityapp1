import React from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import SignUp from './components/auth/SignUp'
import Login from './components/auth/Login'
import Profile from './pages/Profile'
import Posts from './pages/Posts'
import Reels from './pages/Reels'
import Connect from './pages/Connect'
import Jobs from './pages/Jobs'
import Notification from './pages/Notification'
import Messages from './pages/Messages'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

const isAuthenticated = () => Boolean(localStorage.getItem('token'))

function RequireAuth({ children }) {
  return isAuthenticated() ? children : <Navigate to="/signup" replace />
}

function PublicOnly({ children }) {
  return isAuthenticated() ? <Navigate to="/" replace /> : children
}

function StartPage() {
  return isAuthenticated() ? <Home /> : <Navigate to="/signup" replace />
}

export default function App() {
  return (
    <div>
      <Routes>
        <Route path="/" element={<StartPage />} />
        <Route path="/signup" element={<PublicOnly><SignUp /></PublicOnly>} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
        <Route path="/reset-password" element={<PublicOnly><ResetPassword /></PublicOnly>} />
        <Route path="/:userId/:username/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/:userId/posts" element={<RequireAuth><Posts /></RequireAuth>} />
        <Route path="/:userId/reels" element={<RequireAuth><Reels /></RequireAuth>} />
        <Route path="/:userId/connect" element={<RequireAuth><Connect /></RequireAuth>} />
        <Route path="/:userId/jobs" element={<RequireAuth><Jobs /></RequireAuth>} />
        <Route path="/:userId/notifications" element={<RequireAuth><Notification /></RequireAuth>} />
        <Route path="/:userId/messages" element={<RequireAuth><Messages /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
