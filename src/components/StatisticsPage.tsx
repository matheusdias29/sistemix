import React, { useEffect, useMemo, useState } from 'react'
import { listenOrders } from '../services/orders'
import { listenAccountsPayable } from '../services/accountsPayable'
import { listenAccountsReceivable } from '../services/accountsReceivable'
import { listenCurrentCash, getClosedCashRegisters } from '../services/cash'
import { listenProducts } from '../services/products'
import { listenCategories } from '../services/categories'
import SalesDateFilterModal from './SalesDateFilterModal'
import { ArrowRight, ChevronRight, Package, TrendingUp, DollarSign } from 'lucide-react'

type StatisticsPageProps = {
  storeId?: string
  user?: any
}

type OrderPayment = {
  method?: string
  amount?: number
}

type Order = {
  id: string
  type?: string
  status?: string
  createdAt?: any
  valor?: number
  total?: number
  totalProducts?: number
  products?: { name?: string; category?: string; cost?: number; quantity?: number }[]
  client?: string
  attendant?: string
  payments?: OrderPayment[]
  discount?: number
}

type DateRange = {
  label: string
  start: Date | null
  end: Date | null
}

type SimpleOption = {
  id: string
  name: string
}

type AccountPayable = {
  id: string
  supplierId?: string | null
  supplierName?: string
  categoryId?: string | null
  categoryName?: string
  description?: string
  details?: string
  isRecurring?: boolean
  originalValue?: number
  paidValue?: number
  remainingValue?: number
  dueDate?: any
  paymentDate?: any
  status?: string
}

type AccountReceivable = {
  id: string
  clientId?: string | null
  clientName?: string
  description?: string
  value?: number
  paidValue?: number
  remainingValue?: number
  dueDate?: any
  paymentDate?: any
  status?: string
  type?: string
  receivedBy?: string
}

type CashRegister = {
  id: string
  number?: number
  status?: string
  openedAt?: any
  closedAt?: any
  initialValue?: number
  currentBalance?: number
  closingValues?: {
    finalBalance?: number
    sales?: number
    os?: number
    totalIn?: number
    totalOut?: number
  } | null
}

type Product = {
  id: string
  name?: string
  cost?: number
  salePrice?: number
  stock?: number
  categoryId?: string
  active?: boolean
}

type Category = {
  id: string
  name?: string
}

const TABS = [
  'Vendas',
  'Vendas/Período',
  'Ordens De Serviço',
  'Contas A Pagar',
  'Contas A Receber',
  'Caixa',
  'Notas Fiscais',
  'Estoque',
  'DRE',
] as const

type TabKey = (typeof TABS)[number]

function isSale(order: Order): boolean {
  const t = (order.type || '').toLowerCase()
  const s = (order.status || '').toLowerCase()
  if (t === 'sale') return true
  return s === 'venda' || s === 'cliente final' || s === 'cliente lojista' || s === 'pedido'
}

function getOrderDate(order: Order): Date | null {
  const ts: any = (order as any).createdAt
  if (!ts) return null
  if (typeof ts.toDate === 'function') return ts.toDate()
  return new Date(ts)
}

function normalizeCategory(name?: string | null): string {
  if (!name) return 'Sem Categoria'
  return String(name).trim() || 'Sem Categoria'
}

function formatCurrency(value: number): string {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseDueDate(raw: any): Date | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    if (!raw.includes('-')) return null
    const [y, m, d] = raw.split('-').map(Number)
    if (!y || !m || !d) return null
    return new Date(y, m - 1, d, 12, 0, 0, 0)
  }
  if (typeof raw.toDate === 'function') {
    return raw.toDate()
  }
  return null
}

