import React, { useState, useEffect } from 'react'

export default function SearchSelectionModal({ 
  open, 
  onClose, 
  title, 
  items = [], 
  onSelect, 
  onNew 
}) {
  const [search, setSearch] = useState('')
  const [filteredItems, setFilteredItems] = useState([])

  useEffect(() => {
    if (open) {
      setSearch('')
    }
  }, [open])

  useEffect(() => {
    const s = search.toLowerCase()
    setFilteredItems(
      items.filter(item => 
        (item.name || '').toLowerCase().includes(s)
      )
    )
  }, [items, search])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden max-h-[90vh] animate-scale-in">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          {onNew && (
            <button 
              onClick={onNew}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded transition-colors flex items-center gap-1"
            >
              + Novo
            </button>
          )}
        </div>

        {/* Search */}
        <div className="p-4 bg-white">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 bg-gray-100 border-transparent rounded-lg text-sm focus:bg-white focus:border-green-500 focus:ring-0 transition-colors placeholder-gray-400"
              placeholder="Pesquisar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto bg-white">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              Nenhum item encontrado.
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {filteredItems.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => onSelect(item)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex justify-between items-center group"
                  >
                    <span className="text-gray-700 font-medium group-hover:text-gray-900">
                      {item.name}
                    </span>
                    <svg className="h-4 w-4 text-gray-300 group-hover:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer (Cancel only) */}
        <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-center">
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-sm font-medium"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
