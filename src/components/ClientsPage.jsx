import React, { useEffect, useMemo, useRef, useState } from 'react'
import { listenClients } from '../services/clients'
import NewClientModal from './NewClientModal'

export default function ClientsPage({ storeId, addNewSignal }){
  const [clients, setClients] = useState([])
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
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
    return clients.filter(c => (c.name || '').toLowerCase().includes(q))
  }, [clients, query])

  const startEdit = (c) => {
    setEditingClient(c)
    setEditOpen(true)
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-white rounded-lg p-4 shadow">
        <div className="flex items-center gap-3">
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pesquisar nome, telefone..." className="flex-1 border rounded px-3 py-2 text-sm" />
          <button onClick={()=>setModalOpen(true)} className="hidden md:inline-flex px-3 py-2 rounded text-sm bg-green-600 text-white">+ Novo</button>
        </div>
      </div>

      {/* Lista */}
      <div className="mt-4 bg-white rounded-lg shadow overflow-hidden">
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
                <div className="font-medium cursor-pointer" onClick={()=>startEdit(c)}>{c.name}</div>
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
    </div>
  )
}
