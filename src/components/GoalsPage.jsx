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
  // Aceita status que indicam finalização ou faturamento
  if (s.includes('faturada') || s.includes('faturado')) return true
  if (s.includes('finalizada') || s.includes('finalizado')) return true
  
  const exacts = [
    'os finalizada e faturada cliente final',
    'os finalizada e faturada cliente logista',
    'os faturada cliente final',
    'os faturada cliente lojista'
  ]
  if (exacts.includes(s)) return true
  return false
}

export default function GoalsPage({ storeId, owner, viewParams }){
  const [goals, setGoals] = useState([])
  const [orders, setOrders] = useState([])
  const [openNew, setOpenNew] = useState(false)
  const [openNewSeller, setOpenNewSeller] = useState(false)
  const [openEdit, setOpenEdit] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState(null)
  const [tab, setTab] = useState('empresa') // 'empresa' | 'vendedor'
  const [filterType, setFilterType] = useState('all') // 'all' | 'sale' | 'os'
  const [sellers, setSellers] = useState([])

  useEffect(() => {
    if (viewParams?.type) {
      setFilterType(viewParams.type)
    }
  }, [viewParams])

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
    return goals.filter(g => !g.sellerId).filter(g => {
      if (filterType === 'sale') return g.includeSale && !g.includeServiceOrder
      if (filterType === 'os') return g.includeServiceOrder && !g.includeSale
      return true
    }).map(g => {
      const parsed = parseMonthYear(g.monthYear)
      let total = 0
      if (parsed) {
        const { month, year } = parsed
        const vendas = orders.filter(o => {
          const d = toDate(o.createdAt)
          return !!d && isSameMonth(d, month, year) && ((o.status||'').toLowerCase()==='venda' || (o.status||'').toLowerCase()==='cliente final' || (o.status||'').toLowerCase()==='cliente lojista')
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
  }, [goals, orders, filterType])

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
        <h2 className="text-lg font-semibold">
          {filterType === 'sale' ? 'Metas de Vendas' : filterType === 'os' ? 'Metas de O.S.' : 'Metas'}
        </h2>
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
        {tab === 'empresa' && (
          <div className="ml-auto flex gap-2">
            <button 
              onClick={()=>setFilterType('all')} 
              className={`px-3 py-1 rounded text-xs border ${filterType==='all' ? 'bg-gray-100 border-gray-300 font-medium' : 'border-transparent hover:bg-gray-50'}`}
            >
              Todas
            </button>
            <button 
              onClick={()=>setFilterType('sale')} 
              className={`px-3 py-1 rounded text-xs border ${filterType==='sale' ? 'bg-green-50 text-green-700 border-green-200 font-medium' : 'border-transparent hover:bg-gray-50'}`}
            >
              Vendas
            </button>
            <button 
              onClick={()=>setFilterType('os')} 
              className={`px-3 py-1 rounded text-xs border ${filterType==='os' ? 'bg-blue-50 text-blue-700 border-blue-200 font-medium' : 'border-transparent hover:bg-gray-50'}`}
            >
              O.S.
            </button>
          </div>
        )}
      </div>

      {tab==='empresa' ? (
      <div className="mt-4 overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[8rem_1fr_1fr_1fr] px-4 py-3 text-xs text-gray-500 border-b">
          <div>Mês</div>
          <div className="text-right">Valor</div>
          <div className="text-right">Meta</div>
          <div className="text-right">Tipo</div>
        </div>
        {rows.map(r => (
          <button
            key={r.id}
            type="button"
            className="w-full grid grid-cols-[8rem_1fr_1fr_1fr] items-center px-4 py-3 border-b last:border-0 text-left hover:bg-gray-50"
            onClick={() => { setSelectedGoal(r); setOpenEdit(true) }}
          >
            <div className="text-sm font-medium text-gray-900">{r.monthYear}</div>
            <div className="text-sm font-medium text-gray-900 text-right">{formatCurrency(r.value)}</div>
            <div className="text-sm font-medium text-gray-900 text-right">{formatCurrency(r.target)}</div>
            <div className="text-sm text-right">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${r.includeSale && r.includeServiceOrder ? 'bg-purple-50 text-purple-700 border-purple-200' : r.includeSale ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                {typeLabel(r)}
              </span>
            </div>
          </button>
        ))}
        {!rows.length && (
          <div className="px-4 py-6 text-sm text-gray-600 text-center">Nenhuma meta definida.</div>
        )}
      </div>
      ) : (
      <div className="mt-4 overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[8rem_1fr_1fr_1fr_10rem] px-4 py-3 text-xs text-gray-500 border-b">
          <div>Mês</div>
          <div className="text-right">Valor</div>
          <div className="pl-4">Vendedor</div>
          <div className="text-right">Meta</div>
          <div className="text-right">Tipo</div>
        </div>
        {sellerRows.map(r => (
          <div key={r.id} className="grid grid-cols-[8rem_1fr_1fr_1fr_10rem] items-center px-4 py-3 border-b last:border-0">
            <div className="text-sm font-medium text-gray-900">{r.monthYear}</div>
            <div className="text-sm font-medium text-gray-900 text-right">{formatCurrency(r.value)}</div>
            <div className="text-sm text-gray-600 pl-4">{r.sellerName}</div>
            <div className="text-sm font-medium text-gray-900 text-right">{formatCurrency(r.target)}</div>
            <div className="text-sm text-right">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium border border-green-200">Venda</span>
            </div>
          </div>
        ))}
        {!sellerRows.length && (
          <div className="px-4 py-6 text-sm text-gray-600 text-center">Nenhuma meta de vendedor definida.</div>
        )}
      </div>
      )}
      
      <NewGoalModal open={openNew} onClose={() => setOpenNew(false)} storeId={storeId} initialType={filterType} />
      <EditGoalModal open={openEdit} onClose={() => { setOpenEdit(false); setSelectedGoal(null) }} goal={selectedGoal} />
      <NewSellerGoalModal open={openNewSeller} onClose={() => setOpenNewSeller(false)} storeId={storeId} sellers={sellers} />
    </div>
  )
}
