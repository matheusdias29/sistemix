import React, { useEffect, useMemo, useState } from 'react'
import { addFee, listenFees, updateFee } from '../services/stores'
import Switch from './Switch'

function formatCurrencyBRL(value){
  try{
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value||0))
  }catch{ return `R$ ${Number(value||0).toFixed(2)}` }
}

function StatusChip({ active }){
  return (
    <span
      className={`px-2 py-0.5 text-xs rounded-full border ${
        active
          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
          : 'bg-slate-100 text-slate-600 border-slate-200'
      }`}
    >
      {active ? 'Ativo' : 'Inativo'}
    </span>
  )
}

function SearchInput({ value, onChange }){
  return (
    <div className="relative w-[420px] max-w-[70vw]">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        {/* ícone de busca */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </span>
      <input
        className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-slate-300 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        placeholder="Pesquisar..."
        value={value}
        onChange={e=>onChange(e.target.value)}
      />
    </div>
  )
}

function NewFeeModal({ open, onClose, onCreated }){
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [type, setType] = useState('fixed') // fixed | percent
  const [active, setActive] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(()=>{
    if(!open){
      setName(''); setValue(''); setType('fixed'); setActive(true)
    }
  },[open])

  if(!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
      <div className="bg-white rounded-lg shadow-lg w-[600px] max-w-[92vw] p-6 modal-card">
        <h3 className="text-base font-semibold mb-4">Nova taxa</h3>
        <div className="space-y-4">
          <input
            className={`w-full rounded-md px-3 py-2 text-sm bg-slate-50 border ${errors.name ? 'border-red-400' : 'border-slate-300'} placeholder-slate-400`}
            placeholder="Nome"
            value={name}
            onChange={e=>setName(e.target.value)}
          />
          {errors.name ? <div className="text-xs text-red-600">Informe o nome da taxa.</div> : null}
          <input
            className={`w-full rounded-md px-3 py-2 text-sm bg-slate-50 border ${errors.value ? 'border-red-400' : 'border-slate-300'} placeholder-slate-400`}
            placeholder={type === 'percent' ? 'Valor Percentual' : 'Valor Fixo'}
            value={value}
            onChange={e=>setValue(e.target.value)}
          />
          {errors.value ? <div className="text-xs text-red-600">Informe um valor válido {type==='percent' ? 'entre 0 e 100' : 'maior ou igual a 0'}.</div> : null}
          <div className="flex items-center gap-2">
            <button
              className={`text-xs px-3 py-1 rounded-full ${type==='fixed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}
              onClick={()=>setType('fixed')}
            >Valor Fixo</button>
            <button
              className={`text-xs px-3 py-1 rounded-full ${type==='percent' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}
              onClick={()=>setType('percent')}
            >Valor Percentual</button>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Switch checked={active} onChange={setActive} />
            <span>Ativo</span>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <button className="text-sm px-3 py-2 text-slate-600 hover:text-slate-800 flex items-center gap-2" onClick={onClose}>
            <span>←</span>
            Voltar
          </button>
          <button
            className="text-sm px-3 py-2 rounded bg-[#00c853] hover:bg-[#00b74a] text-white flex items-center gap-2"
            onClick={()=>{
              const errs = {}
              if(!name?.trim()) errs.name = true
              const num = Number(value)
              const isNum = !Number.isNaN(num)
              if(!isNum) errs.value = true
              else if(type==='percent' && (num < 0 || num > 100)) errs.value = true
              else if(type==='fixed' && num < 0) errs.value = true
              setErrors(errs)
              if(Object.keys(errs).length===0){
                onCreated({ name: name.trim(), value: num, type, active })
              }
            }}
          >
            <span>✓</span>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

function EditFeeModal({ open, onClose, item, storeId, onUpdated }){
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [type, setType] = useState('fixed') // fixed | percent
  const [active, setActive] = useState(true)
  const [errors, setErrors] = useState({})

  useEffect(()=>{
    if(open && item){
      setName(item.name || '')
      setValue(String(item.value ?? ''))
      setType(item.type === 'percent' ? 'percent' : 'fixed')
      setActive(!!item.active)
      setErrors({})
    }
  },[open, item])

  if(!open || !item) return null

  const validate = () => {
    const errs = {}
    if(!String(name).trim()) errs.name = true
    const num = Number(value)
    const isNum = !Number.isNaN(num)
    if(!isNum) errs.value = true
    else if(type === 'percent' && (num < 0 || num > 100)) errs.value = true
    else if(type !== 'percent' && num < 0) errs.value = true
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleConfirm = async () => {
    if(!validate()) return
    try{
      await updateFee(storeId, item.id, {
        name: String(name).trim(),
        value: Number(value),
        type,
        active,
      })
      onUpdated && onUpdated()
      onClose && onClose()
    }catch(err){
      console.error('updateFee error', err)
      setErrors(prev=>({ ...prev, submit: 'Falha ao salvar. Tente novamente.' }))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
      <div className="bg-white rounded-lg shadow-lg w-[600px] max-w-[92vw] p-6 modal-card">
        <h3 className="text-base font-semibold mb-4">Editar taxa</h3>
        <div className="space-y-4">
          <input
            className={`w-full rounded-md px-3 py-2 text-sm bg-slate-50 border ${errors.name ? 'border-red-400' : 'border-slate-300'} placeholder-slate-400`}
            placeholder="Nome"
            value={name}
            onChange={e=>setName(e.target.value)}
          />
          {errors.name ? <div className="text-xs text-red-600">Informe o nome da taxa.</div> : null}
          <input
            className={`w-full rounded-md px-3 py-2 text-sm bg-slate-50 border ${errors.value ? 'border-red-400' : 'border-slate-300'} placeholder-slate-400`}
            placeholder={type === 'percent' ? 'Valor Percentual' : 'Valor Fixo'}
            value={value}
            onChange={e=>setValue(e.target.value)}
          />
          {errors.value ? <div className="text-xs text-red-600">Informe um valor válido {type==='percent' ? 'entre 0 e 100' : 'maior ou igual a 0'}.</div> : null}
          <div className="flex items-center gap-2">
            <button
              className={`text-xs px-3 py-1 rounded-full ${type==='fixed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}
              onClick={()=>setType('fixed')}
            >Valor Fixo</button>
            <button
              className={`text-xs px-3 py-1 rounded-full ${type==='percent' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}
              onClick={()=>setType('percent')}
            >Valor Percentual</button>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Switch checked={active} onChange={setActive} />
            <span>Ativo</span>
          </div>
          {errors.submit && (
            <div className="text-xs text-red-600">{errors.submit}</div>
          )}
        </div>
        <div className="mt-6 flex items-center justify-between">
          <button className="text-sm px-3 py-2 text-slate-600 hover:text-slate-800 flex items-center gap-2" onClick={onClose}>
            <span>←</span>
            Cancelar
          </button>
          <button
            className="text-sm px-3 py-2 rounded bg-[#00c853] hover:bg-[#00b74a] text-white flex items-center gap-2"
            onClick={handleConfirm}
          >
            <span>✓</span>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdditionalFeesPage({ storeId, onBack }){
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all | active | inactive
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // legacy (unused)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)

  useEffect(()=>{
    if(!storeId) { setLoading(false); return }
    setLoading(true)
    const stop = listenFees(storeId, (rows)=>{ setItems(rows); setLoading(false) }, (err)=>{ setError(err); setLoading(false) })
    return ()=> stop && stop()
  },[storeId])

  const filtered = useMemo(()=>{
    return items
      .filter(i => {
        if(filter==='active') return i.active
        if(filter==='inactive') return !i.active
        return true
      })
      .filter(i => i.name?.toLowerCase().includes(search.toLowerCase()))
  },[items, search, filter])

  async function handleCreate(fee){
    if(!fee?.name) return
    try{
      await addFee(storeId, fee)
      setModalOpen(false)
      setError(null)
    }catch(err){
      console.error('addFee error', err)
      setError(err)
    }
  }

  // toda edição será feita exclusivamente via modal

  if(!storeId){
    return (
      <div className="p-4">
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold mb-2">Configurar taxas adicionais</h2>
          <p className="text-sm text-gray-600">Selecione uma loja para gerenciar taxas.</p>
          <div className="mt-3"><button className="px-3 py-2 border border-slate-300 rounded text-sm" onClick={onBack}>Voltar</button></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700">Configurar taxas adicionais</h2>
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 border border-slate-300 rounded text-sm" onClick={onBack}>Voltar</button>
          <button className="px-3 py-2 rounded text-sm bg-[#00c853] hover:bg-[#00b74a] text-white flex items-center gap-2" onClick={()=>setModalOpen(true)}>
            <span className="text-lg leading-none">+</span>
            Novo
          </button>
        </div>
      </div>

      {loading && (
        <div className="mb-3 px-3 py-2 rounded bg-slate-50 text-slate-700 text-sm">Carregando taxas...</div>
      )}

      {error && (
        <div className="mb-3 px-3 py-2 rounded bg-red-50 text-red-700 text-sm">
          Falha ao carregar taxas. Verifique regras do Firestore e conexão.
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <SearchInput value={search} onChange={setSearch} />
        <button
          className={`text-xs px-2 py-1 rounded border ${filter==='active' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300'}`}
          onClick={()=>setFilter('active')}
        >Ativo</button>
        <button
          className={`text-xs px-2 py-1 rounded border ${filter==='inactive' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300'}`}
          onClick={()=>setFilter('inactive')}
        >Inativo</button>
        <button
          className={`text-xs px-2 py-1 rounded border ${filter==='all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300'}`}
          onClick={()=>setFilter('all')}
        >Todos</button>
      </div>

      <div className="border rounded overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_120px] px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-50 border-b">
          <div>Nome</div>
          <div>Valor</div>
          <div>Status</div>
        </div>
        {filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            className="grid grid-cols-[1fr_120px_120px] w-full text-left px-4 py-2 text-sm border-b hover:bg-slate-50 transition-colors cursor-pointer"
            onClick={()=>{ setSelectedItem(item); setEditModalOpen(true) }}
          >
            <div className="truncate" title={item.name}>{item.name}</div>
            <div>
              {item.type === 'percent' ? `${Number(item.value||0)}%` : formatCurrencyBRL(item.value)}
            </div>
            <div>
              <StatusChip active={!!item.active} />
            </div>
          </button>
        ))}
        {filtered.length === 0 && !error && (
          <div className="px-4 py-6 text-sm text-slate-500">Nenhuma taxa encontrada.</div>
        )}
      </div>

      <NewFeeModal open={modalOpen} onClose={()=>setModalOpen(false)} onCreated={handleCreate} />
      <EditFeeModal
        open={editModalOpen}
        onClose={()=>{ setEditModalOpen(false); setSelectedItem(null) }}
        item={selectedItem}
        storeId={storeId}
        onUpdated={()=>{ /* lista atualiza via onSnapshot */ }}
      />
    </div>
  )
}
