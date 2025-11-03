import React, { useState } from 'react'

export default function SelectClientModal({ open, onClose, clients=[], onChoose, onNew }){
  const [query, setQuery] = useState('')
  if(!open) return null

  const filtered = (clients||[]).filter(c => (c.name||'').toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[70]">
      <div className="bg-white rounded-lg shadow-lg w-[700px] max-w-[95vw]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Selecionar cliente</h3>
          <button onClick={onNew} className="px-3 py-1 rounded text-xs bg-green-600 text-white">+ Novo</button>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={e=>setQuery(e.target.value)}
              placeholder="Pesquisar..."
              className="flex-1 border rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-3 max-h-[60vh] overflow-y-auto">
            {filtered.map(c => (
              <div key={c.id} className="grid grid-cols-[1fr_2rem] items-center gap-3 px-2 py-3 border-b last:border-0 text-sm cursor-pointer" onClick={()=>onChoose && onChoose(c)}>
                <div className="font-medium">{c.name}</div>
                <div className="text-right text-gray-400">›</div>
              </div>
            ))}
            {filtered.length===0 && (
              <div className="px-2 py-3 text-sm text-gray-600">Nenhum cliente encontrado.</div>
            )}
          </div>
        </div>
        <div className="p-4 border-t flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 border rounded text-sm">Fechar</button>
        </div>
      </div>
    </div>
  )
}