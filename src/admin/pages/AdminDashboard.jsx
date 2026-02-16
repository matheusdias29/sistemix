import React, { useState, useEffect } from 'react'
import { listenUsers, updateUser } from '../../services/users'
import { listenAllStores } from '../../services/stores'
import { listenAllSubscriptions } from '../../services/subscriptions'
import { Users, Store, ChevronDown, ChevronRight, User, MoreVertical, UserCheck, Clock, Ban } from 'lucide-react'

export default function AdminDashboard() {
  const [users, setUsers] = useState([])
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedUsers, setExpandedUsers] = useState({})
  const [openMenuUserId, setOpenMenuUserId] = useState(null)
  const [statusModalUser, setStatusModalUser] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState('ativo')
  const [savingStatus, setSavingStatus] = useState(false)
  const [subs, setSubs] = useState([])

  useEffect(() => {
    const unsubUsers = listenUsers((data) => {
      setUsers(data)
    })
    const unsubStores = listenAllStores((data) => {
      setStores(data)
    })
    const unsubSubs = listenAllSubscriptions((data) => {
      setSubs(data)
    })

    return () => {
      unsubUsers()
      unsubStores()
      unsubSubs()
    }
  }, [])

  useEffect(() => {
    if (users.length || stores.length) setLoading(false)
  }, [users, stores])

  const toggleExpand = (userId) => {
    setExpandedUsers(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }))
  }

  const usersWithStores = users.map(user => {
    const userStores = stores.filter(s => s.ownerId === user.id)
    return { ...user, stores: userStores }
  })

  const subsMap = Object.fromEntries(subs.map(s => [s.id, s]))

  const normalizeDate = (d) => {
    if (!d) return null
    try {
      if (typeof d?.toDate === 'function') return d.toDate()
      if (typeof d?.seconds === 'number') return new Date(d.seconds * 1000)
      return new Date(d)
    } catch { return null }
  }

  const getExpiryInfo = (user) => {
    const sub = subsMap[user.id]
    const now = new Date()
    const trialEnd = normalizeDate(sub?.trialEnd) || (user.trialValidUntil ? normalizeDate(user.trialValidUntil) : null)
    const nextDue = normalizeDate(sub?.nextDueDate)
    const refDate = trialEnd || nextDue
    if (!refDate) return { label: 'Sem vencimento', className: 'bg-gray-100 text-gray-700' }
    const diffDays = Math.ceil((refDate.getTime() - now.getTime()) / (24*60*60*1000))
    if (diffDays < 0) {
      return { label: `Expirou em ${refDate.toLocaleDateString()}`, className: 'bg-red-100 text-red-700' }
    }
    if (diffDays <= 3) {
      return { label: `Expira em ${refDate.toLocaleDateString()}`, className: 'bg-amber-100 text-amber-700' }
    }
    return { label: `Expira em ${refDate.toLocaleDateString()}`, className: 'bg-green-100 text-green-700' }
  }

  const getStatusInfo = (user) => {
    const status = user.status || (user.active === false ? 'cancelado' : 'ativo')
    if (status === 'cancelado') {
      return { label: 'Cancelado', className: 'bg-red-100 text-red-700' }
    }
    if (status === 'em_atraso') {
      return { label: 'Em atraso', className: 'bg-yellow-100 text-yellow-700' }
    }
    return { label: 'Ativo', className: 'bg-green-100 text-green-700' }
  }

  const handleOpenStatusModal = (user) => {
    const status = user.status || (user.active === false ? 'cancelado' : 'ativo')
    setSelectedStatus(status)
    setStatusModalUser(user)
  }

  const handleSaveStatus = async () => {
    if (!statusModalUser) return
    setSavingStatus(true)
    try {
      const active = selectedStatus === 'ativo'
      await updateUser(statusModalUser.id, { status: selectedStatus, active })
      setStatusModalUser(null)
    } catch (err) {
      console.error('Erro ao atualizar status do usuário', err)
      alert('Erro ao atualizar status do usuário')
    } finally {
      setSavingStatus(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Dashboard</h2>

      {/* Indicadores de Status de Usuários */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="relative overflow-hidden rounded-xl border border-green-100 bg-gradient-to-br from-green-50 to-white p-6 shadow-sm">
          <div className="absolute -right-6 -top-6 w-28 h-28 bg-green-100 rounded-full opacity-60"></div>
          <div className="flex items-center gap-4 relative">
            <div className="p-3 bg-green-200 text-green-800 rounded-xl">
              <UserCheck size={28} />
            </div>
            <div>
              <div className="text-sm text-green-800 font-medium">Usuários Ativos</div>
              <div className="text-4xl font-extrabold text-green-900 leading-none">
                {users.filter(u => (u.status || (u.active === false ? 'cancelado' : 'ativo')) === 'ativo').length}
              </div>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm">
          <div className="absolute -right-6 -top-6 w-28 h-28 bg-amber-100 rounded-full opacity-60"></div>
          <div className="flex items-center gap-4 relative">
            <div className="p-3 bg-amber-200 text-amber-800 rounded-xl">
              <Clock size={28} />
            </div>
            <div>
              <div className="text-sm text-amber-800 font-medium">Usuários Pendentes</div>
              <div className="text-4xl font-extrabold text-amber-900 leading-none">
                {users.filter(u => (u.status || (u.active === false ? 'cancelado' : 'ativo')) === 'em_atraso').length}
              </div>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-red-100 bg-gradient-to-br from-red-50 to-white p-6 shadow-sm">
          <div className="absolute -right-6 -top-6 w-28 h-28 bg-red-100 rounded-full opacity-60"></div>
          <div className="flex items-center gap-4 relative">
            <div className="p-3 bg-red-200 text-red-800 rounded-xl">
              <Ban size={28} />
            </div>
            <div>
              <div className="text-sm text-red-800 font-medium">Usuários Cancelados</div>
              <div className="text-4xl font-extrabold text-red-900 leading-none">
                {users.filter(u => (u.status || (u.active === false ? 'cancelado' : 'ativo')) === 'cancelado').length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* (Resumo antigo removido conforme solicitação) */}

      <h3 className="text-lg font-semibold mb-4 text-gray-700">Usuários e Lojas</h3>

      <div className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
        {usersWithStores.map(user => {
          const statusInfo = getStatusInfo(user)
          const expiryInfo = getExpiryInfo(user)
          return (
            <div key={user.id} className="border-b border-gray-100 last:border-0">
              <div 
                onClick={() => toggleExpand(user.id)}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors relative"
              >
                <div className="flex items-center gap-3">
                  <button className="text-gray-400">
                    {expandedUsers[user.id] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </button>
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                    <User size={20} />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{user.name}</h4>
                    <p className="text-sm text-gray-500">{user.email}</p>
                    <div className={`mt-1 inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${expiryInfo.className}`}>
                      {expiryInfo.label}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-sm text-right">
                    <span className="block font-medium text-gray-900">{user.stores.length}</span>
                    <span className="text-xs text-gray-500">Lojas</span>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.className}`}>
                    {statusInfo.label}
                  </div>
                  <div className="relative">
                    <button
                      className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
                      onClick={e => {
                        e.stopPropagation()
                        setOpenMenuUserId(openMenuUserId === user.id ? null : user.id)
                      }}
                    >
                      <MoreVertical size={18} />
                    </button>
                    {openMenuUserId === user.id && (
                      <div
                        className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                          onClick={() => {
                            handleOpenStatusModal(user)
                            setOpenMenuUserId(null)
                          }}
                        >
                          Mudar status
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            {/* Lista de Lojas (Expandido) */}
            {expandedUsers[user.id] && (
              <div className="bg-gray-50 p-4 pl-16 border-t border-gray-100">
                {user.stores.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {user.stores.map(store => (
                      <div key={store.id} className="bg-white p-4 rounded border border-gray-200 shadow-sm flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded">
                            <Store size={18} />
                          </div>
                          <div>
                            <h5 className="font-medium text-gray-800">{store.name}</h5>
                            <p className="text-xs text-gray-500">{store.city || 'Sem cidade definida'}</p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400">
                          Criada em {store.createdAt?.seconds ? new Date(store.createdAt.seconds * 1000).toLocaleDateString() : '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Nenhuma loja vinculada a este usuário.</p>
                )}
              </div>
            )}
          </div>
        )})}
        
        {usersWithStores.length === 0 && !loading && (
          <div className="p-8 text-center text-gray-500">
            Nenhum usuário encontrado.
          </div>
        )}
      </div>

      {statusModalUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h4 className="font-semibold text-gray-900">Mudar status</h4>
                <p className="text-xs text-gray-500 mt-0.5">{statusModalUser.email}</p>
              </div>
            </div>
            <div className="px-4 py-4 space-y-3">
              <p className="text-sm text-gray-600">Selecione o novo status deste usuário:</p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSelectedStatus('ativo')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded border text-sm ${
                    selectedStatus === 'ativo'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span>Ativo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatus('em_atraso')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded border text-sm ${
                    selectedStatus === 'em_atraso'
                      ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span>Em atraso</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatus('cancelado')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded border text-sm ${
                    selectedStatus === 'cancelado'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span>Cancelado</span>
                </button>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded"
                onClick={() => setStatusModalUser(null)}
                disabled={savingStatus}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm rounded text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
                onClick={handleSaveStatus}
                disabled={savingStatus}
              >
                {savingStatus ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
