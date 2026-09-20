import React, { useState, useEffect } from 'react'
import { Plus, Search, Loader2, Store } from 'lucide-react'
import { listenAllStores, addStore, deleteStore } from '../../services/stores'
import { listenUsers } from '../../services/users'
import CreateStoreModal from '../components/CreateStoreModal'

export default function ManageStores({ onManageStore, onOpenSettings }) {
  const [stores, setStores] = useState([])
  const [users, setUsers] = useState([]) // Para mapear ownerId -> nome
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const unsubStores = listenAllStores((data) => {
      setStores(data)
      setLoading(false)
    })
    
    // Precisamos dos usuários para mostrar o nome do dono
    const unsubUsers = listenUsers((data) => {
      setUsers(data)
    })

    return () => {
      unsubStores()
      unsubUsers()
    }
  }, [])

  const filteredStores = stores.filter(s => 
    s.name?.toLowerCase().includes(search.toLowerCase())
  )

  const getOwnerName = (ownerId) => {
    const u = users.find(user => user.id === ownerId)
    return u ? u.name : 'Desconhecido'
  }

  const handleCreateStore = async (storeData) => {
    try {
      await addStore(storeData)
      setShowModal(false)
    } catch (error) {
      console.error('Erro ao criar loja:', error)
      alert('Erro ao criar loja')
    }
  }

  const handleDeleteStore = (store) => {
    setDeleteTarget(store)
    setConfirmDeleteOpen(true)
  }
  
  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      await deleteStore(deleteTarget.id)
      setDeleting(false)
      setConfirmDeleteOpen(false)
      setDeleteTarget(null)
    } catch (error) {
      setDeleting(false)
      console.error('Erro ao excluir loja:', error)
      alert('Erro ao excluir loja')
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Buscar lojas..."
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
          Nova Loja
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
          {filteredStores.map(store => (
            <div 
              key={store.id} 
              className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 sm:p-6 border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onOpenSettings && onOpenSettings(store.id)}
            >
              <div className="flex items-start justify-between mb-3 sm:mb-4 gap-3">
                <div className="p-2 sm:p-3 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 rounded-lg shrink-0">
                  <Store size={22} />
                </div>
                <span className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500 shrink-0">
                  {store.createdAt?.seconds ? new Date(store.createdAt.seconds * 1000).toLocaleDateString() : '-'}
                </span>
              </div>
              
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 truncate">{store.name}</h3>
              
              <div className="space-y-1.5 mt-3 sm:mt-4 text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-gray-500 dark:text-gray-400 shrink-0">Dono:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 text-right break-all">{getOwnerName(store.ownerId)}</span>
                </div>
                <div className="flex justify-between items-start gap-2">
                  <span className="text-gray-500 dark:text-gray-400 shrink-0">Cidade:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 text-right break-all">{store.city || '-'}</span>
                </div>
              </div>
              
              <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-gray-50 dark:border-gray-800 flex justify-end gap-2 sm:gap-3">
                 <button 
                   onClick={(e) => { e.stopPropagation(); onManageStore && onManageStore(store.id) }}
                   className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-xs sm:text-sm font-medium px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40"
                 >
                   Gerenciar
                 </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteStore(store) }}
                  className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs sm:text-sm font-medium px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
          
          {filteredStores.length === 0 && (
            <div className="col-span-full text-center py-10 sm:py-12 text-gray-500 dark:text-gray-400">
              Nenhuma loja encontrada.
            </div>
          )}
        </div>
      )}

      {showModal && (
        <CreateStoreModal 
          users={users}
          onClose={() => setShowModal(false)} 
          onSave={handleCreateStore} 
        />
      )}
      
      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/40"></div>
          <div className="relative bg-white dark:bg-gray-900 rounded-t-lg sm:rounded-lg shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-300 flex items-center justify-center font-bold">!</div>
                <div className="min-w-0">
                  <div className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Excluir loja</div>
                  <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1">Tem certeza que deseja excluir {deleteTarget?.name || 'esta loja'}? Esta ação não pode ser desfeita.</div>
                </div>
              </div>
              <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
                <button 
                  className="w-full sm:w-auto px-4 py-2 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                  onClick={() => { if (!deleting) { setConfirmDeleteOpen(false); setDeleteTarget(null) } }}
                  disabled={deleting}
                >
                  Cancelar
                </button>
                <button 
                  className={`w-full sm:w-auto px-4 py-2 rounded bg-red-600 text-white ${deleting ? 'opacity-60' : 'hover:bg-red-700'}`}
                  onClick={confirmDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

