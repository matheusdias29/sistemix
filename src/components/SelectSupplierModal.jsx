import React, { useState, useEffect, useMemo } from 'react'

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

  const q = query.trim().toLowerCase()
  const qDigits = q.replace(/\D/g, '')
  const filtered = useMemo(() => {
    return suppliers.filter(s => {
      const name = String(s.name || '').toLowerCase()
      const code = String(s.code || '').toLowerCase()
      const reference = String(s.reference || '').toLowerCase()
      const contact = String(s.contact || '').toLowerCase()
      const phone = String(s.phone || '').toLowerCase()
      const phoneDigits = String(s.phone || s.cellphone || '').replace(/\D/g, '')
      const cnpj = String(s.cnpj || s.cpf || s.cpfCnpj || '').toLowerCase()
      const cnpjDigits = String(s.cnpj || s.cpf || s.cpfCnpj || '').replace(/\D/g, '')
      const email = String(s.email || '').toLowerCase()

      if (name.includes(q)) return true
      if (code.includes(q)) return true
      if (reference.includes(q)) return true
      if (contact.includes(q)) return true
      if (email.includes(q)) return true
      if (phone.includes(q)) return true
      if (cnpj && cnpj.includes(q)) return true

      if (qDigits) {
        if (phoneDigits && phoneDigits.includes(qDigits)) return true
        if (cnpjDigits && cnpjDigits.includes(qDigits)) return true
      }
      return false
    })
  }, [suppliers, q, qDigits])

  return (
    <div className="fixed inset-0 z-[10000] bg-black/30 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 w-[520px] max-w-[90vw] rounded-lg shadow-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-3 border-b dark:border-gray-700">
          <div className="font-semibold text-gray-800 dark:text-white">Selecionar fornecedor</div>
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
            className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none transition-all" 
            placeholder="Pesquisar por nome, código, CNPJ, telefone..." 
            autoFocus
          />
          <div className="mt-3 overflow-y-auto divide-y dark:divide-gray-700 flex-1 border dark:border-gray-600 rounded relative">
            <button 
               type="button"
               className="w-full text-left px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between text-gray-500 dark:text-gray-400 italic"
               onClick={() => onSelect(null)}
            >
               <span>Limpar seleção / Todos</span>
            </button>
            {filtered.map((s, idx) => {
              const metaBits = []
              if (s.code) metaBits.push(`Cód. ${s.code}`)
              if (s.reference) metaBits.push(`Ref. ${s.reference}`)
              if (s.cnpj || s.cpf || s.cpfCnpj) metaBits.push(s.cnpj || s.cpf || s.cpfCnpj)
              if (s.phone || s.cellphone) metaBits.push(`📞 ${s.phone || s.cellphone}`)
              if (s.contact) metaBits.push(`Contato: ${s.contact}`)
              if (s.email) metaBits.push(`✉ ${s.email}`)
              return (
                <div key={s.id ?? idx} className="group relative bg-white dark:bg-gray-800">
                  <div className="flex items-center w-full">
                    <button 
                      type="button" 
                      onClick={()=>{ onSelect(s) }} 
                      className="flex-1 text-left px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between min-w-0"
                    >
                      <span className="truncate text-gray-700 dark:text-gray-200">
                        <span className="font-medium block">{s.name || '-'}</span>
                        {metaBits.length > 0 && (
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5 truncate">
                            {metaBits.join(' • ')}
                          </span>
                        )}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500 shrink-0 ml-2">›</span>
                    </button>
                    
                    {(onEdit || onDelete) && (
                      <div className="relative pr-2">
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === s.id ? null : s.id);
                          }}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                        </button>

                        {menuOpenId === s.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                            <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-gray-800 rounded-md shadow-lg border dark:border-gray-700 py-1 z-20">
                              {onEdit && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpenId(null);
                                    onEdit(s);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
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
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
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
              )
            })}
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">Nenhum fornecedor encontrado.</div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} className="px-3 py-2 border dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200">Fechar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