function toDateTime(raw: any): Date | null {
  if (!raw) return null
  if (typeof raw.toDate === 'function') {
    return raw.toDate()
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function formatDateTime(raw: any): string {
  const d = toDateTime(raw)
  if (!d) return ''
  return `${d.toLocaleDateString('pt-BR')} ${d
    .toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    .replace(':', 'h')}`
}

export default function StatisticsPage({ storeId, user }: StatisticsPageProps) {
  const isOwner = !user?.memberId
  const perms = user?.permissions || {}

  const availableTabs = useMemo(() => {
    if (isOwner) return TABS
    
    return TABS.filter(t => {
      if (t === 'Vendas') return true
      if (t === 'Vendas/Período') return true
      if (t === 'Ordens De Serviço') return perms.serviceOrders?.view
      if (t === 'Contas A Pagar') return perms.payables?.view
      if (t === 'Contas A Receber') return perms.receivables?.view
      if (t === 'Caixa') return perms.cash?.view
      if (t === 'Notas Fiscais') return isOwner // Geralmente restrito
      if (t === 'Estoque') return perms.products?.edit || perms.products?.create
      if (t === 'DRE') return isOwner // DRE é sensível
      return true
    })
  }, [isOwner, perms])

  if (!isOwner && !perms.statistics?.view) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <p className="text-lg font-medium">Acesso Negado</p>
        <p className="text-sm">Você não tem permissão para visualizar estatísticas.</p>
      </div>
    )
  }

  const [orders, setOrders] = useState<Order[]>([])
  const [payables, setPayables] = useState<AccountPayable[]>([])
  const [receivables, setReceivables] = useState<AccountReceivable[]>([])
  const [currentCash, setCurrentCash] = useState<CashRegister | null>(null)
  const [closedCash, setClosedCash] = useState<CashRegister[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categoriesList, setCategoriesList] = useState<Category[]>([])
  const [activeTab, setActiveTab] = useState<TabKey>('Vendas')
  const [dateFilterOpen, setDateFilterOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filterClient, setFilterClient] = useState('')
  const [filterSeller, setFilterSeller] = useState('')
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('')
  const [selectClientOpen, setSelectClientOpen] = useState(false)
  const [selectSellerOpen, setSelectSellerOpen] = useState(false)
  const [selectPaymentOpen, setSelectPaymentOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'Dia' | 'Semana' | 'Mês'>('Dia')
  const [viewModeDropdownOpen, setViewModeDropdownOpen] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date()
    return {
      label: 'Este Mês',
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    }
  })

  useEffect(() => {
    const unsub = listenOrders((items: Order[]) => setOrders(items), storeId)
    return () => unsub && unsub()
  }, [storeId])

  useEffect(() => {
    if (!storeId) return
    const unsub = listenAccountsPayable(
      (items: AccountPayable[]) => setPayables(items),
      storeId
    )
    return () => unsub && unsub()
  }, [storeId])

  useEffect(() => {
    if (!storeId) return
    const unsub = listenAccountsReceivable(
      (items: AccountReceivable[]) => setReceivables(items),
      storeId
    )
    return () => unsub && unsub()
  }, [storeId])

  useEffect(() => {
    if (!storeId) return
    const unsub = listenCurrentCash(storeId, cash => {
      setCurrentCash(cash as CashRegister | null)
    })
    return () => unsub && unsub()
  }, [storeId])

  useEffect(() => {
    let cancelled = false
    async function loadClosed() {
      if (!storeId) {
        setClosedCash([])
        return
      }
      try {
        const list = await getClosedCashRegisters(storeId)
        if (!cancelled) {
          setClosedCash(list as CashRegister[])
        }
      } catch {
        if (!cancelled) {
          setClosedCash([])
        }
      }
    }
    loadClosed()
    return () => {
      cancelled = true
    }
  }, [storeId])

  useEffect(() => {
    if (!storeId) return
    const unsub = listenProducts((items: any[]) => setProducts(items), storeId)
    return () => unsub && unsub()
  }, [storeId])

  useEffect(() => {
    if (!storeId) return
    const unsub = listenCategories((items: any[]) => setCategoriesList(items), storeId)
    return () => unsub && unsub()
  }, [storeId])

  const salesInPeriod = useMemo(() => {
    return orders.filter(o => {
      if (!isSale(o)) return false
      const d = getOrderDate(o)
      if (!d) return false
      const { start, end } = dateRange
      if (!start || !end) return true
      return d >= start && d <= end
    })
  }, [orders, dateRange])

  const serviceOrdersInPeriod = useMemo(() => {
    return orders.filter(o => {
      if (isSale(o)) return false
      const d = getOrderDate(o)
      if (!d) return false
      const { start, end } = dateRange
      if (!start || !end) return true
      return d >= start && d <= end
    })
  }, [orders, dateRange])

  const clientOptions = useMemo<SimpleOption[]>(() => {
    const seen = new Set<string>()
    const list: SimpleOption[] = []
    salesInPeriod.forEach(o => {
      const name = (o.client || '').trim()
      if (!name || seen.has(name)) return
      seen.add(name)
      list.push({ id: name, name })
    })
    return list
  }, [salesInPeriod])

  const sellerOptions = useMemo<SimpleOption[]>(() => {
    const seen = new Set<string>()
    const list: SimpleOption[] = []
    salesInPeriod.forEach(o => {
      const name = (o.attendant || '').trim()
      if (!name || seen.has(name)) return
      seen.add(name)
      list.push({ id: name, name })
    })
    return list
  }, [salesInPeriod])

  const paymentOptions = useMemo<SimpleOption[]>(() => {
    const seen = new Set<string>()
    const list: SimpleOption[] = []
    salesInPeriod.forEach(o => {
      const payments = Array.isArray(o.payments) ? o.payments : []
      payments.forEach(p => {
        const name = (p.method || '').trim()
        if (!name || seen.has(name)) return
        seen.add(name)
        list.push({ id: name, name })
      })
    })
    return list
  }, [salesInPeriod])

  const filteredSales = useMemo(() => {
    return salesInPeriod.filter(o => {
      if (filterClient) {
        if (!(o.client || '').toLowerCase().includes(filterClient.toLowerCase())) {
          return false
        }
      }
      if (filterSeller) {
        if (!(o.attendant || '').toLowerCase().includes(filterSeller.toLowerCase())) {
          return false
        }
      }
      if (filterPaymentMethod) {
        const pm = filterPaymentMethod.toLowerCase()
        const payments = Array.isArray(o.payments) ? o.payments : []
        const hasPayment = payments.some(p => (p.method || '').toLowerCase() === pm)
        if (!hasPayment) {
          return false
        }
      }
      return true
    })
  }, [salesInPeriod, filterClient, filterSeller, filterPaymentMethod])

  const filteredServiceOrders = useMemo(() => {
    return serviceOrdersInPeriod.filter(o => {
      if (filterClient) {
        if (!(o.client || '').toLowerCase().includes(filterClient.toLowerCase())) {
          return false
        }
      }
      if (filterSeller) {
        if (!(o.attendant || '').toLowerCase().includes(filterSeller.toLowerCase())) {
          return false
        }
      }
      if (filterPaymentMethod) {
        const pm = filterPaymentMethod.toLowerCase()
        const payments = Array.isArray(o.payments) ? o.payments : []
        const hasPayment = payments.some(p => (p.method || '').toLowerCase() === pm)
        if (!hasPayment) {
          return false
        }
      }
      return true
    })
  }, [serviceOrdersInPeriod, filterClient, filterSeller, filterPaymentMethod])

  const chartData = useMemo(() => {
    if (activeTab !== 'Vendas/Período') return []
    if (!dateRange.start || !dateRange.end) return []

    const start = new Date(dateRange.start)
    const end = new Date(dateRange.end)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)

    const getKey = (d: Date) => {
      if (viewMode === 'Dia') return d.toISOString().split('T')[0]
      if (viewMode === 'Mês')
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (viewMode === 'Semana') {
        const temp = new Date(d)
        temp.setHours(0, 0, 0, 0)
        const day = temp.getDay()
        const diff = temp.getDate() - day + (day === 0 ? -6 : 1)
        const monday = new Date(temp.setDate(diff))
        return monday.toISOString().split('T')[0]
      }
      return ''
    }

    const getLabel = (d: Date) => {
      if (viewMode === 'Dia') return d.toLocaleDateString('pt-BR')
      if (viewMode === 'Mês')
        return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
      if (viewMode === 'Semana') {
        const temp = new Date(d)
        temp.setHours(0, 0, 0, 0)
        const day = temp.getDay()
        const diff = temp.getDate() - day + (day === 0 ? -6 : 1)
        const monday = new Date(temp.setDate(diff))
        return `Sem. ${monday.getDate()}/${monday.getMonth() + 1}`
      }
      return ''
    }

    type Bucket = {
      vendas: number
      custo: number
    }

    const buckets = new Map<string, Bucket>()

    filteredSales.forEach(o => {
      const d = getOrderDate(o)
      if (!d) return
      if (d < start || d > end) return
      const key = getKey(d)
      if (!key) return

      const current = buckets.get(key) || { vendas: 0, custo: 0 }
      const venda = Number(o.valor ?? o.total ?? 0)

      const items = Array.isArray(o.products) ? o.products : []
      const costFromItems = items.reduce(
        (s, p) => s + Number(p.cost || 0) * Number(p.quantity || 0),
        0
      )
      const custo = costFromItems > 0 ? costFromItems : venda * 0.65

      current.vendas += venda
      current.custo += custo
      buckets.set(key, current)
    })

    const sortedKeys = Array.from(buckets.keys()).sort((a, b) => {
      const da = new Date(a).getTime()
      const db = new Date(b).getTime()
      return da - db
    })

    const result = sortedKeys.map(key => {
      const bucket = buckets.get(key) as Bucket
      const baseDate = new Date(key)
      const label = getLabel(baseDate)
      const lucro = Math.max(0, bucket.vendas - bucket.custo)
      return {
        key,
        label,
        venda: bucket.vendas,
        lucro,
      }
    })

    return result
  }, [filteredSales, viewMode, activeTab, dateRange])

  const maxChartValue = useMemo(() => {
    return (
      chartData.reduce(
        (m, d) => Math.max(m, d.venda, d.lucro),
        0
      ) || 1
    )
  }, [chartData])


  const payablesPaidInPeriod = useMemo(() => {
    return payables.filter(acc => {
      if (acc.status !== 'paid') return false
      const d = toDateTime(acc.paymentDate)
      if (!d) return false
      const { start, end } = dateRange
      if (!start || !end) return true
      return d >= start && d <= end
    })
  }, [payables, dateRange])

  const receivablesReceivedInPeriod = useMemo(() => {
    return receivables.filter(acc => {
      if (acc.status !== 'paid' && acc.status !== 'received') return false
      const d = toDateTime(acc.paymentDate)
      if (!d) return false
      const { start, end } = dateRange
      if (!start || !end) return true
      return d >= start && d <= end
    })
  }, [receivables, dateRange])

  const cashFlowByDay = useMemo(() => {
    const map = new Map<string, { entries: number; exits: number }>()

    const add = (d: Date | null, val: number, type: 'entries' | 'exits') => {
      if (!d) return
      const key = d.toISOString().split('T')[0]
      const cur = map.get(key) || { entries: 0, exits: 0 }
      cur[type] += val
      map.set(key, cur)
    }

    filteredSales.forEach(o => add(getOrderDate(o), Number(o.valor ?? o.total ?? 0), 'entries'))
    filteredServiceOrders.forEach(o => add(getOrderDate(o), Number(o.total ?? o.valor ?? 0), 'entries'))
    receivablesReceivedInPeriod.forEach(r => add(toDateTime(r.paymentDate), Number(r.paidValue ?? r.value ?? 0), 'entries'))
    payablesPaidInPeriod.forEach(p => add(toDateTime(p.paymentDate), Number(p.paidValue ?? p.originalValue ?? 0), 'exits'))

    const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    return sorted.map(([date, vals]) => ({
      date,
      ...vals,
      net: vals.entries - vals.exits
    }))
  }, [filteredSales, filteredServiceOrders, receivablesReceivedInPeriod, payablesPaidInPeriod])

  const maxDailyValue = useMemo(() => {
    return cashFlowByDay.reduce((max, d) => Math.max(max, Math.abs(d.net)), 0) || 1
  }, [cashFlowByDay])

  const salesByMethod = useMemo(() => {
    const map = new Map<string, number>()
    filteredSales.forEach(o => {
      const payments = Array.isArray(o.payments) && o.payments.length ? o.payments : [{ method: 'Outros', amount: o.valor ?? o.total }]
      payments.forEach(p => {
        const key = (p.method || 'Outros').trim()
        map.set(key, (map.get(key) || 0) + Number(p.amount || 0))
      })
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [filteredSales])

  const osByMethod = useMemo(() => {
    const map = new Map<string, number>()
    filteredServiceOrders.forEach(o => {
      const payments = Array.isArray(o.payments) && o.payments.length ? o.payments : [{ method: 'Outros', amount: o.valor ?? o.total }]
      payments.forEach(p => {
        const key = (p.method || 'Outros').trim()
        map.set(key, (map.get(key) || 0) + Number(p.amount || 0))
      })
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [filteredServiceOrders])

  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>()
    payablesPaidInPeriod.forEach(p => {
      const key = (p.categoryName || 'Outras despesas').trim()
      map.set(key, (map.get(key) || 0) + Number(p.paidValue ?? p.originalValue ?? 0))
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [payablesPaidInPeriod])

  const totalReceivablesValue = receivablesReceivedInPeriod.reduce((s, r) => s + Number(r.paidValue ?? r.value ?? 0), 0)
  const totalPayablesValue = payablesPaidInPeriod.reduce((s, p) => s + Number(p.paidValue ?? p.originalValue ?? 0), 0)
  const totalSalesValue = filteredSales.reduce((s, o) => s + Number(o.valor ?? o.total ?? 0), 0)
  const totalOSValue = filteredServiceOrders.reduce((s, o) => s + Number(o.total ?? o.valor ?? 0), 0)
  
  const resultValue = (totalSalesValue + totalOSValue + totalReceivablesValue) - totalPayablesValue

  const totalSales = useMemo(
    () => filteredSales.reduce((sum, o) => sum + Number(o.valor ?? o.total ?? 0), 0),
    [filteredSales]
  )

  const totalCost = useMemo(() => {
    return filteredSales.reduce((sum, o) => {
      const items = Array.isArray(o.products) ? o.products : []
      const costFromItems = items.reduce(
        (s, p) => s + (Number(p.cost || 0) * Number(p.quantity || 0)),
        0
      )
      if (costFromItems > 0) return sum + costFromItems
      return sum + Number(o.valor ?? o.total ?? 0) * 0.65
    }, 0)
  }, [filteredSales])

  const profit = Math.max(0, totalSales - totalCost)
  const profitPct = totalSales > 0 ? (profit / totalSales) * 100 : 0
  const avgTicket = filteredSales.length ? totalSales / filteredSales.length : 0

  const sellers = useMemo(() => {
    const map = new Map<string, number>()
    filteredSales.forEach(o => {
      const key = o.attendant || 'Sem vendedor'
      const current = map.get(key) || 0
      map.set(key, current + Number(o.valor ?? o.total ?? 0))
    })
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filteredSales])

  const categories = useMemo(() => {
    const map = new Map<string, number>()
    filteredSales.forEach(o => {
      const items = Array.isArray(o.products) ? o.products : []
      items.forEach(p => {
        const label = normalizeCategory(p.category || p.name)
        const current = map.get(label) || 0
        const lineValue = Number(p.quantity || 0) * Number(o.totalProducts ?? o.total ?? 0) /
          Math.max(1, items.length)
        map.set(label, current + lineValue)
      })
    })
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [filteredSales])

  const paymentSummary = useMemo(() => {
    const map = new Map<string, number>()
    filteredSales.forEach(o => {
      const payments = Array.isArray(o.payments) && o.payments.length
        ? o.payments
        : [{ method: 'Outros', amount: o.valor ?? o.total }]
      payments.forEach(p => {
        const key = p.method || 'Outros'
        const current = map.get(key) || 0
        map.set(key, current + Number(p.amount || 0))
      })
    })
    const list = Array.from(map.entries())
      .map(([method, value]) => ({ method, value }))
      .sort((a, b) => b.value - a.value)
    const total = list.reduce((s, it) => s + it.value, 0)
    const segments = list.map((it, index) => {
      const pct = total > 0 ? (it.value / total) * 100 : 0
      return { ...it, pct, colorIndex: index }
    })
    return { segments, total }
  }, [filteredSales])

  const osProductsTotal = useMemo(() => {
    return filteredServiceOrders.reduce((sum, o) => {
      if (typeof o.totalProducts === 'number') {
        return sum + Number(o.totalProducts || 0)
      }
      const items = Array.isArray(o.products) ? o.products : []
      const fromItems = items.reduce(
        (s, p) =>
          s +
          (Number((p as any).price || (p as any).total || 0) *
            Number(p.quantity || 0)),
        0
      )
      return sum + fromItems
    }, 0)
  }, [filteredServiceOrders])

  const osTotalValue = useMemo(
    () =>
      filteredServiceOrders.reduce(
        (sum, o) => sum + Number(o.total ?? o.valor ?? 0),
        0
      ),
    [filteredServiceOrders]
  )

  const osServicesTotal = Math.max(0, osTotalValue - osProductsTotal)

  const osCostTotal = useMemo(() => {
    return filteredServiceOrders.reduce((sum, o) => {
      const items = Array.isArray(o.products) ? o.products : []
      const costFromItems = items.reduce(
        (s, p) => s + (Number(p.cost || 0) * Number(p.quantity || 0)),
        0
      )
      if (costFromItems > 0) return sum + costFromItems
      return sum + Number(o.total ?? o.valor ?? 0) * 0.65
    }, 0)
  }, [filteredServiceOrders])

  const osProfit = Math.max(0, osTotalValue - osCostTotal)
  const osProfitPct = osTotalValue > 0 ? (osProfit / osTotalValue) * 100 : 0
  const osAvgTicket =
    filteredServiceOrders.length > 0
      ? osTotalValue / filteredServiceOrders.length
      : 0

  const osStatusStats = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>()
    filteredServiceOrders.forEach(o => {
      const key = (o.status || 'Sem status').trim() || 'Sem status'
      const current = map.get(key) || { count: 0, total: 0 }
      const value = Number(o.total ?? o.valor ?? 0)
      map.set(key, { count: current.count + 1, total: current.total + value })
    })
    return Array.from(map.entries())
      .map(([status, info]) => ({ status, ...info }))
      .sort((a, b) => b.total - a.total)
  }, [filteredServiceOrders])

  const osPaymentSummary = useMemo(() => {
    const map = new Map<string, number>()
    filteredServiceOrders.forEach(o => {
      const payments =
        Array.isArray(o.payments) && o.payments.length
          ? o.payments
          : [{ method: 'Outros', amount: o.valor ?? o.total }]
      payments.forEach(p => {
        const key = p.method || 'Outros'
        const current = map.get(key) || 0
        map.set(key, current + Number(p.amount || 0))
      })
    })
    const list = Array.from(map.entries())
      .map(([method, value]) => ({ method, value }))
      .sort((a, b) => b.value - a.value)
    const total = list.reduce((s, it) => s + it.value, 0)
    const segments = list.map((it, index) => {
      const pct = total > 0 ? (it.value / total) * 100 : 0
      return { ...it, pct, colorIndex: index }
    })
    return { segments, total }
  }, [filteredServiceOrders])

  const donutColors = [
    '#15803d',
    '#16a34a',
    '#22c55e',
    '#4ade80',
    '#bbf7d0',
    '#0f766e',
    '#14b8a6',
  ]

  const maxCategory = categories.reduce((m, c) => (c.value > m ? c.value : m), 0) || 1
  const maxBarHeight = 220

  const filteredPayables = useMemo(() => {
    return payables.filter(acc => {
      const { start, end } = dateRange
      if (!start || !end) return true
      const d = parseDueDate(acc.dueDate)
      if (!d) return false
      return d >= start && d <= end
    })
  }, [payables, dateRange])

  const payablesSummary = useMemo(() => {
    let totalPending = 0
    let totalPaid = 0
    let totalOverdue = 0

    const byCategory = new Map<string, number>()
    const bySupplier = new Map<string, number>()

    const now = new Date()

    filteredPayables.forEach(acc => {
      const status = (acc.status || 'pending').toLowerCase()
      const remaining = Number(acc.remainingValue ?? 0)
      const original = Number(acc.originalValue ?? 0)
      const paid = Number(acc.paidValue ?? 0)

      if (status === 'pending') {
        totalPending += remaining || original
        const due = parseDueDate(acc.dueDate)
        if (due && due < now) {
          totalOverdue += remaining || original
        }
      } else if (status === 'paid') {
        totalPaid += paid || original
      }

      const baseValue =
        status === 'pending'
          ? remaining || original
          : status === 'paid'
          ? paid || original
          : original || remaining

      if (baseValue <= 0) return

      const catLabel = normalizeCategory(acc.categoryName)
      const supplierLabel =
        (acc.supplierName || 'Sem Fornecedor').trim() || 'Sem Fornecedor'

      byCategory.set(catLabel, (byCategory.get(catLabel) || 0) + baseValue)
      bySupplier.set(supplierLabel, (bySupplier.get(supplierLabel) || 0) + baseValue)
    })

    const categoriesList = Array.from(byCategory.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)

    const suppliersList = Array.from(bySupplier.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)

    const maxCategoryValue =
      categoriesList.reduce((m, c) => (c.value > m ? c.value : m), 0) || 1
    const maxSupplierValue =
      suppliersList.reduce((m, c) => (c.value > m ? c.value : m), 0) || 1

    return {
      totalPending,
      totalPaid,
      totalOverdue,
      categories: categoriesList,
      suppliers: suppliersList,
      maxCategoryValue,
      maxSupplierValue,
    }
  }, [filteredPayables])

  const filteredReceivables = useMemo(() => {
    return receivables.filter(acc => {
      const { start, end } = dateRange
      if (!start || !end) return true
      const d = parseDueDate(acc.dueDate)
      if (!d) return false
      return d >= start && d <= end
    })
  }, [receivables, dateRange])

  const receivablesSummary = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]

    let totalReceivable = 0
    let totalOverdue = 0
    let totalCredits = 0

    type Group = {
      receivedBy: string
      totalDebit: number
      totalOverdue: number
      totalCredit: number
      countReceivable: number
      countOverdue: number
      countCredit: number
    }

    const groups = new Map<string, Group>()

    filteredReceivables.forEach(acc => {
      if (acc.status !== 'pending') return

      const isCredit = acc.type === 'credit'
      const remaining = Number(acc.remainingValue ?? acc.value ?? 0)

      if (isCredit) {
        totalCredits += remaining
      } else {
        totalReceivable += remaining
        if (typeof acc.dueDate === 'string' && acc.dueDate < today) {
          totalOverdue += remaining
        }
      }

      const key = acc.receivedBy || 'Sem Funcionário'
      let group = groups.get(key)
      if (!group) {
        group = {
          receivedBy: key,
          totalDebit: 0,
          totalOverdue: 0,
          totalCredit: 0,
          countReceivable: 0,
          countOverdue: 0,
          countCredit: 0,
        }
        groups.set(key, group)
      }

      if (isCredit) {
        group.totalCredit += remaining
        group.countCredit += 1
      } else {
        group.totalDebit += remaining
        if (typeof acc.dueDate === 'string' && acc.dueDate < today) {
          group.totalOverdue += remaining
          group.countOverdue += 1
        } else {
          group.countReceivable += 1
        }
      }
    })

    const grouped = Array.from(groups.values())

    return {
      totalReceivable,
      totalOverdue,
      totalCredits,
      grouped,
    }
  }, [filteredReceivables])

  const filteredClosedCash = useMemo(() => {
    const { start, end } = dateRange
    if (!start || !end) return closedCash
    return closedCash.filter(c => {
      const d = toDateTime(c.openedAt)
      if (!d) return false
      return d >= start && d <= end
    })
  }, [closedCash, dateRange])

  const closedCashSummary = useMemo(() => {
    if (!filteredClosedCash.length) {
      return {
        count: 0,
        totalFinalBalance: 0,
        totalSales: 0,
        totalOs: 0,
      }
    }
    let count = 0
    let totalFinalBalance = 0
    let totalSales = 0
    let totalOs = 0
    filteredClosedCash.forEach(c => {
      count += 1
      const closing = c.closingValues || {}
      totalFinalBalance += Number(
        closing.finalBalance ?? c.currentBalance ?? c.initialValue ?? 0
      )
      totalSales += Number(closing.sales ?? 0)
      totalOs += Number(closing.os ?? 0)
    })
    return {
      count,
      totalFinalBalance,
      totalSales,
      totalOs,
    }
  }, [filteredClosedCash])

  const cashChartData = useMemo(() => {
    if (!filteredClosedCash.length) return []
    const sorted = [...filteredClosedCash].sort((a, b) => {
      const da = toDateTime(a.openedAt)?.getTime() || 0
      const db = toDateTime(b.openedAt)?.getTime() || 0
      return da - db
    })
    return sorted.map(c => {
      const closing = c.closingValues || {}
      const finalBalance = Number(
        closing.finalBalance ?? c.currentBalance ?? c.initialValue ?? 0
      )
      const label =
        c.number != null
          ? `#${String(c.number).padStart(3, '0')}`
          : toDateTime(c.openedAt)?.toLocaleDateString('pt-BR') || ''
      return {
        key: c.id,
        label,
        value: finalBalance,
      }
    })
  }, [filteredClosedCash])

  const maxCashChartValue = useMemo(
    () =>
      cashChartData.reduce(
        (m, item) => (item.value > m ? item.value : m),
        0
      ) || 1,
    [cashChartData]
  )

  // --- ESTOQUE LOGIC ---

  const stockMetrics = useMemo(() => {
    return products.reduce((acc, p) => {
      const stock = Number(p.stock || 0)
      const cost = Number(p.cost || 0)
      const price = Number(p.salePrice || 0)
      return {
        totalCost: acc.totalCost + (cost * stock),
        totalValue: acc.totalValue + (price * stock),
        totalQty: acc.totalQty + stock
      }
    }, { totalCost: 0, totalValue: 0, totalQty: 0 })
  }, [products])

  const stockGiro = useMemo(() => {
    const map = new Map<string, { 
      soldQty: number, 
      soldValue: number, 
      product: Product 
    }>()

    // Map all products first
    products.forEach(p => {
      map.set(p.id, { soldQty: 0, soldValue: 0, product: p })
    })

    // Aggregate sales
    salesInPeriod.forEach(o => {
      const items = Array.isArray(o.products) ? o.products : []
      items.forEach((item: any) => {
        // Need to match by ID if possible, but orders might only have name/id
        // Assuming item.id exists or we match by name if id missing (fallback)
        let pid = item.id
        if (!pid) {
          // Fallback: try to find by name in products list
          const found = products.find(p => p.name === item.name)
          if (found) pid = found.id
        }

        if (pid && map.has(pid)) {
          const current = map.get(pid)!
          const qty = Number(item.quantity || 0)
          const val = Number(item.price || item.total || 0) * qty // price per unit * qty? or total line value
          // item.price is usually unit price. item.total is line total.
          // Let's use item.total if available, else calc
          const lineTotal = item.total ? Number(item.total) : (Number(item.price || 0) * qty)
          
          current.soldQty += qty
          current.soldValue += lineTotal
        }
      })
    })

    const list = Array.from(map.values())
      .filter(i => i.soldQty > 0 || i.product.stock! > 0) // Show items with activity or stock
      .map(i => {
        const stock = Number(i.product.stock || 0)
        // Giro (vezes) = Sold Qty / Stock (if stock 0, use sold qty as proxy or infinity? Let's use Sold/Max(1,Stock))
        // Actually, standard is Sold / Avg Stock. We only have current stock.
        const times = stock > 0 ? i.soldQty / stock : i.soldQty
        
        // Giro (dias). If period is "Este Mês" (30 days).
        // Let's approximate period days based on dateRange
        let daysInPeriod = 30
        if (dateRange.start && dateRange.end) {
          const diff = dateRange.end.getTime() - dateRange.start.getTime()
          daysInPeriod = Math.ceil(diff / (1000 * 3600 * 24))
        }
        
        const days = times > 0 ? daysInPeriod / times : 0
        
        return {
          ...i,
          times,
          days
        }
      })
      .sort((a, b) => b.soldValue - a.soldValue) // Sort by sold value desc

    return list
  }, [products, salesInPeriod, dateRange])

  const stockByCategory = useMemo(() => {
    const map = new Map<string, { qty: number, cost: number, value: number }>()

    products.forEach(p => {
      const catId = p.categoryId
      const catName = categoriesList.find(c => c.id === catId)?.name || 'Sem Categoria'
      const stock = Number(p.stock || 0)
      const cost = Number(p.cost || 0) * stock
      const val = Number(p.salePrice || 0) * stock

      const current = map.get(catName) || { qty: 0, cost: 0, value: 0 }
      current.qty += stock
      current.cost += cost
      current.value += val
      map.set(catName, current)
    })

    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value)
  }, [products, categoriesList])

  // --- DRE LOGIC ---
  const dreData = useMemo(() => {
    // 1. Sales Data
    const salesGross = filteredSales.reduce((acc, o) => acc + (Number(o.total || 0) + Number(o.discount || 0)), 0)
    const salesDiscount = filteredSales.reduce((acc, o) => acc + Number(o.discount || 0), 0)
    const salesNet = salesGross - salesDiscount
    const salesTax = 0 // Placeholder
    const salesNetAfterTax = salesNet - salesTax
    
    const salesCost = filteredSales.reduce((acc, o) => {
       const items = Array.isArray(o.products) ? o.products : []
       const cost = items.reduce((s, p) => s + (Number(p.cost || 0) * Number(p.quantity || 0)), 0)
       if (cost > 0) return acc + cost
       return acc + (Number(o.total || 0) * 0.65)
    }, 0)
    
    const salesProfit = salesNetAfterTax - salesCost

    // 2. OS Data
    const osGross = filteredServiceOrders.reduce((acc, o) => acc + (Number(o.total || 0) + Number(o.discount || 0)), 0)
    const osDiscount = filteredServiceOrders.reduce((acc, o) => acc + Number(o.discount || 0), 0)
    const osNet = osGross - osDiscount
    const osTax = 0
    
    const osProductCost = filteredServiceOrders.reduce((acc, o) => {
       const items = Array.isArray(o.products) ? o.products : []
       const cost = items.reduce((s, p) => s + (Number(p.cost || 0) * Number(p.quantity || 0)), 0)
       return acc + cost
    }, 0)
    
    // Service Cost
    const osServiceCost = 0 
    
    const osProfit = osNet - osTax - osProductCost - osServiceCost

    // 3. Expenses
    const totalExpenses = payablesPaidInPeriod.reduce((acc, p) => acc + Number(p.paidValue || p.originalValue || 0), 0)
    
    const finalResult = (salesProfit + osProfit) - totalExpenses

    return {
      salesGross,
      salesDiscount,
      salesNet,
      salesTax,
      salesNetAfterTax,
      salesCost,
      salesProfit,
      
      osGross,
      osDiscount,
      osNet,
      osTax,
      osProductCost,
      osServiceCost,
      osProfit,
      
      totalExpenses,
      finalResult
    }
  }, [filteredSales, filteredServiceOrders, payablesPaidInPeriod])

  const DreRow = ({ label, value, isPositive, isNegative, bold }: any) => {
    const colorClass = isPositive ? 'text-green-600' : isNegative ? 'text-red-500' : 'text-gray-800'
    return (
      <div className={`flex justify-between py-3 px-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${bold ? 'font-bold' : ''}`}>
        <span className="text-gray-600 text-sm">{label}</span>
        <span className={`font-medium text-sm ${colorClass}`}>
          {formatCurrency(value)}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-[fadeIn_0.18s_ease-out]">
      <div className="border-b border-gray-200">
        <div className="flex flex-wrap gap-4">
          {availableTabs.map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                activeTab === tab
                  ? 'text-green-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute left-0 right-0 -bottom-[1px] h-0.5 bg-green-600 rounded-full transition-all" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-start gap-3">
        <button
          type="button"
          onClick={() => setDateFilterOpen(true)}
          className="px-3 py-1.5 rounded-md border border-green-200 bg-green-50 text-xs font-medium text-green-700 hover:bg-green-100 flex items-center gap-2"
        >
          <span>📅</span>
          <span>{dateRange.label}</span>
        </button>

        {activeTab === 'Vendas/Período' && (
          <div className="relative">
            <button
              onClick={() => setViewModeDropdownOpen(!viewModeDropdownOpen)}
              className="px-3 py-1.5 rounded-md border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <span>Visualizar {viewMode}</span>
              <span>▼</span>
            </button>
            {viewModeDropdownOpen && (
              <div className="absolute top-full left-0 z-10 mt-1 w-32 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                <div className="py-1">
                  {['Dia', 'Semana', 'Mês'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => {
                        setViewMode(mode as any)
                        setViewModeDropdownOpen(false)
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm ${
                        viewMode === mode
                          ? 'bg-green-50 text-green-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab !== 'Vendas/Período' && (
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="px-3 py-1.5 rounded-md border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <span>⚙️</span>
            <span>Filtros</span>
          </button>
        )}
      </div>

      {activeTab === 'Vendas' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_minmax(0,1.1fr)] gap-4">
          <div className="space-y-4">
            <section className="rounded-lg bg-white shadow p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Total de Vendas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-500">Nº Vendas</div>
                    <div className="text-green-700 font-semibold text-base">
                      {filteredSales.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Total de Vendas</div>
                    <div className="text-green-700 font-semibold text-base">
                      {formatCurrency(totalSales)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Lucro (R$)</div>
                    <div className="text-emerald-700 font-semibold text-base">
                      {formatCurrency(profit)}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-500">Ticket Médio</div>
                    <div className="text-green-700 font-semibold text-base">
                      {formatCurrency(avgTicket)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Lucro (%)</div>
                    <div className="text-emerald-700 font-semibold text-base">
                      {profitPct.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-lg bg-white shadow p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Vendedores</h3>
              <div className="space-y-2 text-sm">
                {sellers.length === 0 && (
                  <div className="text-xs text-gray-500">
                    Nenhuma venda encontrada no período selecionado.
                  </div>
                )}
                {sellers.map(s => (
                  <div
                    key={s.name}
                    className="flex items-center justify-between py-1.5 border-b last:border-b-0"
                  >
                    <span className="text-gray-700">{s.name}</span>
                    <span className="text-green-700 font-semibold">
                      {formatCurrency(s.value)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg bg-white shadow p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Vendas por Categoria</h3>
              <div className="space-y-3">
                {categories.length === 0 && (
                  <div className="text-xs text-gray-500">
                    Nenhuma venda categorizada no período selecionado.
                  </div>
                )}
                {categories.map(cat => {
                  const pct = (cat.value / maxCategory) * 100
                  return (
                    <div key={cat.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span className="truncate">{cat.name}</span>
                        <span className="text-green-700 font-medium">
                          {formatCurrency(cat.value)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-600 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>

          <section className="rounded-lg bg-white shadow p-4 flex flex-col">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Meios de pagamento</h3>
            <div className="flex-1 flex flex-col lg:flex-col xl:flex-row gap-4 items-center">
              <div className="relative w-40 h-40">
                <svg viewBox="0 0 36 36" className="w-full h-full">
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9155"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="3"
                  />
                  {paymentSummary.segments.reduce((acc, seg, index) => {
                    const prev = acc.offset
                    const dash = Math.max(0, Math.min(100, seg.pct))
                    const color =
                      donutColors[seg.colorIndex % donutColors.length]
                    acc.elements.push(
                      <circle
                        key={seg.method}
                        cx="18"
                        cy="18"
                        r="15.9155"
                        fill="none"
                        stroke={color}
                        strokeWidth="3"
                        strokeDasharray={`${dash} ${100 - dash}`}
                        strokeDashoffset={-prev}
                        strokeLinecap="round"
                      />
                    )
                    acc.offset += dash
                    return acc
                  }, { offset: 25, elements: [] as JSX.Element[] }).elements}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-xs">
                  <span className="text-gray-500">Total</span>
                  <span className="text-green-700 font-semibold">
                    {formatCurrency(paymentSummary.total)}
                  </span>
                </div>
              </div>
              <div className="flex-1 w-full space-y-2 text-xs">
                {paymentSummary.segments.length === 0 && (
                  <div className="text-gray-500">
                    Nenhuma venda com meio de pagamento registrado neste período.
                  </div>
                )}
                {paymentSummary.segments.map(seg => {
                  const color =
                    donutColors[seg.colorIndex % donutColors.length]
                  return (
                    <div
                      key={seg.method}
                      className="flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-gray-700">{seg.method}</span>
                      </div>
                      <div className="text-right text-xs">
                        <div className="text-green-700 font-semibold">
                          {formatCurrency(seg.value)}
                        </div>
                        <div className="text-gray-500">
                          {seg.pct.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        </div>
      )}

      {(isOwner || perms.serviceOrders?.view) && activeTab === 'Ordens De Serviço' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_minmax(0,1.1fr)] gap-4">
          <div className="space-y-4">
            <section className="rounded-lg bg-white shadow p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">
                Total das ordens de serviço
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-500">Valor em Produtos</div>
                    <div className="text-green-700 font-semibold text-base">
                      {formatCurrency(osProductsTotal)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Valor em Serviços</div>
                    <div className="text-green-700 font-semibold text-base">
                      {formatCurrency(osServicesTotal)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Total Líquido</div>
                    <div className="text-green-700 font-semibold text-base">
                      {formatCurrency(osTotalValue)}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-500">Qtd. Ordens</div>
                    <div className="text-green-700 font-semibold text-base">
                      {filteredServiceOrders.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Ticket Médio</div>
                    <div className="text-green-700 font-semibold text-base">
                      {formatCurrency(osAvgTicket)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Lucro (R$)</div>
                    <div className="text-emerald-700 font-semibold text-base">
                      {formatCurrency(osProfit)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Lucro (%)</div>
                    <div className="text-emerald-700 font-semibold text-base">
                      {osProfitPct.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-lg bg-white shadow p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">
                Ordem de serviço por status
              </h3>
              <div className="space-y-2 text-sm">
                {osStatusStats.length === 0 && (
                  <div className="text-xs text-gray-500">
                    Nenhuma ordem de serviço encontrada no período selecionado.
                  </div>
                )}
                {osStatusStats.map(st => (
                  <div
                    key={st.status}
                    className="flex items-center justify-between py-1.5 border-b last:border-b-0"
                  >
                    <div className="flex flex-col">
                      <span className="text-gray-700">
                        {st.status} ({st.count})
                      </span>
                    </div>
                    <span className="text-green-700 font-semibold">
                      {formatCurrency(st.total)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="rounded-lg bg-white shadow p-4 flex flex-col">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">
              Meios de pagamento
            </h3>
            <div className="flex-1 flex flex-col lg:flex-col xl:flex-row gap-4 items-center">
              <div className="relative w-40 h-40">
                <svg viewBox="0 0 36 36" className="w-full h-full">
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9155"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="3"
                  />
                  {osPaymentSummary.segments.reduce((acc, seg) => {
                    const prev = acc.offset
                    const dash = Math.max(0, Math.min(100, seg.pct))
                    const color =
                      donutColors[seg.colorIndex % donutColors.length]
                    acc.elements.push(
                      <circle
                        key={seg.method}
                        cx="18"
                        cy="18"
                        r="15.9155"
                        fill="none"
                        stroke={color}
                        strokeWidth="3"
                        strokeDasharray={`${dash} ${100 - dash}`}
                        strokeDashoffset={-prev}
                        strokeLinecap="round"
                      />
                    )
                    acc.offset += dash
                    return acc
                  }, { offset: 25, elements: [] as JSX.Element[] }).elements}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-xs">
                  <span className="text-gray-500">Total</span>
                  <span className="text-green-700 font-semibold">
                    {formatCurrency(osPaymentSummary.total)}
                  </span>
                </div>
              </div>
              <div className="flex-1 w-full space-y-2 text-xs">
                {osPaymentSummary.segments.length === 0 && (
                  <div className="text-gray-500">
                    Nenhuma ordem de serviço com meio de pagamento registrado
                    neste período.
                  </div>
                )}
                {osPaymentSummary.segments.map(seg => {
                  const color =
                    donutColors[seg.colorIndex % donutColors.length]
                  return (
                    <div
                      key={seg.method}
                      className="flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-gray-700">{seg.method}</span>
                      </div>
                      <div className="text-right text-xs">
                        <div className="text-green-700 font-semibold">
                          {formatCurrency(seg.value)}
                        </div>
                        <div className="text-gray-500">
                          {seg.pct.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        </div>
      )}

      {(isOwner || perms.payables?.view) && activeTab === 'Contas A Pagar' && (
        <div className="space-y-4">
          <section className="rounded-lg bg-white shadow p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">
              Resumo de contas a pagar
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-gray-500">Total em aberto</div>
                <div className="text-green-700 font-semibold text-base">
                  {formatCurrency(payablesSummary.totalPending)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total pago</div>
                <div className="text-emerald-700 font-semibold text-base">
                  {formatCurrency(payablesSummary.totalPaid)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total vencido</div>
                <div className="text-red-600 font-semibold text-base">
                  {formatCurrency(payablesSummary.totalOverdue)}
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section className="rounded-lg bg-white shadow p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">
                Contas por categoria
              </h3>
              <div className="space-y-3">
                {payablesSummary.categories.length === 0 && (
                  <div className="text-xs text-gray-500">
                    Nenhuma conta encontrada no período selecionado.
                  </div>
                )}
                {payablesSummary.categories.map(cat => {
                  const pct =
                    (cat.value / payablesSummary.maxCategoryValue) * 100
                  return (
                    <div key={cat.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span className="truncate">{cat.name}</span>
                        <span className="text-green-700 font-medium">
                          {formatCurrency(cat.value)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-600 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="rounded-lg bg-white shadow p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">
                Contas por fornecedor
              </h3>
              <div className="space-y-3">
                {payablesSummary.suppliers.length === 0 && (
                  <div className="text-xs text-gray-500">
                    Nenhuma conta encontrada no período selecionado.
                  </div>
                )}
                {payablesSummary.suppliers.map(sup => {
                  const pct =
                    (sup.value / payablesSummary.maxSupplierValue) * 100
                  return (
                    <div key={sup.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span className="truncate">{sup.name}</span>
                        <span className="text-green-700 font-medium">
                          {formatCurrency(sup.value)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        </div>
      )}

      {(isOwner || perms.receivables?.view) && activeTab === 'Contas A Receber' && (
        <div className="space-y-4">
          <section className="rounded-lg bg-white shadow p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">
              Resumo de contas a receber
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-gray-500">Total a receber</div>
                <div className="text-green-700 font-semibold text-base">
                  {formatCurrency(receivablesSummary.totalReceivable)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total vencido</div>
                <div className="text-red-600 font-semibold text-base">
                  {formatCurrency(receivablesSummary.totalOverdue)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total em créditos</div>
                <div className="text-emerald-700 font-semibold text-base">
                  {formatCurrency(receivablesSummary.totalCredits)}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg bg-white shadow p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">
              Contas por funcionário
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-600">
                      Funcionário
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-600">
                      Valor débito
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-600">
                      Valor vencido
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-600">
                      Valor crédito
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-600">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-50">
                  {receivablesSummary.grouped.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-xs text-gray-500"
                      >
                        Nenhuma conta encontrada no período selecionado.
                      </td>
                    </tr>
                  )}
                  {receivablesSummary.grouped.map(group => (
                    <tr key={group.receivedBy}>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700 uppercase">
                        {group.receivedBy}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-xs text-red-500">
                        {group.totalDebit > 0
                          ? formatCurrency(group.totalDebit)
                          : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-xs text-red-500">
                        {group.totalOverdue > 0
                          ? formatCurrency(group.totalOverdue)
                          : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-xs text-green-600">
                        {group.totalCredit > 0
                          ? formatCurrency(group.totalCredit)
                          : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex gap-2 justify-end">
                          {group.countOverdue > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-800">
                              Vencido
                              <span className="ml-1 bg-red-200 text-red-800 rounded-full w-4 h-4 flex items-center justify-center text-[9px]">
                                {group.countOverdue}
                              </span>
                            </span>
                          )}
                          {group.countReceivable > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-800">
                              A Receber
                              <span className="ml-1 bg-orange-200 text-orange-800 rounded-full w-4 h-4 flex items-center justify-center text-[9px]">
                                {group.countReceivable}
                              </span>
                            </span>
                          )}
                          {group.countCredit > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-800">
                              Crédito
                              <span className="ml-1 bg-green-200 text-green-800 rounded-full w-4 h-4 flex items-center justify-center text-[9px]">
                                {group.countCredit}
                              </span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'Vendas/Período' && (
         <div className="space-y-4">
           <div className="rounded-lg bg-white shadow p-4">
             <h3 className="text-sm font-semibold text-gray-800 mb-6 flex items-center gap-2">
               <span className="text-green-600">📊</span> Vendas x {viewMode}
             </h3>
             <div className="w-full overflow-x-auto">
               <div className="min-w-[800px] h-[320px] flex items-end justify-between gap-3 pb-6 px-2">
                 {chartData.map(item => {
                   const vendaHeight = maxChartValue > 0 ? (item.venda / maxChartValue) * maxBarHeight : 0
                   const lucroHeight = maxChartValue > 0 ? (item.lucro / maxChartValue) * maxBarHeight : 0
                   return (
                     <div
                       key={item.key}
                       className="flex flex-col items-center gap-2 min-w-[40px]"
                     >
                       <div className="flex items-end gap-1 w-full">
                         <div className="flex-1 flex flex-col items-center group">
                           <div className="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                             {formatCurrency(item.venda)}
                           </div>
                           <div
                             className="w-full bg-emerald-100 rounded-t-sm relative group-hover:bg-emerald-200 transition-colors"
                             style={{ height: `${Math.max(4, vendaHeight)}px` }}
                           >
                             <div
                               className="absolute bottom-0 left-0 right-0 bg-emerald-500 rounded-t-sm transition-all"
                               style={{ height: `${Math.max(4, vendaHeight)}px` }}
                             />
                           </div>
                           <span className="mt-1 text-[9px] text-gray-500">Venda</span>
                         </div>
                         <div className="flex-1 flex flex-col items-center group">
                           <div className="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                             {formatCurrency(item.lucro)}
                           </div>
                           <div
                             className="w-full bg-green-100 rounded-t-sm relative group-hover:bg-green-200 transition-colors"
                             style={{ height: `${Math.max(4, lucroHeight)}px` }}
                           >
                             <div
                               className="absolute bottom-0 left-0 right-0 bg-green-600 rounded-t-sm transition-all"
                               style={{ height: `${Math.max(4, lucroHeight)}px` }}
                             />
                           </div>
                           <span className="mt-1 text-[9px] text-gray-500">Lucro</span>
                         </div>
                       </div>
                       <div className="mt-1 text-[10px] text-gray-600 whitespace-nowrap text-center">
                         {item.label}
                       </div>
                     </div>
                   )
                 })}
                 {chartData.length === 0 && (
                   <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                     Sem dados para o período selecionado.
                   </div>
                 )}
               </div>
             </div>
           </div>
         </div>
       )}

      {(isOwner || perms.products?.edit || perms.products?.create) && activeTab === 'Estoque' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1.8fr_1.2fr] gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            
            {/* Valor do estoque (Cards) */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 text-lg mb-6">Valor do estoque</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <div className="text-gray-500 font-medium mb-1">Custo do estoque</div>
                  <div className="text-green-600 font-bold text-xl">
                    {formatCurrency(stockMetrics.totalCost)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 font-medium mb-1">Valor em estoque</div>
                  <div className="text-green-600 font-bold text-xl">
                    {formatCurrency(stockMetrics.totalValue)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 font-medium mb-1">Quantidade</div>
                  <div className="text-green-600 font-bold text-xl">
                    {stockMetrics.totalQty.toLocaleString('pt-BR')}
                  </div>
                </div>
              </div>
            </div>

            {/* Giro de Estoque */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Package className="text-green-600" size={24} />
                  <h3 className="font-bold text-gray-800 text-lg">Giro de Estoque</h3>
                </div>
                <button className="text-green-600 text-sm font-medium hover:underline flex items-center gap-1">
                  Ver Mais <ChevronRight size={16} />
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/50 text-gray-500 font-medium text-left">
                    <tr>
                      <th className="py-3 px-2 font-medium">Produto</th>
                      <th className="py-3 px-2 font-medium text-center">Quantidade<br/>Vendida</th>
                      <th className="py-3 px-2 font-medium text-center">Estoque<br/>Atual</th>
                      <th className="py-3 px-2 font-medium text-center">Giro de<br/>estoque (dias)</th>
                      <th className="py-3 px-2 font-medium text-center">Giro de<br/>estoque (vezes)</th>
                      <th className="py-3 px-2 font-medium text-right">Valor<br/>Vendido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {stockGiro.length === 0 && (
                       <tr>
                         <td colSpan={6} className="py-8 text-center text-gray-500">
                           Nenhuma movimentação de estoque encontrada neste período.
                         </td>
                       </tr>
                    )}
                    {stockGiro.slice(0, 5).map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3 px-2 text-gray-800 font-medium max-w-[200px] truncate" title={item.product.name}>
                          {item.product.name}
                        </td>
                        <td className="py-3 px-2 text-center text-gray-700">{item.soldQty}</td>
                        <td className="py-3 px-2 text-center text-red-500 font-medium">{item.product.stock}</td>
                        <td className="py-3 px-2 text-center text-gray-700">{Math.round(item.days)}</td>
                        <td className="py-3 px-2 text-center text-gray-700">{item.times.toFixed(2)}</td>
                        <td className="py-3 px-2 text-right text-gray-800 font-medium">{formatCurrency(item.soldValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Right Column: Estoque por categoria */}
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 h-fit">
            <h3 className="font-bold text-gray-800 text-lg mb-6">Estoque por categoria</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-500 font-medium text-left border-b border-gray-100">
                  <tr>
                    <th className="py-3 px-2 font-medium">Categoria</th>
                    <th className="py-3 px-2 font-medium text-center">Quantidade</th>
                    <th className="py-3 px-2 font-medium text-right">Custo</th>
                    <th className="py-3 px-2 font-medium text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                   {stockByCategory.length === 0 && (
                       <tr>
                         <td colSpan={4} className="py-8 text-center text-gray-500">
                           Nenhum produto cadastrado.
                         </td>
                       </tr>
                    )}
                   {stockByCategory.map((cat, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-2 text-gray-800 uppercase text-xs font-semibold">{cat.name}</td>
                      <td className="py-3 px-2 text-center text-gray-700">{cat.qty}</td>
                      <td className="py-3 px-2 text-right text-gray-700">{cat.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="py-3 px-2 text-right text-gray-700">{cat.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {(isOwner || perms.cash?.view) && activeTab === 'Caixa' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_minmax(0,1.1fr)] gap-4">
          <div className="bg-white rounded-lg shadow p-6 space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-green-600 font-bold text-lg">$</span>
              <h3 className="text-lg font-bold text-gray-800">Entradas x Saídas</h3>
            </div>

            {/* Total Vendas */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-gray-700">Total Vendas</span>
                <span className="font-bold text-green-600">
                  {formatCurrency(totalSalesValue)}
                </span>
              </div>
              <div className="pl-4 space-y-1">
                {salesByMethod.map(([method, value]) => (
                  <div key={method} className="flex justify-between text-sm text-gray-500">
                    <span>{method}</span>
                    <span>{formatCurrency(value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Ordens de Serviço */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-gray-700">Total Ordens de Serviço</span>
                <span className="font-bold text-green-600">
                  {formatCurrency(totalOSValue)}
                </span>
              </div>
              <div className="pl-4 space-y-1">
                {osByMethod.map(([method, value]) => (
                  <div key={method} className="flex justify-between text-sm text-gray-500">
                    <span>{method}</span>
                    <span>{formatCurrency(value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Recebimentos */}
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-700">Total Recebimentos</span>
              <span className="font-bold text-green-600">
                {formatCurrency(totalReceivablesValue)}
              </span>
            </div>

            {/* Total Despesas */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-gray-700">Total Despesas</span>
                <span className="font-bold text-red-600">
                  {formatCurrency(-totalPayablesValue)}
                </span>
              </div>
              <div className="pl-4 space-y-1">
                {expensesByCategory.map(([cat, value]) => (
                  <div key={cat} className="flex justify-between text-sm text-gray-500">
                    <span>{cat}</span>
                    <span>{formatCurrency(-value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Resultado */}
            <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
              <span className="font-bold text-gray-800">Resultado</span>
              <span
                className={`font-bold text-xl ${
                  resultValue >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCurrency(resultValue)}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-green-600 font-bold text-lg">📊</span>
              <h3 className="text-lg font-bold text-gray-800">Caixa</h3>
            </div>

            <div className="flex-1 flex items-end justify-between gap-2 min-h-[300px] w-full overflow-x-auto pb-2">
              {cashFlowByDay.map(day => {
                const val = day.net
                const height =
                  maxDailyValue > 0 ? (Math.abs(val) / maxDailyValue) * 250 : 0
                const isPositive = val >= 0

                return (
                  <div
                    key={day.date}
                    className="flex flex-col items-center gap-1 min-w-[30px] group"
                  >
                    <div className="relative flex items-end h-[250px]">
                      <div
                        className={`w-6 rounded-t-sm transition-all ${
                          isPositive ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{ height: `${Math.max(4, height)}px` }}
                      >
                        <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded whitespace-nowrap z-10 pointer-events-none">
                          {formatCurrency(val)}
                          <div className="text-[10px] opacity-80">
                            {new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-500 text-center">
                      {new Date(day.date + 'T12:00:00').getDate()}
                    </div>
                  </div>
                )
              })}
              {cashFlowByDay.length === 0 && (
                <div className="w-full text-center text-gray-400">
                  Sem dados para o período.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {(isOwner) && activeTab === 'Notas Fiscais' && (
        <div className="rounded-lg bg-white shadow p-6 text-sm text-gray-600">
          Painel da aba <span className="font-semibold">{activeTab}</span> ainda
          será detalhado. As mesmas opções de período e filtros já funcionam
          para todas as abas.
        </div>
      )}

      {(isOwner) && activeTab === 'DRE' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 animate-[fadeIn_0.2s_ease-out]">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-green-50 rounded-lg">
              <TrendingUp className="text-green-600" size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Relatório DRE</h3>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between py-2 px-4 bg-gray-50 rounded-t-lg font-semibold text-gray-700 text-sm">
              <span>Descrição</span>
              <span>Valor</span>
            </div>

            <div className="py-2 px-4 font-bold text-gray-800 bg-gray-50/50 mt-4">Receita bruta</div>
            <DreRow label="Total bruto de vendas" value={dreData.salesGross} isPositive />
            <DreRow label="Total de vendas com desconto" value={dreData.salesNet} isPositive />
            <DreRow label="Total de vendas com desconto das taxas" value={dreData.salesNetAfterTax} isPositive />
            <DreRow label="Total bruto de ordem serviços" value={dreData.osGross} isPositive />

            <div className="py-2 px-4 font-bold text-gray-800 bg-gray-50/50 mt-4">Deduções</div>
            <DreRow label="Custo da mercadoria vendida (CMV)" value={-dreData.salesCost} isNegative />
            <DreRow label="Total de taxas" value={-dreData.salesTax} isNegative />
            <DreRow label="Custo dos produtos O.S." value={-dreData.osProductCost} isNegative />
            <DreRow label="Custo do serviço O.S." value={-dreData.osServiceCost} isNegative />
            <DreRow label="Total de taxas O.S." value={-dreData.osTax} isNegative />
            
            <div className="py-2 px-4 font-bold text-gray-800 bg-gray-50/50 mt-4">Lucro por origem</div>
            <DreRow label="Lucro sobre vendas liquido" value={dreData.salesProfit} isPositive={dreData.salesProfit > 0} isNegative={dreData.salesProfit < 0} />
            <DreRow label="Lucro sobre ordens de serviço liquido" value={dreData.osProfit} isPositive={dreData.osProfit > 0} isNegative={dreData.osProfit < 0} />

            <div className="py-2 px-4 font-bold text-gray-800 bg-gray-50/50 mt-4">Resultado líquido</div>
            <DreRow label="Despesas Operacionais" value={-dreData.totalExpenses} isNegative />
            <div className="flex justify-between py-3 px-4 border-t border-gray-100 mt-2">
              <span className="font-bold text-gray-800">Total de receita líquida</span>
              <span className={`font-bold text-lg ${dreData.finalResult >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(dreData.finalResult)}
              </span>
            </div>
          </div>
        </div>
      )}

      <SalesDateFilterModal
        open={dateFilterOpen}
        onClose={() => setDateFilterOpen(false)}
        onApply={(range: DateRange) => setDateRange(range)}
        currentLabel={dateRange.label}
      />

      <StatsFiltersModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        clientName={filterClient}
        sellerName={filterSeller}
        paymentMethodName={filterPaymentMethod}
        onChooseClient={() => setSelectClientOpen(true)}
        onChooseSeller={() => setSelectSellerOpen(true)}
        onChoosePaymentMethod={() => setSelectPaymentOpen(true)}
        onClear={() => {
          setFilterClient('')
          setFilterSeller('')
          setFilterPaymentMethod('')
        }}
        onApply={() => setFiltersOpen(false)}
      />

      <SelectOptionModal
        open={selectClientOpen}
        title="Selecionar cliente"
        options={clientOptions}
        onClose={() => setSelectClientOpen(false)}
        onChoose={name => {
          setFilterClient(name)
          setSelectClientOpen(false)
        }}
      />

      <SelectOptionModal
        open={selectSellerOpen}
        title="Selecionar vendedor"
        options={sellerOptions}
        onClose={() => setSelectSellerOpen(false)}
        onChoose={name => {
          setFilterSeller(name)
          setSelectSellerOpen(false)
        }}
      />

      <SelectOptionModal
        open={selectPaymentOpen}
        title="Selecionar método de pagamento"
        options={paymentOptions}
        onClose={() => setSelectPaymentOpen(false)}
        onChoose={name => {
          setFilterPaymentMethod(name)
          setSelectPaymentOpen(false)
        }}
      />
    </div>
  )
}

type StatsFiltersModalProps = {
  open: boolean
  onClose: () => void
  clientName: string
  sellerName: string
  paymentMethodName: string
  onChooseClient: () => void
  onChooseSeller: () => void
  onChoosePaymentMethod: () => void
  onClear: () => void
  onApply: () => void
}

function StatsFiltersModal({
  open,
  onClose,
  clientName,
  sellerName,
  paymentMethodName,
  onChooseClient,
  onChooseSeller,
  onChoosePaymentMethod,
  onClear,
  onApply,
}: StatsFiltersModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[2000]">
      <div className="bg-white rounded-lg shadow-lg w-[640px] max-w-[95vw]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Filtrar</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-gray-600">Cliente</label>
            <button
              type="button"
              onClick={onChooseClient}
              className="mt-1 w-full border rounded px-3 py-2 text-sm text-left flex items-center justify-between"
            >
              <span>{clientName || 'Selecionar'}</span>
              <span>›</span>
            </button>
          </div>
          <div>
            <label className="text-xs text-gray-600">Vendedor</label>
            <button
              type="button"
              onClick={onChooseSeller}
              className="mt-1 w-full border rounded px-3 py-2 text-sm text-left flex items-center justify-between"
            >
              <span>{sellerName || 'Selecionar'}</span>
              <span>›</span>
            </button>
          </div>
          <div>
            <label className="text-xs text-gray-600">Método de pagamento</label>
            <button
              type="button"
              onClick={onChoosePaymentMethod}
              className="mt-1 w-full border rounded px-3 py-2 text-sm text-left flex items-center justify-between"
            >
              <span>{paymentMethodName || 'Selecionar'}</span>
              <span>›</span>
            </button>
          </div>
          <div className="mt-2">
            <button
              type="button"
              onClick={onClear}
              className="text-sm text-green-600"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
        <div className="p-4 border-t flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 border rounded text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onApply}
            className="px-3 py-2 rounded text-sm bg-green-600 text-white"
          >
            Filtrar
          </button>
        </div>
      </div>
    </div>
  )
}

type SelectOptionModalProps = {
  open: boolean
  title: string
  options: SimpleOption[]
  onClose: () => void
  onChoose: (name: string) => void
}

function SelectOptionModal({
  open,
  title,
  options,
  onClose,
  onChoose,
}: SelectOptionModalProps) {
  const [query, setQuery] = useState('')

  if (!open) return null

  const filtered = options.filter(o =>
    o.name.toLowerCase().includes(query.trim().toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[2050]">
      <div className="bg-white rounded-lg shadow-lg w-[700px] max-w-[95vw]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">{title}</h3>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Pesquisar..."
              className="flex-1 border rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-3 max-h-[60vh] overflow-y-auto">
            {filtered.map(o => (
              <div
                key={o.id}
                className="grid grid-cols-[1fr_2rem] items-center gap-3 px-2 py-3 border-b last:border-0 text-sm cursor-pointer"
                onClick={() => onChoose(o.name)}
              >
                <div className="font-medium">{o.name}</div>
                <div className="text-right text-gray-400">›</div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-sm text-gray-600">
                Nenhuma opção encontrada.
              </div>
            )}
          </div>
        </div>
        <div className="p-4 border-t flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 border rounded text-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
