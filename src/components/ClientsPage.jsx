import React, { useEffect, useMemo, useRef, useState } from 'react'
import { listenClients } from '../services/clients'
import NewClientModal from './NewClientModal'
import ClientsFilterModal from './ClientsFilterModal'

export default function ClientsPage({ storeId, addNewSignal }){
  const [clients, setClients] = useState([])
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  
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
  }

  return (
    <div>
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
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Cabeçalho (apenas desktop) */}
        <div className="hidden md:grid grid-cols-[1fr_10rem_8rem_2rem] items-center px-4 py-3 text-xs text-gray-500 border-b">
          <div>Clientes ({filtered.length})</div>
          <div className="text-right">Whatsapp</div>
          <div className="text-right">Status</div>
          <div></div>
        </div>

        {filtered.map(c => (
          <>
            {/* Linha mobile: apenas código + nome */}
            <div
              key={c.id + '-m'}
              className="md:hidden px-4 py-3 border-b last:border-0 cursor-pointer"
              onClick={()=>startEdit(c)}
            >
              <div className="text-sm font-medium flex items-center justify-between gap-2">
                <span className="truncate mr-2">{c.name}</span>
                {c.code ? (<span className="text-gray-500 text-xs shrink-0">#{c.code}</span>) : null}
              </div>
            </div>

            {/* Linha desktop completa */}
            <div key={c.id} className="hidden md:grid grid-cols-[1fr_10rem_8rem_2rem] items-center px-4 py-3 border-b last:border-0">
              <div className="text-sm">
                <div className="font-medium cursor-pointer uppercase" onClick={()=>startEdit(c)}>
                  {c.name} {c.code && <span className="text-gray-400 text-xs font-normal">#{c.code}</span>}
                </div>
              </div>
              <div className="text-sm text-right">{c.whatsapp || '-'}</div>
              <div className="text-sm text-right">
                <div className={`px-2 py-1 rounded text-xs ${(c.active ?? true) ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>{(c.active ?? true) ? 'Ativo' : 'Inativo'}</div>
              </div>
              <div className="text-right text-sm">⋯</div>
            </div>
          </>
        ))}
      </div>

      {/* Modais */}
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
