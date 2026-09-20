import React, { useState, useEffect } from 'react'
import { Plus, Search, Loader2 } from 'lucide-react'
import { listenUsers, addUser, deleteUser, updateUser } from '../../services/users'
import CreateUserModal from '../components/CreateUserModal'

export default function ManageUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    const unsub = listenUsers((data) => {
      setUsers(data)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreateUser = async (userData) => {
    try {
      await addUser(userData)
      setShowModal(false)
    } catch (error) {
      console.error('Erro ao criar usuário:', error)
      const msg = [error?.code, error?.message].filter(Boolean).join(' — ')
      alert(`Erro ao criar usuário${msg ? `: ${msg}` : ''}`)
    }
  }

  const handleDeleteUser = async (userId) => {
    setDeletingId(userId)
    try {
      await deleteUser(userId)
      setDeleteTarget(null)
    } catch (error) {
      console.error('Erro ao excluir usuário:', error)
      const msg = [error?.code, error?.message].filter(Boolean).join(' — ')
      alert(`Erro ao excluir usuário${msg ? `: ${msg}` : ''}`)
    } finally {
      setDeletingId(null)
    }
  }

  const handleOpenEdit = (user) => {
    setEditingUser(user)
  }

  const handleUpdateUser = async (formData) => {
    if (!editingUser?.id) return
    try {
      const partial = {
        name: formData.name,
        email: formData.email,
        whatsapp: formData.whatsapp,
        active: formData.active
      }
      if (formData.password && formData.password.trim()) {
        partial.password = formData.password.trim()
      }
      await updateUser(editingUser.id, partial)
      setEditingUser(null)
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error)
      const msg = [error?.code, error?.message].filter(Boolean).join(' — ')
      alert(`Erro ao atualizar usuário${msg ? `: ${msg}` : ''}`)
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Buscar usuários..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
          />
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 w-full sm:w-auto"
        >
          <Plus size={18} />
          Novo Usuário
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <>
          {/* DESKTOP / TABLET (md+) — tabela tradicional */}
          <div className="hidden md:block bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden border border-gray-100 dark:border-gray-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[640px]">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium text-sm">
                  <tr>
                    <th className="px-6 py-4 whitespace-nowrap">Nome</th>
                    <th className="px-6 py-4 whitespace-nowrap">Email</th>
                    <th className="px-6 py-4 whitespace-nowrap">WhatsApp</th>
                    <th className="px-6 py-4 whitespace-nowrap">Status</th>
                    <th className="px-6 py-4 whitespace-nowrap">Criado em</th>
                    <th className="px-6 py-4 text-right whitespace-nowrap">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => handleOpenEdit(user)}>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{user.name}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{user.email}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">{user.whatsapp || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.active !== false
                            ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                        }`}>
                          {user.active !== false ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm whitespace-nowrap">
                        {user.createdAt?.seconds ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(user) }}
                          disabled={deletingId === user.id}
                          className="px-3 py-1.5 rounded bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-60"
                        >
                          {deletingId === user.id ? 'Excluindo...' : 'Excluir'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE (<md) — cards colapsados (sem overflow x) */}
          <div className="md:hidden space-y-3">
            {filteredUsers.map(user => (
              <div
                key={user.id}
                className="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-100 dark:border-gray-800 p-3 sm:p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleOpenEdit(user)}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{user.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{user.email}</div>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    user.active !== false
                      ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                  }`}>
                    {user.active !== false ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300 mt-2">
                  <div><span className="text-gray-500 dark:text-gray-400">WhatsApp: </span>{user.whatsapp || '-'}</div>
                  <div><span className="text-gray-500 dark:text-gray-400">Criado em: </span>{user.createdAt?.seconds ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : '-'}</div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(user) }}
                    disabled={deletingId === user.id}
                    className="px-3 py-1.5 rounded bg-red-600 text-white text-xs sm:text-sm hover:bg-red-700 disabled:opacity-60 w-full sm:w-auto"
                  >
                    {deletingId === user.id ? 'Excluindo...' : 'Excluir'}
                  </button>
                </div>
              </div>
            ))}
            {filteredUsers.length === 0 && (
              <div className="py-10 text-center text-gray-500 dark:text-gray-400">
                Nenhum usuário encontrado.
              </div>
            )}
          </div>
        </>
      )}

      {showModal && (
        <CreateUserModal 
          onClose={() => setShowModal(false)}
          onSave={handleCreateUser}
          mode="create"
        />
      )}
      {editingUser && (
        <CreateUserModal
          onClose={() => setEditingUser(null)}
          onSave={handleUpdateUser}
          initialData={editingUser}
          mode="edit"
        />
      )}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-900 rounded-t-lg sm:rounded-lg shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
            <div className="p-5 border-b dark:border-gray-800">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100">Excluir usuário?</h3>
            </div>
            <div className="p-5 text-xs sm:text-sm text-gray-700 dark:text-gray-300 space-y-2">
              <p>Tem certeza que deseja excluir o usuário <b>{deleteTarget.name || deleteTarget.email}</b>?</p>
              <p className="text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 p-2 rounded border border-red-100 dark:border-red-900">
                Isto irá excluir <b>todas as lojas</b> pertencentes a este usuário. Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="p-4 border-t dark:border-gray-800 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 sticky bottom-0 bg-white dark:bg-gray-900">
              <button
                onClick={() => setDeleteTarget(null)}
                className="w-full sm:w-auto px-4 py-2 rounded border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteTarget && handleDeleteUser(deleteTarget.id)}
                disabled={deletingId === deleteTarget.id}
                className="w-full sm:w-auto px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deletingId === deleteTarget.id ? 'Excluindo...' : 'Excluir definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

