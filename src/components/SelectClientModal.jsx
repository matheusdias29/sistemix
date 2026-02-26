import React, { useState, useEffect } from 'react'

export default function SelectClientModal({ open, onClose, clients=[], onChoose, onNew }){
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(20)

  // Reset limit when query changes or modal opens
  useEffect(() => {
    if (open) {
      setLimit(20)
    }
  }, [open, query])

  if(!open) return null

  const filtered = (clients||[]).filter(c => (c.name||'').toLowerCase().includes(query.trim().toLowerCase()))
  const displayed = filtered.slice(0, limit)
  const hasMore = filtered.length > limit

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 shrink-0">
          <h3 className="font-semibold text-lg text-gray-800 dark:text-white">Selecionar cliente</h3>
          <button 
            onClick={onNew} 
            className="px-3 py-1.5 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-1"
          >
            <span>+</span> Novo Cliente
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 shrink-0">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              value={query}
              onChange={e=>setQuery(e.target.value)}
              placeholder="Pesquisar por nome..."
              className="w-full border dark:border-gray-600 rounded-lg pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all shadow-sm"
              autoFocus
            />
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex justify-between">
            <span>{filtered.length} clientes encontrados</span>
            {hasMore && <span>Mostrando {limit} primeiros</span>}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
          {displayed.length > 0 ? (
            <div className="space-y-1">
              {displayed.map(c => (
                <div 
                  key={c.id} 
                  onClick={() => onChoose && onChoose(c)}
                  className="group flex items-center justify-between p-3 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 border border-transparent hover:border-green-200 dark:hover:border-green-800 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 font-medium text-xs group-hover:bg-green-100 dark:group-hover:bg-green-800 group-hover:text-green-700 dark:group-hover:text-green-300 transition-colors">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-800 dark:text-gray-200 group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors">{c.name}</div>
                    </div>
                  </div>
                  <div className="text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                    ›
                  </div>
                </div>
              ))}
              
              {hasMore && (
                <button 
                  onClick={() => setLimit(l => l + 20)}
                  className="w-full py-3 text-sm text-center text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg font-medium transition-colors mt-2"
                >
                  Carregar mais...
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500 dark:text-gray-400">
              <span className="text-4xl mb-2">👥</span>
              <p>Nenhum cliente encontrado</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 shrink-0 flex justify-end">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 border dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 hover:text-red-600 dark:hover:text-red-400 transition-all shadow-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}