import React, { useEffect, useMemo, useState } from 'react'
import { listenOrders } from '../services/orders'
import NewSaleModal from './NewSaleModal'

const tabs = [
  { key: 'todos', label: 'Todos' },
  { key: 'pedido', label: 'Pedido' },
  { key: 'venda', label: 'Vendas' },
  { key: 'cancelada', label: 'Canceladas' },
]

export default function SalesPage({ initialDayFilter = null }){
  const [orders, setOrders] = useState([])
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('todos')
  const [monthOnly, setMonthOnly] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [newSaleOpen, setNewSaleOpen] = useState(false)
  const [dayFilter, setDayFilter] = useState(initialDayFilter)

  useEffect(() => {
    const unsub = listenOrders(items => setOrders(items))
    return () => { unsub && unsub() }
  }, [])

  useEffect(() => {
    setDayFilter(initialDayFilter)
  }, [initialDayFilter])

  const toDate = (ts) => ts?.toDate?.() ? ts.toDate() : (ts ? new Date(ts) : null)
  const isSameDay = (a, b) => a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    return orders
      .filter(o => {
        const name = (o.client || '').toLowerCase()
        const idstr = (o.id || '').toLowerCase()
        return name.includes(q) || idstr.includes(q)
      })
      .filter(o => {
        if(!monthOnly) return true
        const d = toDate(o.createdAt)
        if(!d) return true
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear
      })
      .filter(o => {
        if(!dayFilter) return true
        const d = toDate(o.createdAt)
        return d ? isSameDay(d, new Date(dayFilter)) : false
      })
      .filter(o => {
        if(tab==='todos') return true
        const s = (o.status || '').toLowerCase()
        if(tab==='pedido') return s==='pedido'
        if(tab==='venda') return s==='venda' || s==='finalizado' || s==='pago'
        if(tab==='cancelada') return s==='cancelada'
        return true
      })
  }, [orders, query, monthOnly, tab])

  const totalValor = useMemo(() => filtered.reduce((acc, o) => acc + Number(o.valor || o.total || 0), 0), [filtered])
  const vendasRealizadas = useMemo(() => filtered.filter(o => (o.status||'').toLowerCase() === 'venda').length, [filtered])
  const ticketMedio = useMemo(() => filtered.length ? totalValor / filtered.length : 0, [filtered, totalValor])

  const formatCurrency = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const formatDate = (ts) => {
    const d = ts?.toDate?.() ? ts.toDate() : (ts ? new Date(ts) : new Date())
    const dias = ['dom','seg','ter','qua','qui','sex','sáb']
    const dia = dias[d.getDay()]
    const dd = String(d.getDate()).padStart(2,'0')
    const mm = String(d.getMonth()+1).padStart(2,'0')
    return `${dia} - ${dd}/${mm}`
  }
  const firstPaymentMethod = (o) => {
    const p = Array.isArray(o.payments) && o.payments.length ? o.payments[0] : null
    return p?.method || '-'
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-white rounded-lg p-4 shadow">
        <div className="flex items-center gap-3">
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pesquisar..." className="flex-1 border rounded px-3 py-2 text-sm" />
          {dayFilter && (
            <button onClick={()=>setDayFilter(null)} className="px-3 py-2 border rounded text-sm" title="Limpar filtro por dia">Limpar dia</button>
          )}
          <button onClick={()=>setMonthOnly(v=>!v)} className="px-3 py-2 border rounded text-sm">{monthOnly ? 'Este Mês' : 'Todos'}</button>
          <button onClick={()=>setShowFilters(v=>!v)} className="px-3 py-2 border rounded text-sm">Filtros</button>
        </div>
        {/* métricas */}
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-500">Total</div>
            <div className="text-green-600 font-semibold">{formatCurrency(totalValor)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Vendas realizadas</div>
            <div className="text-green-600 font-semibold">{vendasRealizadas}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Ticket Médio</div>
            <div className="text-green-600 font-semibold">{formatCurrency(ticketMedio)}</div>
          </div>
        </div>
        {/* Tabs e ações */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            {tabs.map(t => (
              <button key={t.key} onClick={()=>setTab(t.key)} className={`pb-2 ${tab===t.key ? 'text-green-600 border-b-2 border-green-600 font-semibold' : 'text-gray-600'}`}>{t.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button className="px-3 py-2 border rounded text-sm">Opções</button>
            <button onClick={()=>setNewSaleOpen(true)} className="px-3 py-2 rounded text-sm bg-green-600 text-white">+ Nova Venda</button>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="mt-4 bg-white rounded-lg shadow overflow-hidden">
        <div className="grid grid-cols-[6rem_1fr_8rem_10rem_8rem_8rem_8rem] items-center px-4 py-3 text-xs text-gray-500 border-b">
          <div>Venda</div>
          <div>Cliente</div>
          <div className="text-center">Fiscal</div>
          <div className="text-center">Meio de Pg.</div>
          <div className="text-center">Data</div>
          <div className="text-right">Valor</div>
          <div className="text-center">Status</div>
        </div>
        {filtered.map(o => (
          <div key={o.id} className="grid grid-cols-[6rem_1fr_8rem_10rem_8rem_8rem_8rem] items-center px-4 py-3 border-b last:border-0">
            <div className="text-sm">#{String(o.id).slice(-4)}</div>
            <div className="text-sm">{o.client || '-'}</div>
            <div className="text-sm text-center">{o.fiscal ? '📄' : '-'}</div>
            <div className="text-sm text-center">{firstPaymentMethod(o)}</div>
            <div className="text-sm text-center">{formatDate(o.createdAt)}</div>
            <div className="text-sm text-right">{formatCurrency(Number(o.valor || o.total || 0))}</div>
            <div className="text-sm text-center">
              <div className={`px-2 py-1 rounded text-xs ${((o.status ?? '').toLowerCase()==='venda') ? 'bg-green-100 text-green-700' : ( (o.status ?? '').toLowerCase()==='pedido' ? 'bg-yellow-100 text-yellow-700' : ( (o.status ?? '').toLowerCase()==='cancelada' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-700' ))}`}>{o.status || 'Indef.'}</div>
            </div>
          </div>
        ))}
        {!filtered.length && (
          <div className="px-4 py-6 text-sm text-gray-600">Nenhuma venda encontrada.</div>
        )}
      </div>

      {/* Modal Nova Venda */}
      <NewSaleModal open={newSaleOpen} onClose={()=>setNewSaleOpen(false)} />
    </div>
  )
}
