import React, { useEffect, useMemo, useState } from 'react'
import { listenOrders } from '../services/orders'

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

  const vendasHoje = useMemo(() => todayOrders.filter(o => (o.status || '').toLowerCase() === 'venda'), [todayOrders])
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
        const isVenda = (o.status || '').toLowerCase() === 'venda'
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
    .filter(o => (o.status||'').toLowerCase()==='venda')
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
        const isVenda = (o.status || '').toLowerCase() === 'venda'
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
      <section className="rounded-lg bg-gray-50 p-4 md:p-6 shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700">🧾</span>
            <h2 className="text-base md:text-lg font-semibold">Resumo do Dia</h2>
          </div>
          <button
            className="h-9 w-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600"
            onClick={() => setHideValues(v => !v)}
            aria-label={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
            title={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
          >
            <span>{hideValues ? '🙈' : '👁️'}</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card Total de Venda */}
            <button
              onClick={() => onNavigate && onNavigate('vendas')}
              className="text-left p-4 border rounded-lg hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-600">🛒</span>
                  <span>Total de Venda ({vendasHoje.length})</span>
                </div>
                <span className="text-gray-400">›</span>
              </div>
              <div className="mt-2 text-2xl md:text-3xl font-bold text-green-600">{currencyOrHidden(totalVendasHoje)}</div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span>Ticket Médio</span>
                  <span title="Média por venda">ℹ️</span>
                </div>
                <div className="text-sm text-green-600 font-semibold">{currencyOrHidden(ticketMedioVendasHoje)}</div>
              </div>
            </button>

            {/* Card OS Finalizada */}
            <button
              onClick={() => onNavigate && onNavigate('os')}
              className="text-left p-4 border rounded-lg hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-600">🔧</span>
                  <span>Ordem de Serviço Finalizada ({osFinalizadasHoje.length})</span>
                </div>
                <span className="text-gray-400">›</span>
              </div>
              <div className="mt-2 text-2xl md:text-3xl font-bold text-green-600">{currencyOrHidden(totalOsHoje)}</div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span>Ticket Médio</span>
                  <span title="Média por OS">ℹ️</span>
                </div>
                <div className="text-sm text-green-600 font-semibold">{currencyOrHidden(ticketMedioOsHoje)}</div>
              </div>
            </button>
        </div>
      </section>

      {/* Últimos dias */}
      <section className="rounded-lg bg-gray-50 p-4 md:p-6 shadow">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700">📅</span>
          <h3 className="text-base md:text-lg font-semibold">Últimos dias</h3>
        </div>

        <div className="mt-4 divide-y">
          {lastDays.map((it, idx) => (
            <button
              key={idx}
              onClick={() => handleOpenDay(it.date)}
              className="w-full text-left px-2 md:px-3 py-4 hover:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-gray-600">📅</span>
                  <div>
                    <div className="text-sm md:text-base font-medium text-gray-800">{formatLongDate(it.date)}</div>
                    <div className="text-xs text-gray-500">Ver vendas deste dia</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-green-600 font-semibold text-sm md:text-base">{currencyOrHidden(it.total)}</div>
                  <span className="text-gray-400">›</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Metas do Mês */}
      <section className="rounded-lg bg-gray-50 p-4 md:p-6 shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700">📈</span>
            <h3 className="text-base md:text-lg font-semibold">Metas do Mês</h3>
          </div>
          <button className="h-9 px-3 rounded border text-sm" onClick={() => onNavigate && onNavigate('metas')}>Ver todas ↗</button>
        </div>
        <div className="mt-3">
          <span className="inline-flex items-center px-2 py-1 rounded bg-green-50 text-green-700 text-xs border border-green-200">{monthGoalTypeLabel}</span>
        </div>
        <div className="mt-3 text-sm text-gray-700">
          <span className="mr-1">{currencyOrHidden(monthProgressValue)}</span>
          <span>/</span>
          <span className="ml-1">{currencyOrHidden(monthGoalTarget)}</span>
        </div>
        <div className="mt-3 h-2 rounded bg-gray-200 overflow-hidden">
          <div className="h-full bg-green-600" style={{ width: `${monthProgressPct}%` }} />
        </div>
        <div className="mt-1 text-right text-xs text-gray-500">{monthProgressPct}%</div>
      </section>

      {/* Vendas x Lucro */}
      <section className="rounded-lg bg-gray-50 p-4 md:p-6 shadow">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700">💹</span>
          <h3 className="text-base md:text-lg font-semibold">Vendas x Lucro</h3>
        </div>
        <div className="mt-4">
          <div className="grid grid-cols-5 gap-6 md:gap-8 items-end h-48">
            {last5DaysSalesProfit.map((d, idx) => {
              const salesH = Math.round((d.sales / maxBarValue) * 100)
              const profitH = Math.round((d.profit / maxBarValue) * 100)
              const dd = String(d.date.getDate()).padStart(2,'0')
              const mm = String(d.date.getMonth()+1).padStart(2,'0')
              const yyyy = d.date.getFullYear()
              return (
                <div key={idx} className="flex flex-col items-center justify-end h-full">
                  {/* valores compactos acima das barras */}
                  <div className="mb-2 text-[11px] md:text-xs text-gray-700">
                    <span className="mr-3 text-green-700">{formatCompactCurrency(d.sales)}</span>
                    <span className="text-green-900">{formatCompactCurrency(d.profit)}</span>
                  </div>
                  <div className="flex items-end gap-2 w-full justify-center">
                    <div className="w-8 md:w-10 bg-green-400 rounded" style={{ height: `${salesH}%` }} title={`Vendas: ${formatCurrency(d.sales)}`} />
                    <div className="w-8 md:w-10 bg-green-700 rounded" style={{ height: `${profitH}%` }} title={`Lucro: ${formatCurrency(d.profit)}`} />
                  </div>
                  <div className="mt-2 text-[11px] md:text-xs text-gray-600">{dd}/{mm}/{yyyy}</div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
