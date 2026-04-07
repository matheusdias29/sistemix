import React, { useEffect, useState } from 'react'
import { LayoutDashboard, Users, Store, LogOut, Bell } from 'lucide-react'
import { listenUsers } from '../../services/users'
import { listenAllSubscriptions } from '../../services/subscriptions'

export default function AdminLayout({ children, user, onViewChange, currentView, onLogout }) {
  const [trialUsersCount, setTrialUsersCount] = useState(0)
  const [users, setUsers] = useState([])
  const [subs, setSubs] = useState([])

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

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'stores', label: 'Lojas', icon: Store },
    { id: 'users', label: 'Usuários', icon: Users },
    { id: 'notifications', label: 'Notificações', icon: Bell },
    { id: 'trials', label: 'Em teste', icon: Bell, badge: trialUsersCount },
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <p className="text-xs text-slate-400 mt-1">Bem-vindo, {user.name}</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  currentView === item.id 
                    ? 'bg-blue-600 text-white' 
                    : 'text-slate-300 hover:bg-slate-800'
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
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-slate-800 transition-colors"
          >
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="bg-white shadow-sm p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">
            {menuItems.find(i => i.id === currentView)?.label || 'Dashboard'}
          </h2>
        </header>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
