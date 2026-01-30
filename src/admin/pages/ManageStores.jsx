import React, { useState, useEffect } from 'react'
import { Plus, Search, Loader2, Store } from 'lucide-react'
import { listenAllStores, addStore } from '../../services/stores'
import { listenUsers } from '../../services/users'
import CreateStoreModal from '../components/CreateStoreModal'

export default function ManageStores() {
  const [stores, setStores] = useState([])
  const [users, setUsers] = useState([]) // Para mapear ownerId -> nome
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')

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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text"
            placeholder="Buscar lojas..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus size={20} />
          Nova Loja
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStores.map(store => (
            <div key={store.id} className="bg-white rounded-lg shadow p-6 border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                  <Store size={24} />
                </div>
                <span className="text-xs text-gray-400">
                  {store.createdAt?.seconds ? new Date(store.createdAt.seconds * 1000).toLocaleDateString() : '-'}
                </span>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{store.name}</h3>
              
              <div className="space-y-2 mt-4 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Dono:</span>
                  <span className="font-medium text-gray-900">{getOwnerName(store.ownerId)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cidade:</span>
                  <span className="font-medium text-gray-900">{store.city || '-'}</span>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-50 flex justify-end">
                 <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                   Gerenciar
                 </button>
              </div>
            </div>
          ))}
          
          {filteredStores.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
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
    </div>
  )
}
