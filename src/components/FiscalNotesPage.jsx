import React, { useMemo, useState } from 'react'

export default function FiscalNotesPage({ storeId }){
  const [search, setSearch] = useState('')
  const [periodOpen, setPeriodOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)

  const notes = useMemo(() => ([]), [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return notes
    return notes.filter(n => {
      return String(n.recipient).toLowerCase().includes(q) ||
             String(n.operation).toLowerCase().includes(q) ||
             String(n.number).includes(q)
    })
  }, [search, notes])

  const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const totals = useMemo(() => {
    const a = notes.filter(n => n.status === 'authorized')
    const p = notes.filter(n => n.status === 'pending')
    const r = notes.filter(n => n.status === 'rejected')
    return {
      authorized: { count: a.length, value: a.reduce((s, n) => s + Number(n.value || 0), 0) },
      pending: { count: p.length, value: p.reduce((s, n) => s + Number(n.value || 0), 0) },
      rejected: { count: r.length, value: r.reduce((s, n) => s + Number(n.value || 0), 0) }
    }
  }, [notes])

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex-1 max-w-md relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder="Pesquisar..."
            className="w-full pl-9 pr-3 py-2 rounded border bg-white text-sm border-gray-300"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button className="px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50" onClick={()=>setPeriodOpen(v=>!v)}>Período</button>
            {periodOpen && (
              <div className="absolute right-0 mt-2 bg-white border rounded shadow text-sm p-3 w-56">
                <div className="text-gray-600">Selecione um período</div>
              </div>
            )}
          </div>
          <div className="relative">
            <button className="px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50" onClick={()=>setFiltersOpen(v=>!v)}>Filtros</button>
            {filtersOpen && (
              <div className="absolute right-0 mt-2 bg-white border rounded shadow text-sm p-3 w-56">
                <div className="text-gray-600">Filtros</div>
              </div>
            )}
          </div>
          <div className="relative">
            <button className="px-4 py-2 bg-white border border-green-600 text-green-700 rounded text-sm font-semibold hover:bg-green-50" onClick={()=>setOptionsOpen(v=>!v)}>Opções</button>
            {optionsOpen && (
              <div className="absolute right-0 mt-2 bg-white border rounded shadow text-sm w-48">
                <button className="w-full text-left px-3 py-2 hover:bg-gray-50">Download XML</button>
                <button className="w-full text-left px-3 py-2 hover:bg-gray-50">Inutilizar Notas Fiscais</button>
              </div>
            )}
          </div>
          <div className="relative">
            <button className="px-4 py-2 bg-green-600 text-white rounded text-sm font-semibold hover:bg-green-700" onClick={()=>setNewOpen(v=>!v)}>+ Novo</button>
            {newOpen && (
              <div className="absolute right-0 mt-2 bg-white border rounded shadow text-sm w-36">
                <button className="w-full text-left px-3 py-2 hover:bg-gray-50">NF-e</button>
                <button className="w-full text-left px-3 py-2 hover:bg-gray-50">NFC-e</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-gray-50 border rounded p-3 mb-3 grid grid-cols-3 gap-3">
        <div>
          <div className="text-xs text-gray-600">Autorizadas ({totals.authorized.count})</div>
          <div className="text-green-600 font-bold">{money(totals.authorized.value)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-600">Pendentes ({totals.pending.count})</div>
          <div className="text-green-600 font-bold">{money(totals.pending.value)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-600">Rejeitadas ({totals.rejected.count})</div>
          <div className="text-green-600 font-bold">{money(totals.rejected.value)}</div>
        </div>
      </div>

      <div className="bg-white rounded shadow p-10 flex items-center justify-center text-gray-500 text-lg">
        Em criação
      </div>
    </div>
  )
}
