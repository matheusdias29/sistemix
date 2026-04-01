import React, { useMemo, useState, useEffect } from 'react'

export default function SelectClientModal({ open, onClose, clients=[], onChoose, onNew, title = 'Selecionar cliente', newItemLabel = 'Novo Cliente', searchPlaceholder = 'Pesquisar por nome...', emptyLabel = 'Nenhum cliente encontrado' }){
  const [query, setQuery] = useState('')
  const PAGE_SIZE = 30
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (open) {
      setPage(1)
    }
  }, [open, query])

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!open) return []
    return (clients||[]).filter(c => 
      (c.name||'').toLowerCase().includes(q) ||
      (String(c.code || '').toLowerCase().includes(q))
    )
  }, [clients, q, open])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1
  const safePage = Math.min(Math.max(1, page), totalPages)
  const displayed = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, safePage])

  const Pagination = () => {
    if (totalPages <= 1) return null

    const renderPageNumbers = () => {
      const pages = []

      pages.push(
        <button
          key={1}
          onClick={() => setPage(1)}
          className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
            safePage === 1
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          1
        </button>
      )

      let start = Math.max(2, safePage - 1)
      let end = Math.min(totalPages - 1, safePage + 1)

      if (safePage <= 3) end = Math.min(totalPages - 1, 4)
      if (safePage >= totalPages - 2) start = Math.max(2, totalPages - 3)

      if (start > 2) pages.push(<span key="dots1" className="text-gray-400 px-1">...</span>)

      for (let i = start; i <= end; i++) {
        pages.push(
          <button
            key={i}
            onClick={() => setPage(i)}
            className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
              safePage === i
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {i}
          </button>
        )
      }

      if (end < totalPages - 1) pages.push(<span key="dots2" className="text-gray-400 px-1">...</span>)

      if (totalPages > 1) {
        pages.push(
          <button
            key={totalPages}
            onClick={() => setPage(totalPages)}
            className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
              safePage === totalPages
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {totalPages}
          </button>
        )
      }

      return pages
    }

    return (
      <div className="flex items-center justify-center gap-2 py-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <button 
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={safePage === 1}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30"
        >
          &lt;
        </button>
        <div className="flex items-center gap-1">
          {renderPageNumbers()}
        </div>
        <button 
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={safePage === totalPages}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30"
        >
          &gt;
        </button>
      </div>
    )
  }

  if(!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 shrink-0">
          <h3 className="font-semibold text-lg text-gray-800 dark:text-white">{title}</h3>
          {onNew && (
            <button 
              onClick={onNew} 
              className="px-3 py-1.5 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-1"
            >
              <span>+</span> {newItemLabel}
            </button>
          )}
        </div>

        {/* Search */}
        <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 shrink-0">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              value={query}
              onChange={e=>setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full border dark:border-gray-600 rounded-lg pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all shadow-sm"
              autoFocus
            />
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex justify-between">
            <span>{filtered.length} encontrados</span>
            {totalPages > 1 && <span>Página {safePage} de {totalPages}</span>}
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
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500 dark:text-gray-400">
              <span className="text-4xl mb-2">👥</span>
              <p>{emptyLabel}</p>
            </div>
          )}
        </div>
        <Pagination />

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
