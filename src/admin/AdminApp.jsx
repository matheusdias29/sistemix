import React, { useState, useEffect, useMemo, useRef } from 'react'
import AdminLogin from './pages/AdminLogin'
import AdminLayout from './components/AdminLayout'
import ManageStores from './pages/ManageStores'
import ManageUsers from './pages/ManageUsers'
import AdminDashboard from './pages/AdminDashboard'
import AdminStoreView from './pages/AdminStoreView'
import AdminTrialUsers from './pages/AdminTrialUsers'
import AdminStoreSettings from './pages/AdminStoreSettings'
import { listenAllStores } from '../services/stores'
import { getGlobalStoreId, listenAllNotifications, sendNotificationToAllStores, sendNotificationToStore } from '../services/notifications'
import { Bell, CheckCircle, AlertTriangle, AlertCircle, Info, Send, Sparkles, Store, Globe, Building2, Search } from 'lucide-react'

function AdminNotificationsPage({ adminUser }) {
  const [stores, setStores] = useState([])
  const [recent, setRecent] = useState([])

  const [sendToAll, setSendToAll] = useState(true)
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [storeQuery, setStoreQuery] = useState('')
  const [storePickerOpen, setStorePickerOpen] = useState(false)
  const storePickerRef = useRef(null)

  const [type, setType] = useState('info')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sentOk, setSentOk] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsub = listenAllStores((items) => setStores(items || []))
    return () => unsub && unsub()
  }, [])

  useEffect(() => {
    const unsub = listenAllNotifications((items) => setRecent(items || []), { limit: 50 })
    return () => unsub && unsub()
  }, [])

  const storeOptions = useMemo(() => {
    const sorted = [...stores].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    return sorted
  }, [stores])

  useEffect(() => {
    function handleClickOutside(e) {
      if (storePickerRef.current && !storePickerRef.current.contains(e.target)) {
        setStorePickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!sendToAll && selectedStoreId) {
      const found = storeOptions.find(s => s.id === selectedStoreId)
      if (found && String(found.name || '').trim()) {
        setStoreQuery(String(found.name || '').trim())
      }
    }
  }, [sendToAll, selectedStoreId, storeOptions])

  const target = sendToAll ? getGlobalStoreId() : selectedStoreId

  const preview = useMemo(() => {
    return {
      title: title.trim() || 'Título da notificação',
      message: message.trim() || 'Digite a mensagem para aparecer nas lojas.',
      type,
    }
  }, [title, message, type])

  const templates = useMemo(() => ([
    {
      label: 'Atualização',
      fill: () => {
        setType('info')
        setTitle('Atualização do sistema')
        setMessage('Uma nova atualização foi aplicada. Se notar qualquer comportamento diferente, fale com o suporte.')
      }
    },
    {
      label: 'Promo',
      fill: () => {
        setType('success')
        setTitle('Dica rápida')
        setMessage('Use o catálogo público para compartilhar produtos com seus clientes e aumentar as vendas.')
      }
    },
    {
      label: 'Alerta',
      fill: () => {
        setType('warning')
        setTitle('Atenção')
        setMessage('Recomendamos revisar o caixa e finalizar o dia corretamente para manter os relatórios em dia.')
      }
    },
    {
      label: 'Urgente',
      fill: () => {
        setType('error')
        setTitle('Aviso importante')
        setMessage('Detectamos uma instabilidade. Estamos atuando para normalizar. Obrigado pela compreensão.')
      }
    },
  ]), [])

  const iconForType = (t) => {
    if (t === 'success') return CheckCircle
    if (t === 'warning') return AlertTriangle
    if (t === 'error') return AlertCircle
    return Info
  }

  const colorForType = (t) => {
    if (t === 'success') return 'bg-green-100 text-green-700'
    if (t === 'warning') return 'bg-amber-100 text-amber-700'
    if (t === 'error') return 'bg-red-100 text-red-700'
    return 'bg-blue-100 text-blue-700'
  }

  const borderForType = (t) => {
    if (t === 'success') return 'border-green-200'
    if (t === 'warning') return 'border-amber-200'
    if (t === 'error') return 'border-red-200'
    return 'border-blue-200'
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

  const send = async () => {
    const cleanTitle = title.trim()
    const cleanMessage = message.trim()
    setSentOk(false)
    setError('')
    if (!cleanTitle || !cleanMessage) {
      setError('Preencha título e mensagem.')
      return
    }
    if (!sendToAll && !selectedStoreId) {
      setError('Selecione uma loja para enviar.')
      return
    }
    setSending(true)
    try {
      const payload = {
        title: cleanTitle,
        message: cleanMessage,
        type,
        createdBy: adminUser?.email || adminUser?.name || null,
      }
      if (!target || target === getGlobalStoreId()) {
        await sendNotificationToAllStores(payload)
      } else {
        await sendNotificationToStore(target, payload)
      }
      setSentOk(true)
      setTitle('')
      setMessage('')
      setType('info')
      setSendToAll(true)
      setSelectedStoreId('')
      setStoreQuery('')
    } catch (e) {
      setError(e?.message || 'Falha ao enviar notificação.')
    } finally {
      setSending(false)
      setTimeout(() => setSentOk(false), 2500)
    }
  }

  const PreviewIcon = iconForType(preview.type)
  const canSend = title.trim() && message.trim() && (sendToAll || !!selectedStoreId) && !sending
  const selectedStore = selectedStoreId ? storeOptions.find(s => s.id === selectedStoreId) : null

  const filteredStores = useMemo(() => {
    if (sendToAll) return []
    const q = String(storeQuery || '').trim().toLowerCase()
    const base = storeOptions.filter(s => (s.name || s.id || '').toLowerCase().includes(q))
    const limited = base.slice(0, 8)
    return limited
  }, [sendToAll, storeQuery, storeOptions])

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4 sm:gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-4 sm:p-6 border border-gray-100 dark:border-gray-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 rounded-full bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center">
                <Bell size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Central de Notificações</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Envie mensagens para uma loja específica ou para todas.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center">
              <Sparkles size={16} className="text-amber-500 shrink-0" />
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Broadcast</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
            {templates.map(t => (
              <button
                key={t.label}
                type="button"
                onClick={t.fill}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors flex items-center gap-2"
              >
                <Sparkles size={14} className="text-amber-500 shrink-0" />
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-2">Destino</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSendToAll(true)
                    setSelectedStoreId('')
                    setStoreQuery('')
                    setStorePickerOpen(false)
                  }}
                  className={`p-3 sm:p-4 rounded-xl border text-left transition-all ${
                    sendToAll
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-700 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-200 hover:bg-gray-50 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 shrink-0 rounded-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center text-blue-600 dark:text-blue-300">
                      <Globe size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-gray-800 dark:text-gray-100">Todas as lojas</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Envia para todos os clientes (broadcast).</div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSendToAll(false)
                    setStorePickerOpen(true)
                  }}
                  className={`p-3 sm:p-4 rounded-xl border text-left transition-all ${
                    !sendToAll
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-700 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-200 hover:bg-gray-50 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 shrink-0 rounded-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-200">
                      <Building2 size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-gray-800 dark:text-gray-100">Loja específica</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Escolha uma loja para enviar.</div>
                    </div>
                  </div>
                </button>
              </div>

              {!sendToAll && (
                <div className="mt-3" ref={storePickerRef}>
                  <div className="relative">
                    <input
                      className="input w-full !pl-10 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                      value={storeQuery}
                      placeholder="Buscar loja pelo nome..."
                      onChange={(e) => {
                        setStoreQuery(e.target.value)
                        setStorePickerOpen(true)
                      }}
                      onFocus={() => setStorePickerOpen(true)}
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none">
                      <Search size={16} />
                    </div>
                  </div>

                  {selectedStore && (
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-semibold">
                      <Store size={14} className="shrink-0" />
                      <span className="truncate max-w-[200px]">{selectedStore.name || selectedStore.id}</span>
                      <button
                        type="button"
                        className="text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 ml-0.5"
                        onClick={() => {
                          setSelectedStoreId('')
                          setStoreQuery('')
                          setStorePickerOpen(true)
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {storePickerOpen && (
                    <div className="mt-2 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg bg-white dark:bg-gray-900 overflow-hidden">
                      {filteredStores.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Nenhuma loja encontrada.</div>
                      ) : (
                        <div className="divide-y divide-gray-50 dark:divide-gray-800">
                          {filteredStores.map(s => (
                            <button
                              type="button"
                              key={s.id}
                              onClick={() => {
                                setSelectedStoreId(s.id)
                                setStoreQuery(String(s.name || s.id || '').trim())
                                setStorePickerOpen(false)
                              }}
                              className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors ${
                                selectedStoreId === s.id ? 'bg-blue-50 dark:bg-blue-950/40' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{s.name || s.id}</div>
                                  <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{s.id}</div>
                                </div>
                                {selectedStoreId === s.id ? (
                                  <div className="text-blue-600 dark:text-blue-400 text-xs font-bold shrink-0">Selecionada</div>
                                ) : null}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-2">Tipo</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { id: 'info', label: 'Info', icon: Info },
                  { id: 'success', label: 'Sucesso', icon: CheckCircle },
                  { id: 'warning', label: 'Aviso', icon: AlertTriangle },
                  { id: 'error', label: 'Erro', icon: AlertCircle },
                ].map(it => {
                  const Icon = it.icon
                  const active = type === it.id
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => setType(it.id)}
                      className={`px-3 py-2 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                        active
                          ? `${borderForType(it.id)} ${colorForType(it.id)} dark:!bg-opacity-80 shadow-sm`
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      <Icon size={16} className="shrink-0" />
                      <span className="truncate">{it.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">Título</label>
              <input
                className="input w-full dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Atualização do sistema"
                maxLength={80}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">Mensagem</label>
              <textarea
                className="input w-full min-h-[140px] resize-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escreva a mensagem que aparecerá para as lojas..."
                maxLength={500}
              />
              <div className="mt-1 text-[11px] text-gray-400 dark:text-gray-500 flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2">
                <span className="truncate">
                  {sendToAll ? 'Destino: Todas as lojas' : (selectedStore?.name ? `Destino: ${selectedStore.name}` : 'Destino: —')}
                </span>
                <span className="text-right">{String(message || '').length}/500</span>
              </div>
            </div>
          </div>

          {error && <div className="mt-4 text-sm text-red-600 dark:text-red-400 font-semibold">{error}</div>}
          {sentOk && <div className="mt-4 text-sm text-green-600 dark:text-green-400 font-semibold">Notificação enviada com sucesso.</div>}

          <div className="mt-4 sm:mt-5 flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-2">
            <div className="text-[11px] text-gray-500 dark:text-gray-400 order-last sm:order-first">
              {canSend ? 'Pronto para enviar.' : 'Preencha título, mensagem e selecione o destino.'}
            </div>
            <button
              type="button"
              onClick={send}
              disabled={!canSend}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2"
            >
              <Send size={16} className="shrink-0" />
              <span>{sending ? 'Enviando...' : 'Enviar notificação'}</span>
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-4 sm:p-6 border border-gray-100 dark:border-gray-800">
          <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-4">Pré-visualização</h4>
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/40 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Como vai aparecer nas lojas</span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold shrink-0">Agora</span>
            </div>
            <div className="p-3 sm:p-4">
              <div className="flex gap-3">
                <div className={`p-2 rounded-full h-fit shrink-0 ${colorForType(preview.type)}`}>
                  <PreviewIcon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{preview.title}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mt-1">{preview.message}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 sm:mt-6">
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">Últimas notificações</h4>
            <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800 border border-gray-100 dark:border-gray-800 rounded-lg">
              {recent.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Nenhuma notificação enviada ainda.</div>
              ) : (
                recent.slice(0, 20).map(n => {
                  const Icon = iconForType(String(n.type || 'info').toLowerCase())
                  const targetLabel =
                    n.storeId === getGlobalStoreId()
                      ? 'Todas as lojas'
                      : (stores.find(s => s.id === n.storeId)?.name || n.storeId || '—')
                  return (
                    <div key={n.id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full shrink-0 ${colorForType(String(n.type || 'info').toLowerCase())}`}>
                          <Icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{n.title || '—'}</div>
                            <div className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold whitespace-nowrap shrink-0">{formatTime(n.createdAt) || targetLabel}</div>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">{n.message || ''}</div>
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold mt-1 truncate">{targetLabel}</div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminApp() {
  const [user, setUser] = useState(null)
  const [view, setView] = useState('dashboard')
  const [managedStoreId, setManagedStoreId] = useState(null)
  const [storeSettingsId, setStoreSettingsId] = useState(null)

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

  if (managedStoreId) {
    return <AdminStoreView storeId={managedStoreId} onExit={() => setManagedStoreId(null)} />
  }
  
  if (storeSettingsId) {
    return <AdminStoreSettings storeId={storeSettingsId} onExit={() => setStoreSettingsId(null)} />
  }

  return (
    <AdminLayout user={user} onViewChange={setView} currentView={view} onLogout={handleLogout}>
      {view === 'dashboard' && <AdminDashboard />}
      {view === 'stores' && <ManageStores onManageStore={setManagedStoreId} onOpenSettings={setStoreSettingsId} />}
      {view === 'users' && <ManageUsers />}
      {view === 'notifications' && <AdminNotificationsPage adminUser={user} />}
      {view === 'trials' && <AdminTrialUsers />}
    </AdminLayout>
  )
}
