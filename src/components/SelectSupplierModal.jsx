import React, { useState, useEffect } from 'react'

export default function SelectSupplierModal({ open, onClose, onSelect, suppliers = [], onNew, onEdit, onDelete }) {
  const [query, setQuery] = useState('')
  const [menuOpenId, setMenuOpenId] = useState(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setMenuOpenId(null)
    }
  }, [open])

  if (!open) return null

  const filtered = suppliers.filter(s => (s.name || '').toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="fixed inset-0 z-[10000] bg-black/30 flex items-center justify-center">
      <div className="bg-white w-[520px] max-w-[90vw] rounded-lg shadow-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-semibold text-gray-800">Selecionar fornecedor</div>
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
            className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none transition-all" 
            placeholder="Pesquisar..." 
            autoFocus
          />
          <div className="mt-3 overflow-y-auto divide-y flex-1 border rounded relative">
            <button 
               type="button"
               className="w-full text-left px-3 py-3 hover:bg-gray-50 flex items-center justify-between text-gray-500 italic"
               onClick={() => onSelect(null)}
            >
               <span>Limpar seleção / Todos</span>
            </button>
            {filtered.map((s, idx) => (
              <div key={s.id ?? idx} className="group relative">
                <div className="flex items-center w-full">
                  <button 
                    type="button" 
                    onClick={()=>{ onSelect(s) }} 
                    className="flex-1 text-left px-3 py-3 hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span className="truncate text-gray-700">{s.name || '-'}</span>
                    <span className="text-gray-400">›</span>
                  </button>
                  
                  {(onEdit || onDelete) && (
                    <div className="relative pr-2">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === s.id ? null : s.id);
                        }}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                      </button>

                      {menuOpenId === s.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                          <div className="absolute right-0 mt-1 w-32 bg-white rounded-md shadow-lg border py-1 z-20">
                            {onEdit && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpenId(null);
                                  onEdit(s);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                                Editar
                              </button>
                            )}
                            {onDelete && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpenId(null);
                                  onDelete(s);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                Excluir
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-sm text-gray-500">Nenhum fornecedor encontrado.</div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} className="px-3 py-2 border rounded text-sm hover:bg-gray-50 transition-colors">Fechar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
