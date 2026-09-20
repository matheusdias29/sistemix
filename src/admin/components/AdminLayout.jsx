import React, { useEffect, useState } from 'react'
import { LayoutDashboard, Users, Store, LogOut, Bell, Menu, X } from 'lucide-react'
import { listenUsers } from '../../services/users'
import { listenAllSubscriptions } from '../../services/subscriptions'

export default function AdminLayout({ children, user, onViewChange, currentView, onLogout }) {
  const [trialUsersCount, setTrialUsersCount] = useState(0)
  const [users, setUsers] = useState([])
  const [subs, setSubs] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toDate = (d) => {
    if (!d) return null
    try {
      if (typeof d?.toDate === 'function') return d.toDate()
      if (typeof d?.seconds === 'number') return new Date(d.seconds * 1000)
      const x = new Date(d)
      return Number.isNaN(x.getTime()) ? null : x
    } catch {
      return null
    }
  }

  useEffect(() => {
    const unsubUsers = listenUsers((list) => setUsers(list))
    const unsubSubs = listenAllSubscriptions((list) => setSubs(list))
    return () => { unsubUsers && unsubUsers(); unsubSubs && unsubSubs() }
  }, [])

  useEffect(() => {
    const now = new Date()
    const subsByOwner = {}
    ;(subs || []).forEach(s => { if (s?.id) subsByOwner[s.id] = s })

    const count = (users || []).filter(u => {
      if (!u) return false
      if (!!u.trial) return true
      const sub = subsByOwner[u.id]
      const trialEnd = toDate(sub?.trialEnd)
      return !!trialEnd && trialEnd.getTime() >= now.getTime()
    }).length

    setTrialUsersCount(count)
  }, [users, subs])

  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false) }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [sidebarOpen])

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'stores', label: 'Lojas', icon: Store },
    { id: 'users', label: 'Usuários', icon: Users },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'trials', label: 'Em teste', icon: Bell, badge: trialUsersCount },
  ]

  const closeSidebarAndGo = (id) => {
    onViewChange(id)
    setSidebarOpen(false)
  }

  const SidebarNav = () => (
    <>
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">Admin Panel</h1>
            <p className="text-xs text-slate-400 mt-1">Bem-vindo, {user.name}</p>
          </div>
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden -mt-1 -mr-1 p-1.5 rounded-md text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map(item => {
          const Icon = item.icon
          const isActive = currentView === item.id
          return (
            <button
              key={item.id}
              onClick={() => closeSidebarAndGo(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Icon size={20} />
              <span className="flex-1 text-left">{item.label}</span>
              {!!item.badge && item.badge > 0 && (
                <span className="ml-auto text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">{item.badge}</span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={() => { onLogout?.(); setSidebarOpen(false) }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-slate-800 transition-colors"
        >
          <LogOut size={20} />
          <span>Sair</span>
        </button>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen md:h-screen w-full bg-gray-50 text-gray-900 dark:text-gray-100">
      {/* Sidebar DESKTOP (md+) — sempre visível */}
      <aside className="hidden md:flex w-64 shrink-0 bg-slate-900 text-white flex-col">
        <SidebarNav />
      </aside>

      {/* Sidebar MOBILE (<md) — drawer off-canvas + overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full w-72 z-50 bg-slate-900 text-white flex flex-col shadow-2xl transition-transform duration-200 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!sidebarOpen}
      >
        <SidebarNav />
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 w-full">
        <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="px-3 sm:px-4 py-3 flex items-center gap-3 min-h-[60px]">
            <button
              type="button"
              aria-label="Abrir menu"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 truncate">
              {menuItems.find(i => i.id === currentView)?.label || 'Dashboard'}
            </h2>
          </div>
        </header>
        <div className="p-3 sm:p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}

