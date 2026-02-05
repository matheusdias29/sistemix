import React, { useState, useEffect } from 'react'

export default function SelectCategoryModal({ open, onClose, onSelect, categories = [], onNew }) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  if (!open) return null

  const filtered = categories.filter(c => (c.name || '').toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="fixed inset-0 z-[70] bg-black/30 flex items-center justify-center">
      <div className="bg-white w-[520px] max-w-[90vw] rounded-lg shadow-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-semibold">Selecionar categoria</div>
          {onNew && (
            <button type="button" onClick={onNew} className="px-2 py-1 text-sm rounded bg-green-600 text-white">+ Nova</button>
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
               <span>Limpar seleção / Todas</span>
            </button>
            {filtered.map(c => (
              <button key={c.id} type="button" onClick={()=>{ onSelect(c) }} className="w-full text-left px-3 py-3 hover:bg-gray-50 flex items-center justify-between">
                <span className="truncate">{c.name}</span>
                <span className="text-gray-400">›</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-sm text-gray-500">Nenhuma categoria encontrada.</div>
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
