import React, { useEffect, useMemo, useState } from 'react'
import { listenOrders } from '../services/orders'
import { 
  Receipt, 
  Eye, 
  EyeOff, 
  ShoppingCart, 
  Wrench, 
  Info, 
  Calendar, 
  ChevronRight, 
  TrendingUp, 
  BarChart2 
} from 'lucide-react'

export default function HomePage({ storeId, onNavigate, onOpenSalesDay }){
  const [orders, setOrders] = useState([])
  const [hideValues, setHideValues] = useState(false)
  const [goals, setGoals] = useState([])

  useEffect(() => {
    const unsub = listenOrders(items => setOrders(items), storeId)
    // lazy import para evitar dependência circular
    let unsubGoals = null
    import('../services/goals').then(({ listenGoals }) => {
      unsubGoals = listenGoals(items => setGoals(items), storeId)
    }).catch(() => {})
    return () => { unsub && unsub(); unsubGoals && unsubGoals() }
  }, [storeId])

  const toDate = (ts) => ts?.toDate?.() ? ts.toDate() : (ts ? new Date(ts) : null)
  const isSameDay = (a, b) => (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )

  const today = new Date()

  const todayOrders = useMemo(() => orders.filter(o => {
    const d = toDate(o.createdAt)
    return d ? isSameDay(d, today) : false
  }), [orders])

  const vendasHoje = useMemo(() => todayOrders.filter(o => {
    const s = (o.status || '').toLowerCase()
    return s === 'venda' || s === 'cliente final' || s === 'cliente lojista'
  }), [todayOrders])
  function isOsFinalizadaFaturada(status){
    const s = (status || '').toLowerCase()
    const exacts = [
      'os finalizada e faturada cliente final',
      'os finalizada e faturada cliente logista',
      'os faturada cliente final',
      'os faturada cliente lojista'
    ]
    if (exacts.includes(s)) return true
    return (s.includes('finalizada') || s.includes('faturada')) && (s.includes('cliente final') || s.includes('cliente logista') || s.includes('cliente lojista'))
  }
  const osFinalizadasHoje = useMemo(() => todayOrders.filter(o => isOsFinalizadaFaturada(o.status)), [todayOrders])

  const totalVendasHoje = useMemo(() => vendasHoje.reduce((acc, o) => acc + Number(o.valor || o.total || 0), 0), [vendasHoje])
  const ticketMedioVendasHoje = useMemo(() => vendasHoje.length ? totalVendasHoje / vendasHoje.length : 0, [vendasHoje, totalVendasHoje])

  const totalOsHoje = useMemo(() => osFinalizadasHoje.reduce((acc, o) => acc + Number(o.total || o.valor || 0), 0), [osFinalizadasHoje])
  const ticketMedioOsHoje = useMemo(() => osFinalizadasHoje.length ? totalOsHoje / osFinalizadasHoje.length : 0, [osFinalizadasHoje, totalOsHoje])

  const formatCurrency = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const currencyOrHidden = (n) => hideValues ? '—' : formatCurrency(n)
  const formatLongDate = (d) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

  const lastDays = useMemo(() => {
    // Últimos 5 dias (inclui ontem até 5 dias atrás)
    const days = []
    for (let i = 1; i <= 5; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const vendasNoDia = orders.filter(o => {
        const created = toDate(o.createdAt)
        const s = (o.status || '').toLowerCase()
        const isVenda = s === 'venda' || s === 'cliente final' || s === 'cliente lojista'
        return !!created && isVenda && isSameDay(created, d)
      })
      const totalNoDia = vendasNoDia.reduce((acc, o) => acc + Number(o.valor || o.total || 0), 0)
      days.push({ date: d, total: totalNoDia })
    }
    return days
  }, [orders])

  function handleOpenDay(day){
    if (typeof onOpenSalesDay === 'function') {
      onOpenSalesDay(day)
    } else if (typeof onNavigate === 'function') {
      onNavigate('vendas')
    }
  }

  // Metas do mês (sumariza vendas + OS conforme configuração)
  const currentMonthStr = `${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`
  const monthGoal = useMemo(() => goals.find(g => g.monthYear === currentMonthStr) || null, [goals, currentMonthStr])
  const monthGoalTarget = monthGoal ? Number(monthGoal.target || 0) : 0
  const monthOrders = useMemo(() => orders.filter(o => {
    const d = toDate(o.createdAt)
    return d ? d.getMonth()===today.getMonth() && d.getFullYear()===today.getFullYear() : false
  }), [orders])
  const monthSalesValue = useMemo(() => monthOrders
    .filter(o => {
      const s = (o.status||'').toLowerCase()
      return s==='venda'||s==='cliente final'||s==='cliente lojista'
    })
    .reduce((acc, o) => acc + Number(o.valor || o.total || 0), 0), [monthOrders])
  const monthOsValue = useMemo(() => monthOrders
    .filter(o => isOsFinalizadaFaturada(o.status))
    .reduce((acc, o) => acc + Number(o.total || o.valor || 0), 0), [monthOrders])
  const monthProgressValue = useMemo(() => {
    if (!monthGoal) return 0
    let v = 0
    if (monthGoal.includeSale) v += monthSalesValue
    if (monthGoal.includeServiceOrder) v += monthOsValue
    return v
  }, [monthGoal, monthSalesValue, monthOsValue])
  const monthProgressPct = monthGoalTarget ? Math.min(100, Math.round((monthProgressValue / monthGoalTarget) * 100)) : 0
  const monthGoalTypeLabel = monthGoal ? (monthGoal.includeSale && monthGoal.includeServiceOrder ? 'Venda + Ordem de Serviço' : (monthGoal.includeSale ? 'Venda' : 'Ordem de Serviço')) : 'Venda + Ordem de Serviço'

  // Vendas x Lucro (últimos 5 dias)
  const formatCompactCurrency = (n) => {
    try {
      return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n||0))
    } catch (_) {
      const v = Number(n||0)
      if (v >= 1000000) return `${(v/1000000).toFixed(1)} mi`
      if (v >= 1000) return `${(v/1000).toFixed(1)} mil`
      return String(v.toFixed(0))
    }
  }
  const getOrderRevenue = (o) => Number(o.valor || o.total || 0)
  const getOrderCost = (o) => {
    const items = Array.isArray(o.products) ? o.products : []
    const costFromItems = items.reduce((s,p)=> s + ((parseFloat(p.cost)||0) * (parseFloat(p.quantity)||0)), 0)
    if (costFromItems > 0) return costFromItems
    // Fallback: assume custo médio de 65% do valor quando não há custo nos itens
    return getOrderRevenue(o) * 0.65
  }
  const last5DaysSalesProfit = useMemo(() => {
    const days = []
    for (let i = 1; i <= 5; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const daySales = orders.filter(o => {
        const created = toDate(o.createdAt)
        const s = (o.status || '').toLowerCase()
        const isVenda = s === 'venda' || s === 'cliente final' || s === 'cliente lojista'
        return !!created && isVenda && isSameDay(created, d)
      })
      const sales = daySales.reduce((acc, o) => acc + getOrderRevenue(o), 0)
      const profit = daySales.reduce((acc, o) => acc + Math.max(0, getOrderRevenue(o) - getOrderCost(o)), 0)
      days.push({ date: d, sales, profit })
    }
    return days
  }, [orders])
  const maxBarValue = useMemo(() => {
    const all = last5DaysSalesProfit.flatMap(d => [d.sales, d.profit])
    const m = Math.max(0, ...all)
    return m || 1
  }, [last5DaysSalesProfit])

  return (
    <div className="space-y-6">
      {/* Resumo do Dia */}
      <section className="rounded-xl bg-white p-5 md:p-8 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <Receipt size={24} />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">Resumo do Dia</h2>
          </div>
          <button
            className="h-10 w-10 rounded-full hover:bg-gray-50 flex items-center justify-center text-gray-500 transition-colors"
            onClick={() => setHideValues(v => !v)}
            aria-label={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
            title={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
          >
            {hideValues ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card Total de Venda */}
            <button
              onClick={() => onNavigate && onNavigate('vendas')}
              className="text-left p-6 border border-gray-100 rounded-xl bg-gray-50/50 hover:bg-white hover:shadow-md hover:border-green-100 transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-md bg-white shadow-sm text-green-600">
                    <ShoppingCart size={18} />
                  </div>
                  <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Total de Vendas ({vendasHoje.length})</span>
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-green-500 transition-colors" />
              </div>
              <div className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
                {currencyOrHidden(totalVendasHoje)}
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-500">
                  <span>Ticket Médio</span>
                  <Info size={14} className="text-gray-400" />
                </div>
                <div className="text-base font-bold text-green-600">{currencyOrHidden(ticketMedioVendasHoje)}</div>
              </div>
            </button>

            {/* Card OS Finalizada */}
            <button
              onClick={() => onNavigate && onNavigate('os')}
              className="text-left p-6 border border-gray-100 rounded-xl bg-gray-50/50 hover:bg-white hover:shadow-md hover:border-green-100 transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-md bg-white shadow-sm text-green-600">
                    <Wrench size={18} />
                  </div>
                  <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">OS Finalizadas ({osFinalizadasHoje.length})</span>
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-green-500 transition-colors" />
              </div>
              <div className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
                {currencyOrHidden(totalOsHoje)}
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-500">
                  <span>Ticket Médio</span>
                  <Info size={14} className="text-gray-400" />
                </div>
                <div className="text-base font-bold text-green-600">{currencyOrHidden(ticketMedioOsHoje)}</div>
              </div>
            </button>
        </div>
      </section>

      {/* Últimos dias */}
      <section className="rounded-xl bg-white p-5 md:p-8 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-green-50 text-green-600">
            <Calendar size={24} />
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">Últimos dias</h3>
        </div>

        <div className="divide-y divide-gray-100">
          {lastDays.map((it, idx) => (
            <button
              key={idx}
              onClick={() => handleOpenDay(it.date)}
              className="w-full text-left py-5 hover:bg-gray-50 transition-colors group px-2 rounded-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-full bg-gray-100 text-gray-500 group-hover:bg-white group-hover:text-green-600 transition-colors shadow-sm">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <div className="text-base md:text-lg font-bold text-gray-900">{formatLongDate(it.date)}</div>
                    <div className="text-sm font-medium text-gray-500">Ver vendas deste dia</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-base md:text-lg font-extrabold text-green-600 tracking-tight">{currencyOrHidden(it.total)}</div>
                  <ChevronRight size={20} className="text-gray-300 group-hover:text-green-500 transition-colors" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Metas do Mês */}
      <section className="rounded-xl bg-white p-5 md:p-8 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <TrendingUp size={24} />
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">Metas do Mês</h3>
          </div>
          <button 
            className="h-10 px-4 rounded-lg bg-gray-50 text-green-600 font-bold text-sm hover:bg-green-100 transition-colors" 
            onClick={() => onNavigate && onNavigate('metas')}
          >
            Ver todas
          </button>
        </div>
        <div className="mt-4">
          <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-bold uppercase tracking-wide border border-green-100">
            {monthGoalTypeLabel}
          </span>
        </div>
        <div className="mt-4 flex items-end gap-2 text-gray-900">
          <span className="text-2xl font-extrabold tracking-tight">{currencyOrHidden(monthProgressValue)}</span>
          <span className="text-lg font-medium text-gray-400 mb-1">/</span>
          <span className="text-lg font-bold text-gray-500 mb-1">{currencyOrHidden(monthGoalTarget)}</span>
        </div>
        <div className="mt-4 h-3 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-green-500 rounded-full" style={{ width: `${monthProgressPct}%` }} />
        </div>
        <div className="mt-2 text-right text-sm font-bold text-gray-500">{monthProgressPct}%</div>
      </section>

      {/* Vendas x Lucro */}
      <section className="rounded-xl bg-white p-5 md:p-8 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-green-50 text-green-600">
            <BarChart2 size={24} />
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">Vendas x Lucro</h3>
        </div>
        <div className="mt-6">
          <div className="grid grid-cols-5 gap-2 md:gap-8 items-end h-64">
            {[...last5DaysSalesProfit].reverse().map((d, idx) => {
              const salesH = Math.round((d.sales / maxBarValue) * 100)
              const profitH = Math.round((d.profit / maxBarValue) * 100)
              const dd = String(d.date.getDate()).padStart(2,'0')
              const mm = String(d.date.getMonth()+1).padStart(2,'0')
              const yyyy = d.date.getFullYear()
              return (
                <div key={idx} className="flex flex-col items-center justify-end h-full group">
                  {/* valores compactos acima das barras */}
                  <div className="mb-2 text-[10px] md:text-xs font-bold flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{formatCompactCurrency(d.sales)}</span>
                    <span className="text-green-800 bg-green-100 px-1.5 py-0.5 rounded">{formatCompactCurrency(d.profit)}</span>
                  </div>
                  
                  {/* Container das barras com altura fixa para o percentual funcionar */}
                  <div className="flex items-end gap-1 md:gap-2 w-full justify-center h-40">
                    <div className="w-5 md:w-12 bg-green-300 rounded-t-sm hover:bg-green-400 transition-colors relative group/bar" style={{ height: `${salesH}%` }} title={`Vendas: ${formatCurrency(d.sales)}`}>
                    </div>
                    <div className="w-5 md:w-12 bg-green-600 rounded-t-sm hover:bg-green-700 transition-colors relative group/bar" style={{ height: `${profitH}%` }} title={`Lucro: ${formatCurrency(d.profit)}`}>
                    </div>
                  </div>

                  <div className="mt-2 text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wide">
                    {dd}/{mm}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
