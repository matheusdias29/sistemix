import React, { useEffect, useMemo, useState } from 'react'
import { listenGoals } from '../services/goals'
import { listenOrders } from '../services/orders'
import NewGoalModal from './NewGoalModal'
import NewSellerGoalModal from './NewSellerGoalModal'
import { listenSubUsers } from '../services/users'
import EditGoalModal from './EditGoalModal'

function parseMonthYear(mmYY){
  const m = String(mmYY || '').match(/^(0?[1-9]|1[0-2])\/(\d{4})$/)
  if (!m) return null
  return { month: Number(m[1]), year: Number(m[2]) }
}

function isSameMonth(d, month, year){
  return d.getMonth()+1===month && d.getFullYear()===year
}

function toDate(ts){
  return ts?.toDate?.() ? ts.toDate() : (ts ? new Date(ts) : null)
}

function isOsFinalizadaFaturada(status){
  const s = (status || '').toLowerCase()
  const exacts = [
    'os finalizada e faturada cliente final',
    'os finalizada e faturada cliente logista',
  ]
  if (exacts.includes(s)) return true
  return s.includes('finalizada') && s.includes('faturada') && (s.includes('cliente final') || s.includes('cliente logista'))
}

export default function GoalsPage({ storeId, owner }){
  const [goals, setGoals] = useState([])
  const [orders, setOrders] = useState([])
  const [openNew, setOpenNew] = useState(false)
  const [openNewSeller, setOpenNewSeller] = useState(false)
  const [openEdit, setOpenEdit] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState(null)
  const [tab, setTab] = useState('empresa') // 'empresa' | 'vendedor'
  const [sellers, setSellers] = useState([])

  useEffect(() => {
    const unsubG = listenGoals(items => setGoals(items), storeId)
    const unsubO = listenOrders(items => setOrders(items), storeId)
    let unsubS = null
    if (owner?.id) {
      unsubS = listenSubUsers(owner.id, list => setSellers(list.filter(u => u.isSeller || /vendedor/i.test(String(u.name||'')))))
    }
    return () => { unsubG && unsubG(); unsubO && unsubO(); unsubS && unsubS() }
  }, [storeId, owner?.id])

  const rows = useMemo(() => {
    return goals.filter(g => !g.sellerId).map(g => {
      const parsed = parseMonthYear(g.monthYear)
      let total = 0
      if (parsed) {
        const { month, year } = parsed
        const vendas = orders.filter(o => {
          const d = toDate(o.createdAt)
          return !!d && isSameMonth(d, month, year) && (o.status||'').toLowerCase()==='venda'
        })
        const os = orders.filter(o => {
          const d = toDate(o.createdAt)
          return !!d && isSameMonth(d, month, year) && isOsFinalizadaFaturada(o.status)
        })
        if (g.includeSale) total += vendas.reduce((acc, o) => acc + Number(o.valor || o.total || 0), 0)
        if (g.includeServiceOrder) total += os.reduce((acc, o) => acc + Number(o.total || o.valor || 0), 0)
      }
      return { ...g, value: total }
    })
  }, [goals, orders])

  // Metas por vendedor
  const sellerRows = useMemo(() => {
    return goals.filter(g => !!g.sellerId).map(g => {
      const parsed = parseMonthYear(g.monthYear)
      let total = 0
      if (parsed) {
        const { month, year } = parsed
        // OBS: para calcular por vendedor, é necessário que cada venda registre sellerId.
        // Enquanto isso, valor permanece 0.
        total = 0
      }
      const sellerName = g.sellerName || (sellers.find(s => s.id===g.sellerId)?.name) || '-'
      return { ...g, value: total, sellerName }
    })
  }, [goals, orders, sellers])

  const formatCurrency = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const typeLabel = (g) => g.includeSale && g.includeServiceOrder ? 'Venda + Ordem de Serviço' : (g.includeSale ? 'Venda' : 'Ordem de Serviço')

  return (
    <div className="rounded-lg bg-white p-4 md:p-6 shadow">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Metas</h2>
        {tab==='empresa' ? (
          <button className="h-9 px-3 rounded bg-green-600 text-white text-sm" onClick={() => setOpenNew(true)}>+ Novo</button>
        ) : (
          <button className="h-9 px-3 rounded bg-green-600 text-white text-sm" onClick={() => setOpenNewSeller(true)}>+ Novo</button>
        )}
      </div>

      {/* Tabs */}
      <div className="mt-4 flex items-center gap-6 text-sm">
        <button onClick={()=>setTab('empresa')} className={`pb-2 ${tab==='empresa' ? 'text-green-600 border-b-2 border-green-600 font-semibold' : 'text-gray-600'}`}>Empresa</button>
        <button onClick={()=>setTab('vendedor')} className={`pb-2 ${tab==='vendedor' ? 'text-green-600 border-b-2 border-green-600 font-semibold' : 'text-gray-600'}`}>Vendedor</button>
      </div>

      {tab==='empresa' ? (
      <div className="mt-4 overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[12rem_12rem_12rem_1fr] px-4 py-3 text-xs text-gray-500 border-b">
          <div>Mês</div>
          <div>Valor</div>
          <div>Meta</div>
          <div className="text-left">Tipo</div>
        </div>
        {rows.map(r => (
          <button
            key={r.id}
            type="button"
            className="grid grid-cols-[12rem_12rem_12rem_1fr] items-center px-4 py-3 border-b last:border-0 text-left hover:bg-gray-50"
            onClick={() => { setSelectedGoal(r); setOpenEdit(true) }}
          >
            <div className="text-sm">{r.monthYear}</div>
            <div className="text-sm">{formatCurrency(r.value)}</div>
            <div className="text-sm">{formatCurrency(r.target)}</div>
            <div className="text-sm">
              <span className="inline-flex items-center px-2 py-1 rounded bg-green-50 text-green-700 text-xs border border-green-200">{typeLabel(r)}</span>
            </div>
          </button>
        ))}
        {!rows.length && (
          <div className="px-4 py-6 text-sm text-gray-600">Nenhuma meta definida.</div>
        )}
      </div>
      ) : (
      <div className="mt-4 overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[10rem_12rem_1fr_12rem_8rem] px-4 py-3 text-xs text-gray-500 border-b">
          <div>Mês</div>
          <div>Valor</div>
          <div>Vendedor</div>
          <div>Meta</div>
          <div className="text-left">Tipo</div>
        </div>
        {sellerRows.map(r => (
          <div key={r.id} className="grid grid-cols-[10rem_12rem_1fr_12rem_8rem] items-center px-4 py-3 border-b last:border-0">
            <div className="text-sm">{r.monthYear}</div>
            <div className="text-sm">{formatCurrency(r.value)}</div>
            <div className="text-sm">{r.sellerName}</div>
            <div className="text-sm">{formatCurrency(r.target)}</div>
            <div className="text-sm">
              <span className="inline-flex items-center px-2 py-1 rounded bg-green-50 text-green-700 text-xs border border-green-200">Venda</span>
            </div>
          </div>
        ))}
        {!sellerRows.length && (
          <div className="px-4 py-6 text-sm text-gray-600">Nenhuma meta de vendedor definida.</div>
        )}
      </div>
      )}

      <NewGoalModal open={openNew} onClose={() => setOpenNew(false)} storeId={storeId} />
      <EditGoalModal open={openEdit} onClose={() => { setOpenEdit(false); setSelectedGoal(null) }} goal={selectedGoal} />
      <NewSellerGoalModal open={openNewSeller} onClose={() => setOpenNewSeller(false)} storeId={storeId} sellers={sellers} />
    </div>
  )
}
