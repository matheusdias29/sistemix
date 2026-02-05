import React, { useState } from 'react'

export default function SelectChecklistModal({ open, onClose, checklists, onChoose }) {
  const [query, setQuery] = useState('')

  if (!open) return null

  const filtered = (checklists || []).filter(cl => 
    (cl.name || '').toLowerCase().includes(query.trim().toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[680px] max-w-[95vw]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Selecionar Checklist</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="p-4">
          <input 
            value={query} 
            onChange={e => setQuery(e.target.value)} 
            placeholder="Pesquisar..." 
            className="w-full border rounded px-3 py-2 text-sm" 
            autoFocus
          />
          <div className="mt-3 max-h-[60vh] overflow-y-auto">
            {filtered.map(cl => (
              <div 
                key={cl.id} 
                className="grid grid-cols-[1fr_8rem] items-center gap-3 px-2 py-3 border-b last:border-0 text-sm cursor-pointer hover:bg-gray-50" 
                onClick={() => onChoose(cl)}
              >
                <div>
                  <div className="font-medium">{cl.name}</div>
                  <div className="text-xs text-gray-500">{(cl.questions || []).length} perguntas</div>
                </div>
                <div className="text-right">
                  {cl.active ? (
                    <span className="text-green-600 bg-green-100 px-2 py-1 rounded-full text-xs">Ativo</span>
                  ) : (
                    <span className="text-gray-600 bg-gray-100 px-2 py-1 rounded-full text-xs">Inativo</span>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-8 text-gray-500">Nenhum checklist encontrado</div>
            )}
          </div>
        </div>
        <div className="p-4 border-t flex items-center justify-end">
          <button type="button" onClick={onClose} className="px-3 py-2 border rounded text-sm hover:bg-gray-50">Cancelar</button>
        </div>
      </div>
    </div>
  )
}
