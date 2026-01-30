import React, { useState, useEffect } from 'react'

export default function SelectSupplierModal({ open, onClose, onSelect, suppliers = [], onNew }) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  if (!open) return null

  const filtered = suppliers.filter(s => (s.name || '').toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="fixed inset-0 z-[10000] bg-black/30 flex items-center justify-center">
      <div className="bg-white w-[520px] max-w-[90vw] rounded-lg shadow-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-semibold">Selecionar fornecedor</div>
          {onNew && (
            <button type="button" onClick={onNew} className="px-2 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-1">
              <span className="text-lg leading-none pb-1">+</span> Novo
            </button>
          )}
        </div>
        <div className="p-3 flex-1 overflow-hidden flex flex-col">
          <input 
            value={query} 
            onChange={e=>setQuery(e.target.value)} 
            className="w-full border rounded px-3 py-2 text-sm" 
            placeholder="Pesquisar..." 
            autoFocus
          />
          <div className="mt-3 overflow-y-auto divide-y flex-1 border rounded">
            <button 
               type="button"
               className="w-full text-left px-3 py-3 hover:bg-gray-50 flex items-center justify-between text-gray-500 italic"
               onClick={() => onSelect(null)}
            >
               <span>Limpar seleção / Todos</span>
            </button>
            {filtered.map((s, idx) => (
              <button key={s.id ?? idx} type="button" onClick={()=>{ onSelect(s) }} className="w-full text-left px-3 py-3 hover:bg-gray-50 flex items-center justify-between">
                <span className="truncate">{s.name || '-'}</span>
                <span className="text-gray-400">›</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-sm text-gray-500">Nenhum fornecedor encontrado.</div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} className="px-3 py-2 border rounded text-sm">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
