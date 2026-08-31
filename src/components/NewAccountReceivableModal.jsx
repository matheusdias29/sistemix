import React, { useState, useEffect, useRef } from 'react'
import SelectClientModal from './SelectClientModal'
import NewClientModal from './NewClientModal'
import { listenClients, getAllClients } from '../services/clients'
import { storageGet, storageSet } from '../lib/datacache'

const CLIENTS_CACHE_SCHEMA_VERSION = 3
const CLIENTS_CACHE_TTL_MS = 60 * 60 * 1000
const clientsCacheKey = (storeId, userId) =>
  `sistemix:clients:u${String(userId || 'anon')}:s${String(storeId || 'default')}`

const optimizeClient = (c) => ({
  id: c.id,
  name: c.name,
  code: c.code,
  reference: c.reference,
  phone: c.phone,
  phoneDigits: c.phoneDigits,
  cpf: c.cpf,
  cnpj: c.cnpj,
  cpfCnpj: c.cpfCnpj,
  email: c.email
})

export default function NewAccountReceivableModal({ onClose, onSave, onDelete, isLoading, storeId, initialData, prefillData, mode = 'create', titleOverride = '', defaultType = 'receivable', user }) {
  const isOwner = !user?.memberId
  const perms = user?.permissions || {}
  const userId = user?.id || user?.memberId || 'anon'
  const [client, setClient] = useState(null)
  const [description, setDescription] = useState('')
  const [details, setDetails] = useState('')
  const [value, setValue] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [daysToDue, setDaysToDue] = useState(0)
  const [type, setType] = useState(defaultType)
  
  const [paymentMode, setPaymentMode] = useState('single')
  const [installmentCount, setInstallmentCount] = useState('')

  const [showClientSelect, setShowClientSelect] = useState(false)
  const [showNewClient, setShowNewClient] = useState(false)
  const [clients, setClients] = useState([])
  const [cachedClients, setCachedClients] = useState(null)
  const [cacheSyncing, setCacheSyncing] = useState(false)
  const [cacheLastUpdate, setCacheLastUpdate] = useState(null)
  const [cacheLoadedFromDisk, setCacheLoadedFromDisk] = useState(false)
  const isCachingClientsRef = useRef(false)
  const bootNonceRef = useRef(0)

  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setClient({ id: initialData.clientId, name: initialData.clientName })
      setDescription(initialData.description || '')
      setDetails(initialData.details || '')
      setValue(initialData.originalValue?.toString() || initialData.value?.toString() || '')
      setDueDate(initialData.dueDate || '')
      setType(initialData.type || 'receivable')
      
      if (initialData.dueDate) {
        const diff = Math.ceil((new Date(initialData.dueDate) - new Date()) / (1000 * 60 * 60 * 24))
        setDaysToDue(diff > 0 ? diff : 0)
      }
    } else if (prefillData) {
      setClient(prefillData.clientId || prefillData.clientName ? { id: prefillData.clientId || null, name: prefillData.clientName || '' } : null)
      setDescription(prefillData.description || '')
      setDetails(prefillData.details || '')
      setValue(prefillData.value?.toString() || '')
      setDueDate(prefillData.dueDate || new Date().toISOString().split('T')[0])
      setType(prefillData.type || defaultType)
      setPaymentMode('single')
      setInstallmentCount('')

      if (prefillData.dueDate) {
        const diff = Math.ceil((new Date(prefillData.dueDate) - new Date()) / (1000 * 60 * 60 * 24))
        setDaysToDue(diff)
      } else {
        setDaysToDue(0)
      }
    } else {
      setClient(null)
      setDescription('')
      setDetails('')
      setValue('')
      setDueDate('')
      setDaysToDue(0)
      setType(defaultType)
      
      const today = new Date().toISOString().split('T')[0]
      setDueDate(today)
    }
    setPaymentMode('single')
    setInstallmentCount('')
  }, [initialData, prefillData, defaultType, mode])

  useEffect(() => {
    if (!storeId) return
    const unsubClients = listenClients((items) => {
      setClients(items)
    }, storeId)
    return () => unsubClients()
  }, [storeId])

  const refreshCacheFromServer = async (silent = true) => {
    if (!storeId) return
    if (isCachingClientsRef.current) return
    isCachingClientsRef.current = true
    if (!silent) setCacheSyncing(true)
    try {
      const all = await getAllClients(storeId)
      const optimized = Array.isArray(all) ? all.map(optimizeClient) : []
      const savedAt = Date.now()
      const cacheEntry = {
        schemaVersion: CLIENTS_CACHE_SCHEMA_VERSION,
        savedAt,
        totalCount: optimized.length,
        data: optimized
      }
      const key = clientsCacheKey(storeId, userId)
      storageSet(key, cacheEntry).catch(() => {})
      setCachedClients(optimized)
      setCacheLastUpdate(new Date(savedAt))
    } catch (err) {
      console.error('Error refreshing clients cache:', err)
    } finally {
      isCachingClientsRef.current = false
      setCacheSyncing(false)
    }
  }

  useEffect(() => {
    if (!storeId) return
    bootNonceRef.current += 1
    const myNonce = bootNonceRef.current
    const key = clientsCacheKey(storeId, userId)
    let cancelled = false

    const boot = async () => {
      try {
        const hit = await storageGet(key)
        if (cancelled || myNonce !== bootNonceRef.current) return

        const now = Date.now()
        let cacheValid = false
        if (
          hit &&
          hit.schemaVersion === CLIENTS_CACHE_SCHEMA_VERSION &&
          Array.isArray(hit.data) &&
          typeof hit.savedAt === 'number' &&
          (now - hit.savedAt) < CLIENTS_CACHE_TTL_MS
        ) {
          cacheValid = true
        }

        if (hit && Array.isArray(hit.data)) {
          setCachedClients(hit.data)
          setCacheLastUpdate(typeof hit.savedAt === 'number' ? new Date(hit.savedAt) : null)
        }
        setCacheLoadedFromDisk(true)

        if (!cacheValid) {
          refreshCacheFromServer(true).catch(() => {})
        }
      } catch (e) {
        console.error('Clients cache boot failed:', e)
        setCacheLoadedFromDisk(true)
        refreshCacheFromServer(true).catch(() => {})
      }
    }
    boot()

    return () => { cancelled = true }
  }, [storeId, userId])

  useEffect(() => {
    isCachingClientsRef.current = false
    setCachedClients(null)
    setCacheLastUpdate(null)
    setCacheLoadedFromDisk(false)
    setCacheSyncing(false)
  }, [storeId])

  // Logic to sync Days <-> Date
  const handleDaysChange = (e) => {
    const d = parseInt(e.target.value) || 0
    setDaysToDue(d)
    const date = new Date()
    date.setDate(date.getDate() + d)
    setDueDate(date.toISOString().split('T')[0])
  }

  const handleDateChange = (e) => {
    const newDate = e.target.value
    setDueDate(newDate)
    if (newDate) {
      const diff = Math.ceil((new Date(newDate) - new Date()) / (1000 * 60 * 60 * 24))
      setDaysToDue(diff)
    }
  }

  const handleSubmit = () => {
    if (!client) {
      alert('Selecione um cliente')
      return
    }
    if (!value) {
        alert('Informe o valor')
        return
    }
    if (type === 'receivable' && !dueDate && paymentMode === 'single') {
        alert('Informe a data de vencimento')
        return
    }
    
    if (paymentMode === 'installment' && type === 'receivable') {
       const totalVal = parseFloat(value.toString().replace(',', '.'))
       const count = parseInt(installmentCount)
       const interval = parseInt(daysToDue)

       if (!count || count < 2) {
          alert('Informe a quantidade de parcelas (mínimo 2)')
          return
       }
       if (!interval || interval <= 0) {
          alert('Informe o intervalo em dias')
          return
       }

       const installmentValue = totalVal / count
       const installments = []
       const baseDate = new Date()

       for (let i = 1; i <= count; i++) {
          const d = new Date(baseDate)
          d.setDate(baseDate.getDate() + (interval * i))
          
          installments.push({
            clientId: client.id,
            clientName: client.name,
            description: `${description || 'Conta a Receber'} (${i}/${count})`,
            details,
            value: installmentValue,
            dueDate: d.toISOString().split('T')[0],
            type
          })
       }
       
       onSave(installments)

    } else {
        onSave({
          id: mode === 'edit' ? initialData?.id : undefined,
          clientId: client.id,
          clientName: client.name,
          description: description || (type === 'credit' ? 'Crédito ao Cliente' : 'Conta a Receber'),
          details,
          value: parseFloat(value.toString().replace(',', '.')),
          dueDate: type === 'credit' ? null : dueDate,
          type
        })
    }
  }

  const isCredit = type === 'credit'
  const title = titleOverride || (mode === 'edit' && initialData 
    ? (isCredit ? 'Editar Crédito' : 'Editar Conta a Receber')
    : (isCredit ? 'Adicionar Crédito ao Cliente' : 'Nova Conta a Receber'))

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 font-sans">
      <div className="w-full max-w-xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 pb-2 border-b dark:border-gray-700 bg-white dark:bg-gray-800">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h2>
        </div>

        {/* Body */}
        <div className="p-6 pt-4 overflow-y-auto space-y-5 bg-white dark:bg-gray-800">
          
          {/* Cliente Selector */}
          <div 
            className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex justify-between items-center group"
            onClick={() => setShowClientSelect(true)}
          >
            <div className="flex flex-col">
              {!client && <span className="text-gray-500 dark:text-gray-400 font-medium">Cliente</span>}
              {client && <span className="text-gray-900 dark:text-white font-bold">{client.name}</span>}
            </div>
            <span className="text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300">›</span>
          </div>

          {!isCredit && (
             /* Toggle Lançamento único / Parcelado */
             <div className="flex gap-2">
                <button 
                  onClick={() => setPaymentMode('single')}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${paymentMode === 'single' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}
                >
                  Lançamento único
                </button>
                <button 
                  onClick={() => setPaymentMode('installment')}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${paymentMode === 'installment' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}
                >
                  Parcelado
                </button>
             </div>
          )}

          {/* Valor */}
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600 flex flex-col">
             <div className="flex justify-between mb-1">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">
                    {isCredit ? 'Valor' : 'Valor Lançamento'}
                </span>
             </div>
             <input 
               type="number"
               step="0.01"
               className="w-full bg-transparent text-right text-gray-900 dark:text-white font-bold text-xl outline-none placeholder-gray-300 dark:placeholder-gray-500"
               placeholder="0,00"
               value={value}
               onChange={e => setValue(e.target.value)}
             />
          </div>

          {!isCredit && (
            /* Dias e Data de Vencimento / Parcelas */
            <div className="grid grid-cols-12 gap-4">
               {paymentMode === 'single' ? (
                   <>
                       <div className="col-span-4 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                          <label className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-1 block">Dias</label>
                          <input 
                            type="number"
                            className="w-full bg-transparent text-gray-900 dark:text-white font-medium outline-none"
                            value={daysToDue}
                            onChange={handleDaysChange}
                          />
                       </div>
                       <div className="col-span-8 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                          <label className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-1 block">Data de Vencimento</label>
                          <input 
                            type="date"
                            className="w-full bg-transparent text-gray-900 dark:text-white font-medium outline-none dark:[color-scheme:dark]"
                            value={dueDate}
                            onChange={handleDateChange}
                          />
                       </div>
                   </>
               ) : (
                   <>
                       <div className="col-span-5 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                          <div className="flex justify-between items-center mb-1">
                             <label className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider block">Dias</label>
                             <span className="text-[10px] text-gray-400 dark:text-gray-500">Intervalo (dias)</span>
                          </div>
                          <input 
                            type="number"
                            className="w-full bg-transparent text-gray-900 dark:text-white font-medium outline-none"
                            value={daysToDue}
                            onChange={handleDaysChange}
                            placeholder="30"
                          />
                       </div>
                       <div className="col-span-7 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                          <label className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-1 block">Quantidade de parcelas</label>
                          <input 
                            type="number"
                            className="w-full bg-transparent text-gray-900 dark:text-white font-medium outline-none"
                            value={installmentCount}
                            onChange={e => setInstallmentCount(e.target.value)}
                            placeholder="Ex: 2"
                          />
                       </div>
                   </>
               )}
            </div>
          )}

          {/* Descrição */}
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
             <label className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-1 block">Descrição</label>
             <input 
               type="text"
               className="w-full bg-transparent text-gray-900 dark:text-white font-medium outline-none placeholder-gray-400 dark:placeholder-gray-500"
               placeholder={isCredit ? "Ex: Devolução" : "Ex: Venda Balcão"}
               value={description}
               onChange={e => setDescription(e.target.value)}
             />
          </div>

          {/* Detalhes */}
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
             <label className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-1 block">Detalhes (opcional)</label>
             <textarea 
               className="w-full bg-transparent text-gray-900 dark:text-white font-medium outline-none placeholder-gray-400 dark:placeholder-gray-500 resize-none h-20"
               value={details}
               onChange={e => setDetails(e.target.value)}
             />
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-end items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-500 dark:text-gray-400 font-medium hover:text-gray-700 dark:hover:text-gray-200 transition-colors flex items-center gap-2"
            >
              ✕ Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-6 py-2 bg-green-500 text-white font-medium rounded hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 shadow-md transition-all transform active:scale-95 disabled:opacity-50"
            >
              {isLoading ? 'Salvando...' : '✓ Salvar'}
            </button>
        </div>
      </div>

      {/* Modal de Seleção de Cliente */}
      <SelectClientModal
        open={showClientSelect}
        onClose={() => setShowClientSelect(false)}
        clients={cachedClients || clients}
        syncing={cacheSyncing}
        cacheLoadedFromDisk={cacheLoadedFromDisk}
        cacheLastUpdate={cacheLastUpdate}
        onChoose={(c) => {
          setClient(c)
          setShowClientSelect(false)
        }}
        onNew={(isOwner || perms.clients?.create) ? () => {
           setShowClientSelect(false)
           setShowNewClient(true)
        } : undefined}
      />

      {/* Novo Cliente Modal */}
      <NewClientModal
        open={showNewClient}
        onClose={() => setShowNewClient(false)}
        storeId={storeId}
        user={user}
        onSuccess={async (newC) => {
            const opt = optimizeClient(newC)
            setClients(prev => prev.find(c => c.id === opt.id) ? prev : [opt, ...prev])
            setCachedClients(prev => {
              if (!prev) return [opt]
              if (prev.find(c => c.id === opt.id)) return prev
              return [opt, ...prev]
            })
            try {
              const key = clientsCacheKey(storeId, user?.uid)
              const hit = await storageGet(key)
              const now = Date.now()
              if (hit && hit.schemaVersion === CLIENTS_CACHE_SCHEMA_VERSION && Array.isArray(hit.clients)) {
                const list = hit.clients.filter(c => c.id !== opt.id)
                storageSet(key, { schemaVersion: CLIENTS_CACHE_SCHEMA_VERSION, savedAt: now, clients: [opt, ...list] }).catch(() => {})
              }
            } catch {}
            setClient(opt)
            setShowNewClient(false)
        }}
      />
    </div>
  )
}
