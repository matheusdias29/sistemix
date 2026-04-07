import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Bell, X, Info, CheckCircle, AlertTriangle, AlertCircle, Sun, Moon } from 'lucide-react'
import { listenStoreNotifications } from '../services/notifications'

export default function Header({user, userData, storeData, title, onUserClick, mobileControls, rightAction, onToggleChat, onToggleCalculator, chatUnreadCount = 0, chatOpen = false, calculatorOpen = false, darkMode = false, onToggleDarkMode}){
  const [showNotifications, setShowNotifications] = useState(false)
  const notificationRef = useRef(null)

  const storeId = storeData?.id
  const userId = userData?.memberId || userData?.id || user?.memberId || user?.id || 'anon'
  const storageKey = storeId ? `notif_read_${storeId}_${userId}` : null

  const [notifications, setNotifications] = useState([])
  const [readIds, setReadIds] = useState([])

  useEffect(() => {
    if (!storageKey) {
      setReadIds([])
      return
    }
    try {
      const raw = localStorage.getItem(storageKey)
      const parsed = raw ? JSON.parse(raw) : []
      setReadIds(Array.isArray(parsed) ? parsed : [])
    } catch {
      setReadIds([])
    }
  }, [storageKey])

  useEffect(() => {
    if (!storeId) {
      setNotifications([])
      return
    }
    const unsub = listenStoreNotifications(storeId, (items) => setNotifications(items || []), { limit: 50 })
    return () => unsub && unsub()
  }, [storeId])

  const readSet = useMemo(() => new Set(readIds), [readIds])
  const unreadCount = useMemo(() => notifications.filter(n => !readSet.has(n.id)).length, [notifications, readSet])

  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const persistReadIds = (next) => {
    setReadIds(next)
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {}
  }

  const markAsRead = (id) => {
    if (!id) return
    if (readSet.has(id)) return
    persistReadIds([...readIds, id])
  }

  const markAllAsRead = () => {
    const all = notifications.map(n => n.id).filter(Boolean)
    const merged = Array.from(new Set([...readIds, ...all]))
    persistReadIds(merged)
  }

  const formatTime = (ts) => {
    const d = ts?.toDate?.() ? ts.toDate() : (ts ? new Date(ts) : null)
    if (!d || Number.isNaN(d.getTime())) return ''
    const diff = Date.now() - d.getTime()
    const sec = Math.max(0, Math.floor(diff / 1000))
    if (sec < 30) return 'Agora'
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min} min atrás`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h atrás`
    const days = Math.floor(hr / 24)
    if (days < 7) return `${days}d atrás`
    return d.toLocaleDateString('pt-BR')
  }

  // Fallback for compatibility if userData/storeData are missing
  const displayName = userData?.name || user?.name?.split('—')[0]?.trim() || 'Usuário'
  const storeName = storeData?.name || (user?.name?.includes('—') ? user.name.split('—')[1]?.trim() : '')
  const initials = displayName?.[0]?.toUpperCase() || '?'
  
  const handleClick = typeof onUserClick === 'function' ? onUserClick : () => {}
  
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2 md:gap-4">
        {/* Botão único hambúrguer (mobile) */}
        <button
          className="md:hidden h-9 w-9 rounded-full border border-slate-300 flex items-center justify-center bg-white shadow-sm active:scale-[0.98] text-slate-700"
          aria-label={mobileControls?.isOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={mobileControls?.isOpen ? 'true' : 'false'}
          onClick={mobileControls?.toggle}
          title={mobileControls?.isOpen ? 'Fechar menu' : 'Abrir menu'}
        >
          {/* ícone hambúrguer SVG com 3 linhas */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{title ?? 'Início'}</h1>
      </div>
      <div className="flex items-center gap-3">
        {rightAction ? (
          <div className="flex items-center">{rightAction}</div>
        ) : null}

        {typeof onToggleDarkMode === 'function' ? (
          <div className="flex flex-col items-center leading-none">
            <button
              onClick={onToggleDarkMode}
              className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors relative"
              title={darkMode ? 'Modo escuro' : 'Modo claro'}
            >
              {darkMode ? <Moon size={24} /> : <Sun size={24} />}
            </button>
            <div className="mt-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400">{darkMode ? 'Modo escuro' : 'Modo claro'}</div>
          </div>
        ) : null}

        {typeof onToggleChat === 'function' ? (
          <div className="flex flex-col items-center leading-none">
            <button
              onClick={onToggleChat}
              className={`p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors relative ${chatOpen ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200' : ''}`}
              title="Chat interno"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {chatUnreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-4 w-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900">
                  {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                </span>
              )}
            </button>
            <div className="mt-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400">Chat interno</div>
          </div>
        ) : null}

        {typeof onToggleCalculator === 'function' ? (
          <div className="flex flex-col items-center leading-none">
            <button
              onClick={onToggleCalculator}
              className={`p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors relative ${calculatorOpen ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200' : ''}`}
              title="Calculadora"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2"></rect>
                <line x1="8" y1="6" x2="16" y2="6"></line>
                <line x1="16" y1="14" x2="16" y2="14"></line>
                <line x1="16" y1="18" x2="16" y2="18"></line>
                <line x1="12" y1="14" x2="12" y2="14"></line>
                <line x1="12" y1="18" x2="12" y2="18"></line>
                <line x1="8" y1="14" x2="8" y2="14"></line>
                <line x1="8" y1="18" x2="8" y2="18"></line>
              </svg>
            </button>
            <div className="mt-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400">Calculadora</div>
          </div>
        ) : null}

        {/* Ícone de Notificações */}
        <div className="relative" ref={notificationRef}>
          <div className="flex flex-col items-center leading-none">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors relative"
              title="Notificações"
            >
              <Bell size={24} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-4 w-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900">
                  {unreadCount}
                </span>
              )}
            </button>
            <div className="mt-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400">Notificações</div>
          </div>

          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 md:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                <h3 className="font-bold text-gray-800 dark:text-gray-100">Notificações</h3>
                <div className="flex items-center gap-3">
                  <button onClick={markAllAsRead} className="text-xs text-gray-500 hover:underline font-semibold">Marcar todas como lidas</button>
                  <button onClick={() => setShowNotifications(false)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500 dark:text-gray-400">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center gap-2">
                    <Bell size={32} className="opacity-20" />
                    <p className="text-sm">Nenhuma notificação por aqui.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 dark:divide-gray-700">
                    {notifications.map(n => (
                      <div
                        key={n.id}
                        className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer relative group ${!readSet.has(n.id) ? 'bg-green-50/20 dark:bg-green-900/10' : ''}`}
                        onClick={() => markAsRead(n.id)}
                      >
                        <div className="flex gap-3">
                          <div className={`p-2 rounded-full h-fit ${
                            n.type === 'success' ? 'bg-green-100 text-green-600 dark:bg-green-900/30' :
                            n.type === 'warning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30' :
                            n.type === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' :
                            'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
                          }`}>
                            {n.type === 'success' ? <CheckCircle size={18} /> :
                             n.type === 'warning' ? <AlertTriangle size={18} /> :
                             n.type === 'error' ? <AlertCircle size={18} /> :
                             <Info size={18} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{n.title}</h4>
                              <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap">{n.time || formatTime(n.createdAt)}</span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{n.message}</p>
                          </div>
                          {!readSet.has(n.id) && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <div
            className="group flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full pl-2 pr-6 py-2 cursor-pointer hover:shadow-lg hover:border-green-200 dark:hover:border-green-900 transition-all duration-200"
            onClick={handleClick}
            title="Trocar de loja"
          >
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold shadow-sm text-lg">
              {initials}
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-bold text-gray-800 dark:text-gray-100 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                {displayName}
              </span>
              {storeName && (
                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold tracking-wide uppercase truncate max-w-[180px]">
                  {storeName}
                </span>
              )}
            </div>
            <div className="ml-2 text-gray-400 group-hover:text-green-500 transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                 <path d="m6 9 6 6 6-6"/>
               </svg>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
