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
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
        <div className="p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
            {initialData ? 'Editar Categoria' : 'Nova Categoria'}
          </h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* Nome */}
          <div>
            <input
              type="text"
              placeholder="Nome"
              className="w-full rounded border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Tipo e Status */}
          <div className="flex items-center justify-between">
            {/* Seletor de Tipo */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded p-1">
              <button
                type="button"
                onClick={() => setType('in')}
                className={`px-3 py-1 rounded text-sm font-medium transition ${
                  type === 'in' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                Entrada
              </button>
              <button
                type="button"
                onClick={() => setType('out')}
                className={`px-3 py-1 rounded text-sm font-medium transition ${
                  type === 'out' ? 'bg-white dark:bg-gray-600 shadow text-gray-800 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
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
              <span className="text-sm text-gray-700 dark:text-gray-300">Ativo</span>
            </div>
          </div>

        </form>

        <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between gap-3">
          {initialData && onDelete ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Tem certeza que deseja excluir esta categoria?')) {
                  onDelete(initialData.id)
                }
              }}
              className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 flex items-center gap-1"
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
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
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
