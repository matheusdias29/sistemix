import React, { useEffect, useState } from 'react'
import { LayoutDashboard, Users, Store, LogOut, Bell } from 'lucide-react'
import { listenUsers } from '../../services/users'

export default function AdminLayout({ children, user, onViewChange, currentView, onLogout }) {
  const [trialUsersCount, setTrialUsersCount] = useState(0)
  useEffect(() => {
    const unsub = listenUsers((list) => {
      const count = list.filter(u => !!u.trial).length
      setTrialUsersCount(count)
    })
    return () => unsub && unsub()
  }, [])

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'stores', label: 'Lojas', icon: Store },
    { id: 'users', label: 'Usuários', icon: Users },
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
