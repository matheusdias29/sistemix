import React, { useState, useEffect } from 'react'
import { listenUsers, updateUser } from '../../services/users'
import { listenAllStores } from '../../services/stores'
import { Users, Store, ChevronDown, ChevronRight, User, MoreVertical } from 'lucide-react'

export default function AdminDashboard() {
  const [users, setUsers] = useState([])
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedUsers, setExpandedUsers] = useState({})
  const [openMenuUserId, setOpenMenuUserId] = useState(null)
  const [statusModalUser, setStatusModalUser] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState('ativo')
  const [savingStatus, setSavingStatus] = useState(false)

  useEffect(() => {
    const unsubUsers = listenUsers((data) => {
      setUsers(data)
    })
    const unsubStores = listenAllStores((data) => {
      setStores(data)
    })

    return () => {
      unsubUsers()
      unsubStores()
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

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Usuários</p>
            <p className="text-2xl font-bold text-gray-800">{users.length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-full">
            <Store size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Lojas</p>
            <p className="text-2xl font-bold text-gray-800">{stores.length}</p>
          </div>
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-4 text-gray-700">Usuários e Lojas</h3>

      <div className="bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
        {usersWithStores.map(user => {
          const statusInfo = getStatusInfo(user)
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
