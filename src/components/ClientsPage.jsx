import React, { useEffect, useMemo, useRef, useState } from 'react'
import { listenClients, removeClient } from '../services/clients'
import NewClientModal from './NewClientModal'
import ClientsFilterModal from './ClientsFilterModal'

export default function ClientsPage({ storeId, addNewSignal }){
  const [clients, setClients] = useState([])
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  
  // Menu e Ações
  const [openMenuId, setOpenMenuId] = useState(null)
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)
  const [confirmRemoveClient, setConfirmRemoveClient] = useState(null)
  const [savingAction, setSavingAction] = useState(false)
  
  // Filtros
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState({}) // { status: 'active'|'inactive', credit: 'allowed'|'denied', birthday: boolean }

  const initialAddSignal = useRef(addNewSignal)

  useEffect(()=>{
    const unsub = listenClients(items=> setClients(items), storeId)
    return () => unsub && unsub()
  }, [storeId])

  // Abre modal de novo cliente somente quando o sinal mudar (ignora montagem inicial)
  useEffect(() => {
    if (addNewSignal !== initialAddSignal.current) {
      setModalOpen(true)
    }
  }, [addNewSignal])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return clients.filter(c => {
      // Filtro de texto
      const matchesText = (c.name || '').toLowerCase().includes(q) || (c.whatsapp || '').includes(q) || (c.phone || '').includes(q)
      if(!matchesText) return false

      // Filtro de Status
      if(filters.status === 'active' && c.active === false) return false
      if(filters.status === 'inactive' && c.active !== false) return false

      // Filtro de Crédito
      if(filters.credit === 'allowed' && !c.allowCredit) return false
      if(filters.credit === 'denied' && c.allowCredit) return false

      // Filtro de Aniversariantes
      if(filters.birthday) {
        if(!c.birthDate) return false
        const today = new Date()
        const currentMonth = today.getMonth() + 1 // 1-12
        const [_, month] = c.birthDate.split('-') // YYYY-MM-DD
        if(parseInt(month) !== currentMonth) return false
      }

      return true
    })
  }, [clients, query, filters])

  const startEdit = (c) => {
    setEditingClient(c)
    setEditOpen(true)
    setOpenMenuId(null)
  }

  const openConfirmRemove = (c) => {
    setConfirmRemoveClient(c)
    setConfirmRemoveOpen(true)
    setOpenMenuId(null)
  }

  const confirmRemove = async () => {
    if(!confirmRemoveClient) return
    setSavingAction(true)
    try {
      await removeClient(confirmRemoveClient.id)
      setConfirmRemoveOpen(false)
      setConfirmRemoveClient(null)
    } catch(e) {
      console.error(e)
      alert('Erro ao remover cliente')
    } finally {
      setSavingAction(false)
    }
  }

  return (
    <div>
      {/* Overlay para fechar menu ao clicar fora */}
      {openMenuId && (
        <div 
          className="fixed inset-0 z-10" 
          onClick={()=>setOpenMenuId(null)}
        ></div>
      )}

      {/* Header */}
      <div className="bg-white rounded-lg p-4 shadow mb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
           {/* Esquerda: Pesquisa + Filtros */}
           <div className="flex items-center gap-2 flex-1 max-w-2xl">
              <div className="relative flex-1 max-w-md">
                 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                 <input 
                   value={query} 
                   onChange={e=>setQuery(e.target.value)} 
                   placeholder="Pesquisar nome, telefone..." 
                   className="w-full pl-9 pr-3 py-2 border rounded-md text-sm bg-gray-50 focus:bg-white focus:ring-1 focus:ring-green-500 outline-none" 
                 />
              </div>
              <button 
                onClick={()=>setFilterOpen(true)} 
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium flex items-center gap-2"
              >
                <span>⚙️</span> Filtros
              </button>
           </div>

           {/* Direita: Opções + Novo */}
           <div className="flex items-center gap-2">
              <button className="hidden md:inline-flex px-4 py-2 border border-green-600 text-green-600 rounded-md text-sm font-medium hover:bg-green-50">
                Opções
              </button>
              <button onClick={()=>setModalOpen(true)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium flex items-center gap-1">
                <span>+</span> Novo
              </button>
           </div>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-lg shadow overflow-visible">
        {/* Cabeçalho (apenas desktop) */}
        <div className="hidden md:grid grid-cols-[1fr_6rem_5.5rem_3.5rem_1fr_6rem_2rem] gap-x-4 items-center px-4 py-3 text-xs text-gray-500 border-b bg-gray-50 rounded-t-lg">
          <div>Clientes ({filtered.length})</div>
          <div>Código</div>
          <div className="text-center">Atualizado</div>
          <div className="text-center">Hora</div>
          <div className="text-left">Whatsapp</div>
          <div className="text-right">Status</div>
          <div></div>
        </div>

        {filtered.map((c, index) => {
          // Só abre para cima se estiver no final da lista E não for um dos primeiros itens (para não cortar no topo)
          const isLast = index >= 2 && index >= filtered.length - 2
          return (
          <React.Fragment key={c.id}>
            {/* Linha mobile: apenas código + nome */}
            <div
              className="md:hidden px-4 py-3 border-b last:border-0"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium flex items-center gap-2 truncate">
                  <span className="truncate">{c.name}</span>
                  {c.code ? (<span className="text-gray-500 text-xs shrink-0">#{c.code}</span>) : null}
                </div>
                
                <div className="relative">
                   <button 
                     className="p-1 rounded-full hover:bg-gray-100 relative z-20"
                     onClick={(e)=>{ e.stopPropagation(); setOpenMenuId(openMenuId === c.id ? null : c.id) }}
                   >
                     <span className="text-gray-500 text-lg font-bold px-2">⋯</span>
                   </button>
                   {openMenuId === c.id && (
                     <div className={`absolute right-0 ${isLast ? 'bottom-full mb-1' : 'top-full mt-1'} w-48 bg-white rounded shadow-xl border z-30 py-1`}>
                      <button type="button" className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2" onClick={()=> startEdit(c)}>
                        <span>✏️</span>
                        <span>Editar</span>
                      </button>
                      <button type="button" className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600" onClick={()=> openConfirmRemove(c)}>
                         <span>🗑️</span>
                         <span>Remover cliente</span>
                       </button>
                     </div>
                   )}
                </div>
              </div>
            </div>

            {/* Linha desktop completa */}
            <div className="hidden md:grid grid-cols-[1fr_6rem_5.5rem_3.5rem_1fr_6rem_2rem] gap-x-4 items-center px-4 py-3 border-b last:border-0">
              <div className="text-sm">
                <div className="font-medium uppercase">
                  {c.name}
                </div>
              </div>
              <div className="text-xs text-gray-500 font-mono">
                {c.code || '-'}
              </div>
              <div className="text-xs text-gray-700 text-center">
                 {c.updatedAt?.seconds ? new Date(c.updatedAt.seconds * 1000).toLocaleDateString('pt-BR') : '—'}
              </div>
              <div className="text-xs text-gray-700 text-center">
                 {c.updatedAt?.seconds ? new Date(c.updatedAt.seconds * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
              </div>
              <div className="text-sm text-left">
                {c.whatsapp ? (
                  <div className="flex items-center justify-start gap-2">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-green-500">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.463 1.065 2.876 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                    </svg>
                    <span>{c.whatsapp}</span>
                  </div>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
              <div className="text-sm text-right">
                <div className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${(c.active!==false) ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {(c.active!==false) ? 'Ativo' : 'Inativo'}
                </div>
              </div>
              
              <div className="relative text-right">
                 <button 
                   className="p-1 rounded-full hover:bg-gray-100 relative z-20"
                   onClick={(e)=>{ e.stopPropagation(); setOpenMenuId(openMenuId === c.id ? null : c.id) }}
                 >
                   <span className="text-gray-500 text-lg font-bold px-2">⋯</span>
                 </button>
                 {openMenuId === c.id && (
                    <div className={`absolute right-0 ${isLast ? 'bottom-full mb-1' : 'top-full mt-1'} w-48 bg-white rounded shadow-xl border z-30 py-1 text-left`}>
                      <button type="button" className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2" onClick={()=> startEdit(c)}>
                        <span>✏️</span>
                        <span>Editar</span>
                      </button>
                      <button type="button" className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600" onClick={()=> openConfirmRemove(c)}>
                       <span>🗑️</span>
                       <span>Remover cliente</span>
                     </button>
                   </div>
                 )}
              </div>
            </div>
          </React.Fragment>
          )
        })}
      </div>

      {/* Modais */}
      {/* Modal Confirmar Exclusão */}
      {confirmRemoveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative bg-white rounded-lg shadow-lg w-[95vw] max-w-[520px]">
            <div className="px-4 py-3 border-b">
              <h3 className="text-base font-medium">Remover cliente</h3>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div>
                Tem certeza que deseja remover “{confirmRemoveClient?.name}”?
              </div>
              <div>
                Esta ação é irreversível.
              </div>
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button className="px-3 py-2 text-sm rounded border" onClick={()=>setConfirmRemoveOpen(false)} disabled={savingAction}>Cancelar</button>
              <button className="px-3 py-2 text-sm rounded bg-red-600 text-white" onClick={confirmRemove} disabled={savingAction}>Remover</button>
            </div>
          </div>
        </div>
      )}

      <NewClientModal open={modalOpen} onClose={()=>setModalOpen(false)} storeId={storeId} />
      <NewClientModal open={editOpen} onClose={()=>setEditOpen(false)} isEdit={true} client={editingClient} storeId={storeId} />
      <ClientsFilterModal 
        open={filterOpen} 
        onClose={()=>setFilterOpen(false)} 
        onApply={setFilters} 
        initialFilters={filters} 
      />
    </div>
  )
}
