import React, { useState } from 'react'

export default function SelectClientModal({ open, onClose, clients=[], onChoose, onNew }){
  const [query, setQuery] = useState('')
  if(!open) return null

  const filtered = (clients||[]).filter(c => (c.name||'').toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[70]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-[700px] max-w-[95vw]">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h3 className="font-semibold text-lg dark:text-white">Selecionar cliente</h3>
          <button onClick={onNew} className="px-3 py-1 rounded text-xs bg-green-600 text-white hover:bg-green-700">+ Novo</button>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={e=>setQuery(e.target.value)}
              placeholder="Pesquisar..."
              className="flex-1 border dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
              autoFocus
            />
          </div>
          <div className="mt-3 max-h-[60vh] overflow-y-auto">
            {filtered.map(c => (
              <div key={c.id} className="grid grid-cols-[1fr_2rem] items-center gap-3 px-2 py-3 border-b dark:border-gray-700 last:border-0 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors" onClick={()=>onChoose && onChoose(c)}>
                <div className="font-medium dark:text-gray-200">{c.name}</div>
                <div className="text-right text-gray-400 dark:text-gray-500">›</div>
              </div>
            ))}
            {filtered.length===0 && (
              <div className="px-2 py-3 text-sm text-gray-600 dark:text-gray-400">Nenhum cliente encontrado.</div>
            )}
          </div>
        </div>
        <div className="p-4 border-t dark:border-gray-700 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 border dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors">Fechar</button>
        </div>
      </div>
    </div>
  )
}