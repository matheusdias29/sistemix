import React, { useState, useEffect } from 'react'
import { listenSuppliers } from '../services/suppliers'

export default function SelectSupplierModal({ onClose, onSelect, storeId }) {
  const [suppliers, setSuppliers] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!storeId) return
    const unsub = listenSuppliers((items) => {
      setSuppliers(items)
    }, storeId)
    return () => unsub()
  }, [storeId])

  const filtered = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    (s.cnpj && s.cnpj.includes(search))
  )

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-semibold text-gray-700">Selecionar Fornecedor</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        
        <div className="p-4 border-b">
          <input
            type="text"
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
            placeholder="Buscar fornecedor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">Nenhum fornecedor encontrado.</div>
          ) : (
            <div className="space-y-1">
              {filtered.map(s => (
                <button
                  key={s.id}
                  onClick={() => onSelect(s)}
                  className="w-full text-left px-3 py-3 hover:bg-gray-50 rounded flex flex-col transition-colors border-b last:border-0 border-gray-100"
                >
                  <span className="font-medium text-gray-800">{s.name}</span>
                  {s.cnpj && <span className="text-xs text-gray-500">CNPJ: {s.cnpj}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
