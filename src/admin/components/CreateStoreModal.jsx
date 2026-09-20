import React, { useState } from 'react'
import { X } from 'lucide-react'

export default function CreateStoreModal({ users, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    ownerId: '',
    city: '',
    state: ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.ownerId) {
      alert('Selecione um dono para a loja')
      return
    }
    setLoading(true)
    await onSave(formData)
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-lg sm:rounded-lg shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white rounded-t-lg z-10">
          <h3 className="font-semibold text-lg">Nova Loja</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1 -mr-1 rounded hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Loja</label>
            <input
              type="text"
              required
              className="w-full border rounded px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dono (Usuário)</label>
            <select
              required
              className="w-full border rounded px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              value={formData.ownerId}
              onChange={e => setFormData({...formData, ownerId: e.target.value})}
            >
              <option value="">Selecione um usuário...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">O usuário selecionado terá acesso total a esta loja.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.city}
                onChange={e => setFormData({...formData, city: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.state}
                onChange={e => setFormData({...formData, state: e.target.value})}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-4 border-t mt-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Criando...' : 'Criar Loja'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
