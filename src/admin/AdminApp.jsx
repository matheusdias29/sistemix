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
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center">
                <Bell size={18} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Central de Notificações</h3>
                <p className="text-xs text-gray-500">Envie mensagens para uma loja específica ou para todas.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-amber-500" />
              <span className="text-xs font-semibold text-gray-600">Broadcast</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {templates.map(t => (
              <button
                key={t.label}
                type="button"
                onClick={t.fill}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center gap-2"
              >
                <Sparkles size={14} className="text-amber-500" />
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-2">Destino</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSendToAll(true)
                    setSelectedStoreId('')
                    setStoreQuery('')
                    setStorePickerOpen(false)
                  }}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    sendToAll ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-blue-600">
                      <Globe size={18} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-gray-800">Todas as lojas</div>
                      <div className="text-xs text-gray-500 mt-0.5">Envia para todos os clientes (broadcast).</div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSendToAll(false)
                    setStorePickerOpen(true)
                  }}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    !sendToAll ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-700">
                      <Building2 size={18} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-gray-800">Loja específica</div>
                      <div className="text-xs text-gray-500 mt-0.5">Escolha uma loja para enviar.</div>
                    </div>
                  </div>
                </button>
              </div>

              {!sendToAll && (
                <div className="mt-3" ref={storePickerRef}>
                  <div className="relative">
                    <input
                      className="input w-full pl-10"
                      value={storeQuery}
                      placeholder="Buscar loja pelo nome..."
                      onChange={(e) => {
                        setStoreQuery(e.target.value)
                        setStorePickerOpen(true)
                      }}
                      onFocus={() => setStorePickerOpen(true)}
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Search size={16} />
                    </div>
                  </div>

                  {selectedStore && (
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
                      <Store size={14} />
                      <span>{selectedStore.name || selectedStore.id}</span>
                      <button
                        type="button"
                        className="text-gray-500 hover:text-red-600"
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
                    <div className="mt-2 rounded-xl border border-gray-100 shadow-lg bg-white overflow-hidden">
                      {filteredStores.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500">Nenhuma loja encontrada.</div>
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {filteredStores.map(s => (
                            <button
                              type="button"
                              key={s.id}
                              onClick={() => {
                                setSelectedStoreId(s.id)
                                setStoreQuery(String(s.name || s.id || '').trim())
                                setStorePickerOpen(false)
                              }}
                              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                                selectedStoreId === s.id ? 'bg-blue-50' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-bold text-gray-800 truncate">{s.name || s.id}</div>
                                  <div className="text-[11px] text-gray-400 truncate">{s.id}</div>
                                </div>
                                {selectedStoreId === s.id ? (
                                  <div className="text-blue-600 text-xs font-bold">Selecionada</div>
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
              <label className="block text-xs font-bold text-gray-600 mb-2">Tipo</label>
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
                        active ? `${borderForType(it.id)} ${colorForType(it.id)} shadow-sm` : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <Icon size={16} />
                      <span>{it.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1">Título</label>
              <input
                className="input w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Atualização do sistema"
                maxLength={80}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1">Mensagem</label>
              <textarea
                className="input w-full min-h-[140px] resize-none"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escreva a mensagem que aparecerá para as lojas..."
                maxLength={500}
              />
              <div className="mt-1 text-[11px] text-gray-400 flex justify-between">
                <span>
                  {sendToAll ? 'Destino: Todas as lojas' : (selectedStore?.name ? `Destino: ${selectedStore.name}` : 'Destino: —')}
                </span>
                <span>{String(message || '').length}/500</span>
              </div>
            </div>
          </div>

          {error && <div className="mt-4 text-sm text-red-600 font-semibold">{error}</div>}
          {sentOk && <div className="mt-4 text-sm text-green-600 font-semibold">Notificação enviada com sucesso.</div>}

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={send}
              disabled={!canSend}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm flex items-center gap-2"
            >
              <Send size={16} />
              <span>{sending ? 'Enviando...' : 'Enviar notificação'}</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
          <h4 className="text-sm font-bold text-gray-700 mb-4">Pré-visualização</h4>
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="p-4 bg-gray-50 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-600">Como vai aparecer nas lojas</span>
              <span className="text-[10px] text-gray-400 font-semibold">Agora</span>
            </div>
            <div className="p-4">
              <div className="flex gap-3">
                <div className={`p-2 rounded-full h-fit ${colorForType(preview.type)}`}>
                  <PreviewIcon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-800 truncate">{preview.title}</div>
                  <div className="text-xs text-gray-600 leading-relaxed mt-1">{preview.message}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-bold text-gray-700 mb-3">Últimas notificações</h4>
            <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-lg">
              {recent.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">Nenhuma notificação enviada ainda.</div>
              ) : (
                recent.slice(0, 20).map(n => {
                  const Icon = iconForType(String(n.type || 'info').toLowerCase())
                  const targetLabel =
                    n.storeId === getGlobalStoreId()
                      ? 'Todas as lojas'
                      : (stores.find(s => s.id === n.storeId)?.name || n.storeId || '—')
                  return (
                    <div key={n.id} className="p-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${colorForType(String(n.type || 'info').toLowerCase())}`}>
                          <Icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-bold text-gray-800 truncate">{n.title || '—'}</div>
                            <div className="text-[10px] text-gray-400 font-semibold whitespace-nowrap">{formatTime(n.createdAt) || targetLabel}</div>
                          </div>
                          <div className="text-xs text-gray-600 mt-1 line-clamp-2">{n.message || ''}</div>
                          <div className="text-[10px] text-gray-400 font-semibold mt-1">{targetLabel}</div>
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
