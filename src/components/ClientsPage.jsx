import React, { useEffect, useMemo, useRef, useState } from 'react'
import { getClientsByPage, searchClientsByPage, getTotalClientsCount, removeClient, getAllClients } from '../services/clients'
import NewClientModal from './NewClientModal'
import ClientsFilterModal from './ClientsFilterModal'

export default function ClientsPage({ storeId, addNewSignal, user }){
  const isOwner = !user?.memberId
  const perms = user?.permissions || {}

  if (!isOwner && !perms.clients?.view && !perms.clients?.create && !perms.clients?.edit && !perms.clients?.delete) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-6xl mb-4">🚫</div>
            <h2 className="text-xl font-bold mb-2">Acesso Negado</h2>
            <p>Você não tem permissão para visualizar clientes.</p>
        </div>
    )
  }

  const [clients, setClients] = useState([])
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  
  // Smart Cache
  const [cachedClients, setCachedClients] = useState(null)
  const [isCaching, setIsCaching] = useState(false)

  // (Sem cache global; carregamento ocorre somente dentro da página)
  
  // Paginação
  const PAGE_SIZE = 30
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [totalResults, setTotalResults] = useState(0)
  
  // Menu e Ações
  const [openMenuId, setOpenMenuId] = useState(null)
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)
  const [confirmRemoveClient, setConfirmRemoveClient] = useState(null)
  const [savingAction, setSavingAction] = useState(false)
  
  // Filtros
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState({}) // { status: 'active'|'inactive', credit: 'allowed'|'denied', birthday: boolean }

  const initialAddSignal = useRef(addNewSignal)

  // Carrega contagem total inicial e inicia Cache Inteligente
  useEffect(() => {
    if (!storeId) return
    
    // 1. Carrega contagem inicial do servidor (para mostrar algo rápido)
    getTotalClientsCount(storeId).then(count => {
      if (!query.trim() && !cachedClients) {
        setTotalResults(count)
      }
    }).catch(console.error)

    // 2. Inicia o "Smart Cache" em background
    if (!cachedClients && !isCaching) {
        setIsCaching(true)
        console.log('Iniciando Smart Cache de clientes...')
        getAllClients(storeId).then(all => {
            console.log(`Smart Cache concluído: ${all.length} clientes baixados.`)
            setCachedClients(all)
            setTotalResults(all.length)
            setIsCaching(false)
        }).catch(err => {
            console.error('Erro no Smart Cache:', err)
            setIsCaching(false)
        })
    }
  }, [storeId])

  // Lógica principal de exibição (Híbrida: Servidor ou Cache Local)
  useEffect(() => {
    let isMounted = true

    const load = async () => {
      // Se já temos cache, usamos ele (Instantâneo!)
      if (cachedClients) {
          // Filtra localmente
          let result = cachedClients
          
          if (query.trim()) {
              const lower = query.trim().toLowerCase()
              result = result.filter(c => 
                  (c.nameLower && c.nameLower.includes(lower)) ||
                  (c.phoneDigits && c.phoneDigits.includes(lower)) ||
                  (c.whatsappDigits && c.whatsappDigits.includes(lower)) ||
                  (c.cpfDigits && c.cpfDigits.includes(lower)) ||
                  (c.name && c.name.toLowerCase().includes(lower)) // fallback
              )
          }

          // Atualiza total
          if (isMounted) setTotalResults(result.length)

          // Pagina localmente
          const start = (page - 1) * PAGE_SIZE
          const end = start + PAGE_SIZE
          const pageData = result.slice(start, end)
          
          if (isMounted) {
              setClients(pageData)
              setLoading(false)
          }
          return
      }

      // Se não temos cache, vai no servidor (Legado/Fallback enquanto carrega)
      setLoading(true)
      try {
        if (query.trim()) {
           const { clients: newClients, total } = await searchClientsByPage(storeId, query, page, PAGE_SIZE)
           if(isMounted) {
             setClients(newClients)
             setTotalResults(total)
           }
        } else {
           // Modo Paginação Normal
           const newClients = await getClientsByPage(storeId, page, PAGE_SIZE)
           
           if(isMounted) {
             setClients(newClients)
             if (page === 1) {
                getTotalClientsCount(storeId).then(c => isMounted && setTotalResults(c))
             }
           }
        }
      } catch (err) {
        console.error(err)
      } finally {
        if(isMounted) setLoading(false)
      }
    }

    // Debounce apenas se for busca no servidor (sem cache)
    // Com cache é instantâneo, mas um pequeno debounce de 50ms evita travamento na digitação se tiver 50k items
    const delay = (cachedClients) ? 50 : (query.trim() ? 300 : 0)

    const timeoutId = setTimeout(() => {
        load()
    }, delay)

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [storeId, page, query, cachedClients]) // Re-roda quando cachedClients mudar

  // Reset paginação ao mudar query
  useEffect(() => {
     setPage(1)
  }, [storeId, query])

  // Abre modal de novo cliente somente quando o sinal mudar (ignora montagem inicial)
  useEffect(() => {
    if (addNewSignal !== initialAddSignal.current) {
      setModalOpen(true)
    }
  }, [addNewSignal])

  const filtered = useMemo(() => {
    // A filtragem principal agora é feita no useEffect (load),
    // mas mantemos filtros de status/crédito no cliente sobre a página atual
    return clients.filter(c => {
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
  }, [clients, filters])

  const startEdit = async (c) => {
    if(!isOwner && !perms.clients?.edit) return
    try {
      const mod = await (async () => {
        const m = await import('../services/clients')
        return m
      })()
      const full = await mod.getClientById(c.id)
      setEditingClient(full || c)
    } catch {
      setEditingClient(c)
    }
    setEditOpen(true)
    setOpenMenuId(null)
  }

  const openConfirmRemove = (c) => {
    if(!isOwner && !perms.clients?.delete) return
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
      
      // Atualiza Cache Local se existir
      if (cachedClients) {
          const newCache = cachedClients.filter(c => c.id !== confirmRemoveClient.id)
          setCachedClients(newCache)
          setTotalResults(prev => Math.max(0, prev - 1))
          // O useEffect vai rodar automaticamente e atualizar a lista
      } else {
          // Recarrega do servidor
          const newClients = await getClientsByPage(storeId, page, PAGE_SIZE)
          setClients(newClients)
          getTotalClientsCount(storeId).then(setTotalResults)
      }
    } catch(e) {
      console.error(e)
      alert('Erro ao remover cliente')
    } finally {
      setSavingAction(false)
    }
  }

  // Helper para atualizar cache após Edição/Criação
  const handleClientSave = (clientData) => {
    if (cachedClients) {
      setCachedClients(prev => {
        const index = prev.findIndex(c => c.id === clientData.id)
        if (index !== -1) {
          // Update
          const newCache = [...prev]
          newCache[index] = { ...newCache[index], ...clientData }
          return newCache
        } else {
          // New
          setTotalResults(prevTotal => prevTotal + 1)
          return [clientData, ...prev]
        }
      })
    } else {
      // Se não tem cache, recarrega a página atual
      getTotalClientsCount(storeId).then(setTotalResults)
      getClientsByPage(storeId, page, PAGE_SIZE).then(setClients)
    }
  }

  // Componente de Paginação Numérica
  const Pagination = () => {
    const totalPages = Math.ceil(totalResults / PAGE_SIZE) || 1
    if (totalPages <= 1) return null

    const renderPageNumbers = () => {
        const pages = []
        const maxVisible = 5 // Quantos números mostrar
        
        // Sempre mostra página 1
        pages.push(
            <button
                key={1}
                onClick={() => setPage(1)}
                className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    page === 1 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
                1
            </button>
        )

        // Lógica para intervalo intermediário
        let start = Math.max(2, page - 1)
        let end = Math.min(totalPages - 1, page + 1)
        
        // Ajuste para mostrar mais se estiver perto do início ou fim
        if (page <= 3) {
            end = Math.min(totalPages - 1, 4)
        }
        if (page >= totalPages - 2) {
            start = Math.max(2, totalPages - 3)
        }

        if (start > 2) {
            pages.push(<span key="dots1" className="text-gray-400 px-1">...</span>)
        }

        for (let i = start; i <= end; i++) {
            pages.push(
                <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                        page === i 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                >
                    {i}
                </button>
            )
        }

        if (end < totalPages - 1) {
            pages.push(<span key="dots2" className="text-gray-400 px-1">...</span>)
        }

        // Sempre mostra última página se > 1
        if (totalPages > 1) {
            pages.push(
                <button
                    key={totalPages}
                    onClick={() => setPage(totalPages)}
                    className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                        page === totalPages 
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
        <div className="flex items-center justify-center gap-2 py-4">
            <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30"
            >
                &lt;
            </button>
            
            <div className="flex items-center gap-1">
                {renderPageNumbers()}
            </div>

            <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30"
            >
                &gt;
            </button>
        </div>
    )
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
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow mb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
           {/* Esquerda: Pesquisa + Filtros */}
           <div className="flex items-center gap-2 flex-1 max-w-2xl">
              <div className="relative flex-1 max-w-md">
                 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                 <input 
                   value={query} 
                   onChange={e=>setQuery(e.target.value)} 
                   placeholder="Pesquisar nome, telefone..." 
                   className="w-full pl-9 pr-3 py-2 border dark:border-gray-700 rounded-md text-sm bg-gray-50 dark:bg-gray-700 dark:text-white focus:bg-white dark:focus:bg-gray-600 focus:ring-1 focus:ring-green-500 outline-none" 
                 />
              </div>
              <button 
                onClick={()=>setFilterOpen(true)} 
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md text-sm font-medium flex items-center gap-2"
              >
                <span>⚙️</span> Filtros
              </button>
           </div>

           {/* Direita: Opções + Novo */}
           <div className="flex items-center gap-3">
              {loading && (
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-300 text-sm">
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"></span>
                  <span>Carregando…</span>
                </div>
              )}
              <button className="hidden md:inline-flex px-4 py-2 border border-green-600 text-green-600 dark:text-green-400 dark:border-green-400 rounded-md text-sm font-medium hover:bg-green-50 dark:hover:bg-green-900/30">
                Opções
              </button>
              {(isOwner || perms.clients?.create) && (
              <button onClick={()=>setModalOpen(true)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium flex items-center gap-1">
                <span>+</span> Novo
              </button>
              )}
           </div>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-visible">
        {/* Cabeçalho (apenas desktop) */}
        <div className="hidden md:grid grid-cols-[1fr_6rem_5.5rem_3.5rem_1fr_12rem_6rem_2rem] gap-x-4 items-center px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-bold border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <div>Clientes ({totalResults})</div>
          <div>Código</div>
          <div className="text-center">Atualizado</div>
          <div className="text-center">Hora</div>
          <div className="text-center">Funcionário</div>
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
              className="md:hidden px-4 py-3 border-b dark:border-gray-700 last:border-0"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium flex items-center gap-2 truncate text-gray-800 dark:text-gray-100">
                  <span className="truncate">{c.name}</span>
                  {c.code ? (<span className="text-gray-500 text-xs shrink-0">#{c.code}</span>) : null}
                </div>
                
                <div className="relative">
                   <button 
                     className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 relative z-20"
                     onClick={(e)=>{ e.stopPropagation(); setOpenMenuId(openMenuId === c.id ? null : c.id) }}
                   >
                     <span className="text-gray-500 text-lg font-bold px-2">⋯</span>
                   </button>
                   {openMenuId === c.id && (
                     <div className={`absolute right-0 ${isLast ? 'bottom-full mb-1' : 'top-full mt-1'} w-48 bg-white dark:bg-gray-800 rounded shadow-xl border dark:border-gray-700 z-30 py-1`}>
                      {(isOwner || perms.clients?.edit) && (
                      <button type="button" className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2" onClick={()=> startEdit(c)}>
                        <span>✏️</span>
                        <span>Editar</span>
                      </button>
                      )}
                      {(isOwner || perms.clients?.delete) && (
                      <button type="button" className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400" onClick={()=> openConfirmRemove(c)}>
                         <span>🗑️</span>
                         <span>Remover cliente</span>
                       </button>
                      )}
                     </div>
                   )}
                </div>
              </div>
            </div>

            {/* Linha desktop completa */}
            <div className="hidden md:grid grid-cols-[1fr_6rem_5.5rem_3.5rem_1fr_12rem_6rem_2rem] gap-x-4 items-center px-4 py-3 border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
              <div className="text-sm text-gray-800 dark:text-gray-200">
                <div className="uppercase">
                  {c.name}
                </div>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {c.code || '-'}
              </div>
              <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                {(() => {
                  if (!c.updatedAt) return '—';
                  const d = c.updatedAt.seconds ? new Date(c.updatedAt.seconds * 1000) : new Date(c.updatedAt);
                  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
                })()}
              </div>
              <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                {(() => {
                  if (!c.updatedAt) return '—';
                  const d = c.updatedAt.seconds ? new Date(c.updatedAt.seconds * 1000) : new Date(c.updatedAt);
                  return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                })()}
              </div>
              <div className="text-center text-sm text-gray-500 dark:text-gray-400 truncate px-2" title={c.lastEditedBy || c.createdBy || ''}>
                {c.lastEditedBy || c.createdBy || '—'}
              </div>
              <div className="text-left text-sm text-gray-500 dark:text-gray-400">
                {c.whatsapp ? (
                  (() => {
                    const raw = String(c.whatsapp || '')
                    const digits = raw.replace(/\D/g, '')
                    const withCountry = digits.startsWith('55') ? digits : `55${digits}`
                    const url = `https://wa.me/${withCountry}`
                    return (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 dark:text-green-400 hover:underline"
                        title="Abrir conversa no WhatsApp"
                        onClick={(e)=> e.stopPropagation()}
                      >
                        {c.whatsapp}
                      </a>
                    )
                  })()
                ) : (
                  (c.phone || '-')
                )}
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c.active !== false ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                  {c.active !== false ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div className="relative text-right">
                   <button 
                     className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 relative z-20"
                     onClick={(e)=>{ e.stopPropagation(); setOpenMenuId(openMenuId === c.id ? null : c.id) }}
                   >
                     <span className="text-gray-500 text-lg font-bold px-2">⋯</span>
                   </button>
                   {openMenuId === c.id && (
                     <div className={`absolute right-0 ${isLast ? 'bottom-full mb-1' : 'top-full mt-1'} w-48 bg-white dark:bg-gray-800 rounded shadow-xl border dark:border-gray-700 z-30 py-1 text-left`}>
                      {(isOwner || perms.clients?.edit) && (
                      <button type="button" className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2" onClick={()=> startEdit(c)}>
                        <span>✏️</span>
                        <span>Editar</span>
                      </button>
                      )}
                      {(isOwner || perms.clients?.delete) && (
                      <button type="button" className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400" onClick={()=> openConfirmRemove(c)}>
                         <span>🗑️</span>
                         <span>Remover cliente</span>
                       </button>
                      )}
                     </div>
                   )}
              </div>
            </div>
          </React.Fragment>
          )
        })}

        {/* Loading Skeleton */}
        {loading && (
          <div className="divide-y dark:divide-gray-700">
            {Array.from({length: 8}).map((_, i) => (
              <div key={`cli-sk-${i}`} className="px-4 py-3 animate-pulse">
                <div className="hidden md:grid grid-cols-[1fr_6rem_5.5rem_3.5rem_1fr_12rem_6rem_2rem] gap-x-4 items-center">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 justify-self-center"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-10 justify-self-center"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-28"></div>
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16 justify-self-end"></div>
                  <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded-full justify-self-end"></div>
                </div>
                <div className="md:hidden flex items-center justify-between">
                  <div className="space-y-2 w-2/3">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </div>
                  <div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {!loading && filtered.length === 0 && (
            <div className="p-8 text-center text-gray-500">
                Nenhum cliente encontrado.
            </div>
        )}
        
        {/* Paginação Numérica */}
        <Pagination />

      </div>

      <NewClientModal 
        open={modalOpen} 
        onClose={()=>setModalOpen(false)} 
        storeId={storeId}
        user={user}
        onSuccess={(newClient) => {
            setModalOpen(false)
            handleClientSave(newClient)
        }}
      />

      {editOpen && editingClient && (
        <NewClientModal 
          open={editOpen} 
          onClose={()=>{setEditOpen(false); setEditingClient(null)}} 
          storeId={storeId}
          isEdit={true}
          client={editingClient}
          user={user}
          onSuccess={(updatedClient) => {
              setEditOpen(false)
              setEditingClient(null)
              handleClientSave(updatedClient)
          }}
        />
      )}

      {/* Modal Filtros */}
      <ClientsFilterModal
        open={filterOpen}
        onClose={()=>setFilterOpen(false)}
        initialFilters={filters}
        onApply={setFilters}
      />

      {/* Modal Confirmação Remoção */}
      {confirmRemoveOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold mb-2 dark:text-white">Remover Cliente</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Tem certeza que deseja remover <b>{confirmRemoveClient?.name}</b>?
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={()=>setConfirmRemoveOpen(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                disabled={savingAction}
              >
                Cancelar
              </button>
              <button 
                onClick={confirmRemove}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-2"
                disabled={savingAction}
              >
                {savingAction ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
