import React, { useState, useEffect } from 'react'
import AdminLogin from './pages/AdminLogin'
import AdminLayout from './components/AdminLayout'
import ManageStores from './pages/ManageStores'
import ManageUsers from './pages/ManageUsers'
import AdminDashboard from './pages/AdminDashboard'

export default function AdminApp() {
  const [user, setUser] = useState(null)
  const [view, setView] = useState('dashboard')

  // Check for existing session
  useEffect(() => {
    const raw = localStorage.getItem('admin_session')
    if (raw) {
      try {
        const sess = JSON.parse(raw)
        if (sess.email) setUser(sess)
      } catch {}
    }
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
    localStorage.setItem('admin_session', JSON.stringify(userData))
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('admin_session')
  }

  if (!user) {
    return <AdminLogin onLogin={handleLogin} />
  }

  return (
    <AdminLayout user={user} onViewChange={setView} currentView={view} onLogout={handleLogout}>
      {view === 'dashboard' && <AdminDashboard />}
      {view === 'stores' && <ManageStores />}
      {view === 'users' && <ManageUsers />}
    </AdminLayout>
  )
}
