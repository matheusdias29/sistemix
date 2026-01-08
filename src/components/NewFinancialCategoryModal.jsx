import React, { useState, useEffect } from 'react'
import Switch from './Switch'

export default function NewFinancialCategoryModal({ onClose, onSave, onDelete, isLoading, initialData }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('in') // 'in' or 'out'
  const [active, setActive] = useState(true)

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '')
      setType(initialData.type || 'out') // Default to 'out' if undefined, or keep 'in' as default
      setActive(initialData.active ?? true)
    } else {
      setName('')
      setType('in')
      setActive(true)
    }
  }, [initialData])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ 
      id: initialData?.id,
      name, 
      type, 
      active 
    })
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            {initialData ? 'Editar Categoria' : 'Nova Categoria'}
          </h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* Nome */}
          <div>
            <input
              type="text"
              placeholder="Nome"
              className="w-full rounded border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Tipo e Status */}
          <div className="flex items-center justify-between">
            {/* Seletor de Tipo */}
            <div className="flex bg-gray-100 rounded p-1">
              <button
                type="button"
                onClick={() => setType('in')}
                className={`px-3 py-1 rounded text-sm font-medium transition ${
                  type === 'in' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Entrada
              </button>
              <button
                type="button"
                onClick={() => setType('out')}
                className={`px-3 py-1 rounded text-sm font-medium transition ${
                  type === 'out' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Saída
              </button>
            </div>

            {/* Toggle Ativo */}
            <div className="flex items-center gap-2">
              <Switch 
                checked={active} 
                onChange={setActive} 
                className="" // Remove default flex behavior from wrapper if needed, but Switch handles it
              />
              <span className="text-sm text-gray-700">Ativo</span>
            </div>
          </div>

        </form>

        <div className="p-4 border-t bg-gray-50 flex justify-between gap-3">
          {initialData && onDelete ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Tem certeza que deseja excluir esta categoria?')) {
                  onDelete(initialData.id)
                }
              }}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800 flex items-center gap-1"
            >
              🗑 Excluir
            </button>
          ) : (
             <div></div> 
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded shadow-sm disabled:opacity-50"
              disabled={isLoading || !name.trim()}
            >
              {isLoading ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
