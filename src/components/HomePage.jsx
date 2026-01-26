import React, { useEffect, useMemo, useState } from 'react'
import { listenOrders } from '../services/orders'
import { listenClients } from '../services/clients'
import { listenStore } from '../services/stores'
import CommissionsModal from './CommissionsModal'
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
  BarChart2,
  Users,
  Briefcase,
  User
} from 'lucide-react'

export default function HomePage({ storeId, onNavigate, onOpenSalesDay }){
  const [orders, setOrders] = useState([])
  const [clients, setClients] = useState([])
  const [hideValues, setHideValues] = useState(false)
  const [goals, setGoals] = useState([])
  const [showCommissions, setShowCommissions] = useState(false)
  const [store, setStore] = useState(null)

  useEffect(() => {
    const unsub = listenOrders(items => setOrders(items), storeId)
    const unsubClients = listenClients(items => setClients(items), storeId)
    let unsubStore = null
    if (storeId) {
        unsubStore = listenStore(storeId, (data) => setStore(data))
    }
    // lazy import para evitar dependência circular
    let unsubGoals = null
    import('../services/goals').then(({ listenGoals }) => {
      unsubGoals = listenGoals(items => setGoals(items), storeId)
    }).catch(() => {})
    return () => { unsub && unsub(); unsubClients && unsubClients(); unsubGoals && unsubGoals(); unsubStore && unsubStore() }
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
    // Aceita status que indicam finalização ou faturamento
    if (s.includes('faturada') || s.includes('faturado')) return true
    if (s.includes('finalizada') || s.includes('finalizado')) return true
    
    // Fallback para lógica antiga (caso haja status muito específicos que não caíram acima)
    const exacts = [
      'os finalizada e faturada cliente final',
      'os finalizada e faturada cliente logista',
      'os faturada cliente final',
      'os faturada cliente lojista'
    ]
    if (exacts.includes(s)) return true
    return false
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
        const isOs = isOsFinalizadaFaturada(o.status)
        return !!created && (isVenda || isOs) && isSameDay(created, d)
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

  // Metas do mês (separadas por tipo)
  const currentMonthStr = `${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`
  
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

  // Meta Vendas
  const monthGoalSales = useMemo(() => goals.find(g => g.monthYear === currentMonthStr && !g.sellerId && g.includeSale && !g.includeServiceOrder), [goals, currentMonthStr])
  const monthGoalSalesTarget = monthGoalSales ? Number(monthGoalSales.target || 0) : 0
  const monthGoalSalesPct = monthGoalSalesTarget ? Math.min(100, Math.round((monthSalesValue / monthGoalSalesTarget) * 100)) : 0

  // Meta OS
  const monthGoalOS = useMemo(() => goals.find(g => g.monthYear === currentMonthStr && !g.sellerId && g.includeServiceOrder && !g.includeSale), [goals, currentMonthStr])
  const monthGoalOSTarget = monthGoalOS ? Number(monthGoalOS.target || 0) : 0
  const monthGoalOSPct = monthGoalOSTarget ? Math.min(100, Math.round((monthOsValue / monthGoalOSTarget) * 100)) : 0

  const clientTypeSummary = useMemo(() => {
    const res = {
      sales: { final: 0, company: 0 },
      os: { final: 0, company: 0 }
    }

    monthOrders.forEach(o => {
      const status = (o.status || '').toLowerCase()
      if (status.includes('cancelad')) return

      const isSale = status === 'venda' || status === 'cliente final' || status === 'cliente lojista'
      const isOS = isOsFinalizadaFaturada(o.status)

      if (!isSale && !isOS) return

      let type = 'final'
      if (status.includes('lojista')) type = 'company'
      else if (status.includes('final')) type = 'final'
      else if (o.clientId) {
        const c = clients.find(x => x.id === o.clientId)
        if (c && c.isCompany) type = 'company'
      }

      const val = Number(o.total || o.valor || 0)

      if (isSale) {
        res.sales[type] += val
      } else if (isOS) {
        res.os[type] += val
      }
    })

    return res
  }, [monthOrders, clients])

  const performanceSummary = useMemo(() => {
    const attendantMap = {}
    const techMap = {}

    monthOrders.forEach(o => {
      const status = (o.status || '').toLowerCase()
      if (status.includes('cancelad')) return

      const isSale = status === 'venda' || status === 'cliente final' || status === 'cliente lojista'
      const isOS = isOsFinalizadaFaturada(o.status)

      if (isSale && (o.attendantName || o.attendant)) {
        const key = o.attendantId || o.attendant || o.attendantName
        const name = o.attendant || o.attendantName
        if (!attendantMap[key]) attendantMap[key] = { name: name, total: 0 }
        attendantMap[key].total += Number(o.total || o.valor || 0)
      } else if (isOS && (o.technicianName || o.technician)) {
        const key = o.technicianId || o.technician || o.technicianName
        const name = o.technician || o.technicianName
        if (!techMap[key]) techMap[key] = { name: name, total: 0 }
        techMap[key].total += Number(o.total || o.valor || 0)
      }
    })

    const attendants = Object.values(attendantMap).sort((a, b) => b.total - a.total).slice(0, 3)
    const technicians = Object.values(techMap).sort((a, b) => b.total - a.total).slice(0, 3)

    return { attendants, technicians }
  }, [monthOrders])

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
        const isOs = isOsFinalizadaFaturada(o.status)
        return !!created && (isVenda || isOs) && isSameDay(created, d)
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

      {/* Resumo por Tipo de Cliente */}
      <section className="rounded-xl bg-white p-5 md:p-8 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <Briefcase size={24} />
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">Vendas por Cliente (Mês)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Vendas */}
            <div>
                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Vendas
                </h4>
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-white text-green-700 shadow-sm border border-green-100">
                                <User size={16} />
                            </div>
                            <span className="font-medium text-gray-900">Consumidor Final</span>
                        </div>
                        <span className="font-bold text-green-600">{currencyOrHidden(clientTypeSummary.sales.final)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-white text-blue-700 shadow-sm border border-blue-100">
                                <Briefcase size={16} />
                            </div>
                            <span className="font-medium text-gray-900">Lojista</span>
                        </div>
                        <span className="font-bold text-green-600">{currencyOrHidden(clientTypeSummary.sales.company)}</span>
                    </div>
                </div>
            </div>

            {/* OS */}
            <div>
                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Ordens de Serviço
                </h4>
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-white text-green-700 shadow-sm border border-green-100">
                                <User size={16} />
                            </div>
                            <span className="font-medium text-gray-900">Consumidor Final</span>
                        </div>
                        <span className="font-bold text-blue-600">{currencyOrHidden(clientTypeSummary.os.final)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50/50 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-white text-blue-700 shadow-sm border border-blue-100">
                                <Briefcase size={16} />
                            </div>
                            <span className="font-medium text-gray-900">Lojista</span>
                        </div>
                        <span className="font-bold text-blue-600">{currencyOrHidden(clientTypeSummary.os.company)}</span>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* Performance da Equipe */}
      <section className="rounded-xl bg-white p-5 md:p-8 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <Users size={24} />
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">Performance da Equipe</h3>
          </div>
          <button 
            className="h-10 px-4 rounded-lg bg-gray-50 text-green-600 font-bold text-sm hover:bg-green-100 transition-colors" 
            onClick={() => onNavigate && onNavigate('comissoes')}
          >
            Ver comissões
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Vendas */}
            <div>
                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Vendas (Top 3)
                </h4>
                <div className="space-y-3">
                    {performanceSummary.attendants.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">Nenhuma venda registrada.</p>
                    ) : (
                        performanceSummary.attendants.map((a, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-gray-50/50 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-white text-green-700 shadow-sm flex items-center justify-center text-xs font-bold border border-green-100">
                                        {i + 1}
                                    </div>
                                    <span className="font-medium text-gray-900">{a.name}</span>
                                </div>
                                <span className="font-bold text-green-600">{currencyOrHidden(a.total)}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* OS */}
            <div>
                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  O.S. (Top 3)
                </h4>
                <div className="space-y-3">
                    {performanceSummary.technicians.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">Nenhuma O.S. finalizada.</p>
                    ) : (
                        performanceSummary.technicians.map((t, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-gray-50/50 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-white text-blue-700 shadow-sm flex items-center justify-center text-xs font-bold border border-blue-100">
                                        {i + 1}
                                    </div>
                                    <span className="font-medium text-gray-900">{t.name}</span>
                                </div>
                                <span className="font-bold text-blue-600">{currencyOrHidden(t.total)}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Meta Vendas */}
            <div>
                 <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      Vendas
                    </h4>
                    <button 
                        className="text-xs font-bold text-green-600 hover:text-green-700 hover:underline"
                        onClick={() => onNavigate && onNavigate('metas', { type: 'sale' })}
                    >
                        Ver detalhes
                    </button>
                 </div>
                 
                 {/* Progress Bar & Values */}
                 <div className="mt-4 flex items-end gap-2 text-gray-900">
                    <span className="text-2xl font-extrabold tracking-tight">{currencyOrHidden(monthSalesValue)}</span>
                    <span className="text-lg font-medium text-gray-400 mb-1">/</span>
                    <span className="text-lg font-bold text-gray-500 mb-1">{monthGoalSalesTarget ? currencyOrHidden(monthGoalSalesTarget) : 'Definir'}</span>
                 </div>
                 <div className="mt-4 h-3 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${monthGoalSalesPct}%` }} />
                 </div>
                 <div className="mt-2 text-right text-sm font-bold text-gray-500">{monthGoalSalesPct}%</div>
            </div>

            {/* Meta OS */}
            <div>
                 <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Ordens de Serviço
                    </h4>
                    <button 
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                        onClick={() => onNavigate && onNavigate('metas', { type: 'os' })}
                    >
                        Ver detalhes
                    </button>
                 </div>

                 {/* Progress Bar & Values */}
                 <div className="mt-4 flex items-end gap-2 text-gray-900">
                    <span className="text-2xl font-extrabold tracking-tight">{currencyOrHidden(monthOsValue)}</span>
                    <span className="text-lg font-medium text-gray-400 mb-1">/</span>
                    <span className="text-lg font-bold text-gray-500 mb-1">{monthGoalOSTarget ? currencyOrHidden(monthGoalOSTarget) : 'Definir'}</span>
                 </div>
                 <div className="mt-4 h-3 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${monthGoalOSPct}%` }} />
                 </div>
                 <div className="mt-2 text-right text-sm font-bold text-gray-500">{monthGoalOSPct}%</div>
            </div>
        </div>
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

      <CommissionsModal 
        open={showCommissions} 
        onClose={() => setShowCommissions(false)} 
        orders={monthOrders}
        store={store}
      />
    </div>
  )
}
