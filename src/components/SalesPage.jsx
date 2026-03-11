import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { listenOrders } from '../services/orders'
import { listenProducts } from '../services/products'
import NewSaleModal from './NewSaleModal'
import SaleDetailModal from './SaleDetailModal'
import SalesDateFilterModal from './SalesDateFilterModal'
import SalesAdvancedFilterModal from './SalesAdvancedFilterModal'
import SelectColumnsModal from './SelectColumnsModal'
import pixIcon from '../assets/pix.svg'
import { updateStore } from '../services/stores'

const tabs = [
  { key: 'todos', label: 'Todos' },
  { key: 'pedido', label: 'Pedido' },
  { key: 'venda', label: 'Vendas' },
  { key: 'cancelada', label: 'Canceladas' },
]

const defaultColumns = [
  { id: 'number', label: 'Venda', width: '4.5rem', visible: true, align: 'left' },
  { id: 'client', label: 'Cliente', width: 'minmax(0, 1.5fr)', visible: true, align: 'left' },
  { id: 'fiscal', label: 'Fiscal', width: '4rem', visible: true, align: 'center' },
  { id: 'payment', label: 'Pgto.', width: '8rem', visible: true, align: 'center' },
  { id: 'date', label: 'Data', width: '6rem', visible: true, align: 'center' },
  { id: 'time', label: 'Hora', width: '5rem', visible: true, align: 'center' },
  { id: 'attendant', label: 'Vendedor', width: 'minmax(0, 1fr)', visible: true, align: 'left' },
  { id: 'value', label: 'Valor', width: '6rem', visible: true, align: 'right' },
  { id: 'status', label: 'Status', width: '6.5rem', visible: true, align: 'center' }
]

export default function SalesPage({ initialDayFilter = null, storeId, store, user, openNewSaleSignal = 0 }){
  const isOwner = !user?.memberId
  const perms = user?.permissions || {}
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('todos')
  const [showFilters, setShowFilters] = useState(false)
  const [newSaleOpen, setNewSaleOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedSale, setSelectedSale] = useState(null)
  const [editSaleOpen, setEditSaleOpen] = useState(false)
  const [editSale, setEditSale] = useState(null)
  
  const [columns, setColumns] = useState(defaultColumns)
  const [selectColumnsOpen, setSelectColumnsOpen] = useState(false)
  
  const [optionsOpen, setOptionsOpen] = useState(false)
  const optionsRef = useRef(null)
  const optionsButtonRef = useRef(null)
  const optionsMenuRef = useRef(null)
  const [optionsMenuPos, setOptionsMenuPos] = useState({ top: 0, left: 0 })

  const DEFAULT_WARRANTY_INFO = `TERMO DE GARANTIA DE PRODUTOS
Para celulares 1* Ano / Prosutos e Serviços 3 meses
Para defetio de fabricação Garantia Não Cobre Produto riscado,trincado,descascado manchas esternas ou internas quebrado ou danificado! Sem selo da loja.Não trocamos Produto sem caixa original. cliente ciente com os termos acima.`
  const DEFAULT_RECEIPT_CONFIG = {
    company: {
      showLogo: true,
      showName: true,
      showCnpj: true,
      showEmail: true,
      showWhatsapp: true,
      showAddress: true,
    },
    sale: {
      showTitle: true,
      showNumber: true,
      showDate: true,
      showAttendant: true,
    },
    client: {
      showSection: true,
      showName: true,
      showCode: true,
      showCpf: true,
      showCnpj: true,
      showPhone: true,
      showWhatsapp: true,
      showEmail: true,
      showCep: true,
      showAddress: true,
      showNumber: true,
      showComplement: true,
      showNeighborhood: true,
      showCity: true,
      showState: true,
      showIdentity: true,
      showMotherName: true,
      showBirthDate: true,
      showNotes: true,
      showStateRegistrationIndicator: true,
    },
    items: {
      showSection: true,
      showQty: true,
      showTotal: true,
      showUnitPrice: true,
    },
    totals: {
      showSection: true,
      showSubtotal: true,
      showFees: true,
      showDiscount: true,
      showTotal: true,
    },
    payments: {
      showSection: true,
    },
    observations: {
      showSection: true,
    },
    warranty: {
      showSection: true,
    },
  }

  const deepMerge = (base, override) => {
    if (!override || typeof override !== 'object') return base
    const out = Array.isArray(base) ? [...base] : { ...base }
    for (const k of Object.keys(override)) {
      const bv = base?.[k]
      const ov = override[k]
      if (bv && typeof bv === 'object' && !Array.isArray(bv) && ov && typeof ov === 'object' && !Array.isArray(ov)) {
        out[k] = deepMerge(bv, ov)
      } else {
        out[k] = ov
      }
    }
    return out
  }

  const [receiptConfigOpen, setReceiptConfigOpen] = useState(false)
  const [receiptConfig, setReceiptConfig] = useState(DEFAULT_RECEIPT_CONFIG)
  const [warrantyText, setWarrantyText] = useState('')
  const [receiptConfigSaving, setReceiptConfigSaving] = useState(false)
  const [receiptConfigError, setReceiptConfigError] = useState('')

  useEffect(() => {
    if (!receiptConfigOpen) return
    setReceiptConfig(deepMerge(DEFAULT_RECEIPT_CONFIG, store?.receiptConfig || {}))
    setWarrantyText(String(store?.warrantyTerms || '').trim() ? String(store.warrantyTerms) : DEFAULT_WARRANTY_INFO)
    setReceiptConfigError('')
  }, [receiptConfigOpen, store])

  useEffect(() => {
    function handleClickOutside(event) {
      const inButtonArea = optionsRef.current && optionsRef.current.contains(event.target)
      const inMenu = optionsMenuRef.current && optionsMenuRef.current.contains(event.target)
      if (!inButtonArea && !inMenu) {
        setOptionsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const updateOptionsMenuPos = () => {
    const btn = optionsButtonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const menuWidth = 224
    const margin = 8

    let left = rect.right - menuWidth
    left = Math.max(margin, Math.min(left, window.innerWidth - menuWidth - margin))

    let top = rect.bottom + margin

    const menuEl = optionsMenuRef.current
    if (menuEl) {
      const m = menuEl.getBoundingClientRect()
      const h = m.height
      if (top + h > window.innerHeight - margin) {
        const above = rect.top - margin - h
        if (above >= margin) top = above
        else top = Math.max(margin, window.innerHeight - margin - h)
      }
    }

    setOptionsMenuPos({ top, left })
  }

  useEffect(() => {
    if (!optionsOpen) return
    updateOptionsMenuPos()
    const raf = requestAnimationFrame(() => updateOptionsMenuPos())
    const onMove = () => updateOptionsMenuPos()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [optionsOpen])

  const Toggle = ({ label, checked, onChange }) => (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
      </button>
    </div>
  )

  useEffect(() => {
    const w = window.innerWidth
    if (w < 1300) {
      setColumns(prev => prev.map(c => {
        if (['fiscal', 'payment', 'time', 'attendant'].includes(c.id)) return { ...c, visible: false }
        return c
      }))
    }
  }, [])

  const [dateFilterOpen, setDateFilterOpen] = useState(false)
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date()
    return {
      label: 'Este Mês',
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    }
  })

  // Advanced Filters
  const [advFiltersOpen, setAdvFiltersOpen] = useState(false)
  const [advFilters, setAdvFilters] = useState({
    client: '',
    attendant: '',
    supplier: '',
    product: '',
    paymentMethod: ''
  })

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 20

  useEffect(() => {
    setCurrentPage(1)
  }, [query, tab, dateRange, advFilters])

  useEffect(() => {
    const unsub = listenOrders(items => setOrders(items), storeId)
    const unsubP = listenProducts(items => setProducts(items), storeId)
    return () => { 
      unsub && unsub() 
      unsubP && unsubP()
    }
  }, [storeId])

  useEffect(() => {
    if (openNewSaleSignal > 0) {
      setNewSaleOpen(true)
    }
  }, [openNewSaleSignal])

  useEffect(() => {
    if (initialDayFilter) {
       const d = new Date(initialDayFilter)
       setDateRange({
         label: 'Dia Específico',
         start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0,0,0,0),
         end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23,59,59,999)
       })
    }
  }, [initialDayFilter])

  const toDate = (ts) => ts?.toDate?.() ? ts.toDate() : (ts ? new Date(ts) : null)
  const isSameDay = (a, b) => a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    
    // Map productId -> supplier
    const productSupplierMap = {}
    products.forEach(p => {
      if (p.supplier) productSupplierMap[p.id] = p.supplier.toLowerCase()
    })

    return orders
      .filter(o => {
        // Permission Check: If not owner and no viewAll, only show own sales
        if (!isOwner && !perms.sales?.viewAll) {
           return (o.attendant || '').toLowerCase() === (user.name || '').toLowerCase()
        }
        return true
      })
      .filter(o => {
        // Exclude Service Orders
        if (o.type === 'service_order') return false
        // Heuristics for legacy data (if type is missing)
        if (!o.type) {
           // Fields present in OS but not in Sales
           if (o.model || o.brand || o.problem || o.equipment || o.technician) return false
           
           // Statuses specific to OS
           const s = (o.status || '').toLowerCase()
           if (['iniciado', 'em andamento', 'aguardando', 'entregue'].some(st => s.includes(st))) return false
        }
        return true
      })
      .filter(o => {
        // Search Query (Text)
        const name = (o.client || '').toLowerCase()
        const idstr = (o.id || '').toLowerCase()
        const numDigits = String(o.number || '').replace(/\D/g, '')
        const qDigits = q.replace(/\D/g, '')
        const formattedNum = (() => {
          if (numDigits) {
            const n = parseInt(numDigits, 10)
            return `pv:${String(n).padStart(4, '0')}`
          }
          const tail = String(o.id || '').slice(-4)
          return `pv:${tail}`
        })().toLowerCase()
        return (
          name.includes(q) ||
          idstr.includes(q) ||
          formattedNum.includes(q) ||
          (qDigits ? numDigits.includes(qDigits) : false)
        )
      })
      .filter(o => {
        // Date Range
        if (!dateRange.start && !dateRange.end) return true
        const d = toDate(o.createdAt)
        if (!d) return false
        if (dateRange.start && d < dateRange.start) return false
        if (dateRange.end && d > dateRange.end) return false
        return true
      })
      .filter(o => {
        // Status Tab
        if(tab==='todos') return true
        const s = (o.status || '').toLowerCase()
        if(tab==='pedido') return s==='pedido'
        if(tab==='venda') return s==='venda' || s==='finalizado' || s==='pago' || s === 'cliente final' || s === 'cliente lojista'
        if(tab==='cancelada') return s==='cancelada'
        return true
      })
      .filter(o => {
        // Advanced Filters
        
        // Client
        if (advFilters.client) {
          if (!(o.client || '').toLowerCase().includes(advFilters.client.toLowerCase())) return false
        }

        // Attendant (Vendedor)
        if (advFilters.attendant) {
          if (!(o.attendant || '').toLowerCase().includes(advFilters.attendant.toLowerCase())) return false
        }

        // Payment Method
        if (advFilters.paymentMethod) {
          const pm = advFilters.paymentMethod.toLowerCase()
          // Check if any payment method matches
          const hasPayment = (o.payments || []).some(p => (p.method || '').toLowerCase() === pm)
          if (!hasPayment) return false
        }

        // Product (Name) & Supplier
        if (advFilters.product || advFilters.supplier) {
           const oProducts = o.products || []
           const prodNameFilter = advFilters.product ? advFilters.product.toLowerCase() : null
           const supplierFilter = advFilters.supplier ? advFilters.supplier.toLowerCase() : null

           const hasMatch = oProducts.some(op => {
             // Check Product Name
             if (prodNameFilter) {
               if (!(op.name || '').toLowerCase().includes(prodNameFilter)) return false
             }
             
             // Check Supplier
             if (supplierFilter) {
               // Try to find supplier from products map using ID
               const pId = op.id
               const sup = productSupplierMap[pId] || ''
               if (!sup.includes(supplierFilter)) return false
             }
             return true
           })
           
           if (!hasMatch) return false
        }

        return true
      })
  }, [orders, query, tab, dateRange, advFilters, products])

  const totalValor = useMemo(() => {
    return filtered
      .filter(o => {
        const s = (o.status || '').toLowerCase()
        return s === 'venda' || s === 'pedido'
      })
      .reduce((acc, o) => acc + Number(o.valor || o.total || 0), 0)
  }, [filtered])
  const vendasRealizadas = useMemo(() => filtered.filter(o => (o.status||'').toLowerCase() === 'venda').length, [filtered])
  const ticketMedio = useMemo(() => filtered.length ? totalValor / filtered.length : 0, [filtered, totalValor])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filtered.slice(start, start + ITEMS_PER_PAGE)
  }, [filtered, currentPage])

  const formatCurrency = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const formatDate = (ts) => {
    const d = ts?.toDate?.() ? ts.toDate() : (ts ? new Date(ts) : new Date())
    const dias = ['dom','seg','ter','qua','qui','sex','sáb']
    const dia = dias[d.getDay()]
    const dd = String(d.getDate()).padStart(2,'0')
    const mm = String(d.getMonth()+1).padStart(2,'0')
    return `${dia} - ${dd}/${mm}`
  }
  const formatTime = (ts) => {
    const d = ts?.toDate?.() ? ts.toDate() : (ts ? new Date(ts) : new Date())
    const hh = String(d.getHours()).padStart(2,'0')
    const mm = String(d.getMinutes()).padStart(2,'0')
    return `${hh}:${mm}`
  }
  const paymentIcon = (label) => {
    const m = String(label || '').toLowerCase()
    if (m.includes('pix')) {
      return <img src={pixIcon} alt="PIX" className="w-4 h-4 inline-block" />
    }
    if (m.includes('dinheiro')) {
      return <span className="inline-block">💵</span>
    }
    if (m.includes('débito') || m.includes('debito') || m.includes('crédito') || m.includes('credito')) {
      return (
        <svg className="w-4 h-4 text-gray-700 inline-block" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20,4H4A2,2 0 0,0 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6A2,2 0 0,0 20,4M20,8H4V6H20V8Z"/>
        </svg>
      )
    }
    if (m.includes('boleto')) {
      return <span className="inline-block">🧾</span>
    }
    if (m.includes('transfer')) {
      return <span className="inline-block">🔁</span>
    }
    if (m.includes('voucher')) {
      return <span className="inline-block">🎟️</span>
    }
    return (
      <svg className="w-4 h-4 text-gray-700 inline-block" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20,4H4A2,2 0 0,0 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6A2,2 0 0,0 20,4M20,8H4V6H20V8Z"/>
      </svg>
    )
  }

  const formatSaleNumber = (order) => {
    if (order.number) {
      const digits = String(order.number).replace(/\D/g, '')
      const n = parseInt(digits, 10)
      return `PV:${String(n).padStart(4, '0')}`
    }
    return `PV:${String(order.id).slice(-4)}`
  }

  const renderCell = (o, col) => {
    switch(col.id) {
      case 'number': return <div className="text-xs lg:text-sm">{formatSaleNumber(o)}</div>
      case 'client': return <div className="text-xs lg:text-sm truncate" title={o.client || '-'}>{o.client || '-'}</div>
      case 'fiscal': return <div className="text-xs lg:text-sm text-center">{o.fiscal ? '📄' : '-'}</div>
      case 'payment': {
        const icons = (Array.isArray(o.payments) ? o.payments : []).map((p, idx) => (
          <span key={idx} className="mx-0.5">{paymentIcon(p.method)}</span>
        ))
        return <div className="text-xs lg:text-sm text-center">{icons.length ? icons : '-'}</div>
      }
      case 'date': return <div className="text-xs lg:text-sm text-center whitespace-nowrap">{formatDate(o.createdAt)}</div>
      case 'time': return <div className="text-xs lg:text-sm text-center">{formatTime(o.createdAt)}</div>
      case 'attendant': return <div className="text-xs lg:text-sm text-left truncate" title={o.attendant || '-'}>{o.attendant || '-'}</div>
      case 'value': return <div className="text-xs lg:text-sm text-right whitespace-nowrap">{formatCurrency(Number(o.valor || o.total || 0))}</div>
      case 'status': {
        const s = (o.status ?? '').toLowerCase()
        let colorClass = 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
        if (s === 'venda' || s.includes('cliente final')) colorClass = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
        else if (s.includes('lojista') || s.includes('logista')) colorClass = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
        else if (s === 'pedido') colorClass = 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
        else if (s === 'cancelada') colorClass = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'

        return (
          <div className="text-center">
            <div className={`px-1.5 py-0.5 rounded text-[10px] lg:text-xs inline-block ${colorClass}`}>{o.status || 'Indef.'}</div>
          </div>
        )
      }
      default: return null
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
        <div className="flex items-center gap-3">
          <input 
            value={query} 
            onChange={e=>setQuery(e.target.value)} 
            placeholder="Pesquisar..." 
            className="flex-1 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-green-500 dark:focus:ring-green-600 focus:border-transparent outline-none transition-all" 
          />
          <button 
            onClick={()=>setDateFilterOpen(true)} 
            className="px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <span>📅</span> {dateRange.label}
          </button>
          <button 
            onClick={()=>setAdvFiltersOpen(true)} 
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 border border-transparent dark:border-gray-600 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <span>⚙️</span> Filtros
          </button>
        </div>
        {/* métricas */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">Total</div>
            <div className="text-green-600 dark:text-green-400 font-bold text-lg">{formatCurrency(totalValor)}</div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">Vendas realizadas</div>
            <div className="text-green-600 dark:text-green-400 font-bold text-lg">{vendasRealizadas}</div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold">Ticket Médio</div>
            <div className="text-green-600 dark:text-green-400 font-bold text-lg">{formatCurrency(ticketMedio)}</div>
          </div>
        </div>
        {/* Tabs e ações */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm overflow-x-auto pb-2 md:pb-0">
            {tabs.map(t => (
              <button 
                key={t.key} 
                onClick={()=>setTab(t.key)} 
                className={`pb-2 whitespace-nowrap transition-colors ${tab===t.key ? 'text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-500 font-bold' : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 relative z-[2000]" ref={optionsRef}>
            <button 
              ref={optionsButtonRef}
              onClick={() => setOptionsOpen(!optionsOpen)}
              className={`px-3 py-2 rounded text-sm font-medium border transition-colors ${optionsOpen ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600'}`}
            >
              Opções
            </button>
            {(isOwner || perms.sales?.finalize) && (
            <button onClick={()=>setNewSaleOpen(true)} className="px-3 py-2 rounded text-sm bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500 shadow-sm transition-all hover:shadow-md font-medium whitespace-nowrap">+ Nova Venda</button>
            )}
          </div>
        </div>
      </div>

      {optionsOpen && createPortal(
        <div
          ref={optionsMenuRef}
          style={{ top: optionsMenuPos.top, left: optionsMenuPos.left, width: 224 }}
          className="fixed bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 z-[99999] py-1"
        >
          <button
            onClick={() => {
              setOptionsOpen(false)
              setReceiptConfigOpen(true)
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            Recibo
          </button>
          <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
          {(isOwner || perms.sales?.viewAll) && (
          <>
          <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            Devolução
          </button>
          <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
          <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            Relatório Resumido
          </button>
          <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            Relatório Detalhado
          </button>
          <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            Relatório de Comissões
          </button>
          <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
          </>
          )}
          <button className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            Meu link do catálogo
          </button>
        </div>,
        document.body
      )}

      {receiptConfigOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl overflow-hidden">
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
              <div className="text-lg font-semibold text-gray-800 dark:text-white">Recibo</div>
              <button onClick={() => setReceiptConfigOpen(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">✕</button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-y-auto">
              {receiptConfigError && <div className="text-sm text-red-600 dark:text-red-400 mb-3">{receiptConfigError}</div>}

              <div className="space-y-6">
                <div className="border dark:border-gray-700 rounded-lg p-4">
                  <div className="text-sm font-semibold text-gray-800 dark:text-white">Empresa</div>
                  <div className="mt-3 space-y-3">
                    <Toggle label="Mostrar logo" checked={!!receiptConfig.company?.showLogo} onChange={(v) => setReceiptConfig(prev => ({ ...prev, company: { ...prev.company, showLogo: v } }))} />
                    <Toggle label="Mostrar nome" checked={!!receiptConfig.company?.showName} onChange={(v) => setReceiptConfig(prev => ({ ...prev, company: { ...prev.company, showName: v } }))} />
                    <Toggle label="Mostrar CNPJ" checked={!!receiptConfig.company?.showCnpj} onChange={(v) => setReceiptConfig(prev => ({ ...prev, company: { ...prev.company, showCnpj: v } }))} />
                    <Toggle label="Mostrar e-mail" checked={!!receiptConfig.company?.showEmail} onChange={(v) => setReceiptConfig(prev => ({ ...prev, company: { ...prev.company, showEmail: v } }))} />
                    <Toggle label="Mostrar telefone/WhatsApp" checked={!!receiptConfig.company?.showWhatsapp} onChange={(v) => setReceiptConfig(prev => ({ ...prev, company: { ...prev.company, showWhatsapp: v } }))} />
                    <Toggle label="Mostrar endereço" checked={!!receiptConfig.company?.showAddress} onChange={(v) => setReceiptConfig(prev => ({ ...prev, company: { ...prev.company, showAddress: v } }))} />
                  </div>
                </div>

                <div className="border dark:border-gray-700 rounded-lg p-4">
                  <div className="text-sm font-semibold text-gray-800 dark:text-white">Venda</div>
                  <div className="mt-3 space-y-3">
                    <Toggle label="Mostrar título" checked={!!receiptConfig.sale?.showTitle} onChange={(v) => setReceiptConfig(prev => ({ ...prev, sale: { ...prev.sale, showTitle: v } }))} />
                    <Toggle label="Mostrar número" checked={!!receiptConfig.sale?.showNumber} onChange={(v) => setReceiptConfig(prev => ({ ...prev, sale: { ...prev.sale, showNumber: v } }))} />
                    <Toggle label="Mostrar data" checked={!!receiptConfig.sale?.showDate} onChange={(v) => setReceiptConfig(prev => ({ ...prev, sale: { ...prev.sale, showDate: v } }))} />
                    <Toggle label="Mostrar vendedor" checked={!!receiptConfig.sale?.showAttendant} onChange={(v) => setReceiptConfig(prev => ({ ...prev, sale: { ...prev.sale, showAttendant: v } }))} />
                  </div>
                </div>

                <div className="border dark:border-gray-700 rounded-lg p-4">
                  <div className="text-sm font-semibold text-gray-800 dark:text-white">Cliente</div>
                  <div className="mt-3 space-y-3">
                    <Toggle label="Mostrar seção do cliente" checked={!!receiptConfig.client?.showSection} onChange={(v) => setReceiptConfig(prev => ({ ...prev, client: { ...prev.client, showSection: v } }))} />
                    <Toggle label="Mostrar nome" checked={!!receiptConfig.client?.showName} onChange={(v) => setReceiptConfig(prev => ({ ...prev, client: { ...prev.client, showName: v } }))} />
                    <Toggle label="Mostrar código" checked={!!receiptConfig.client?.showCode} onChange={(v) => setReceiptConfig(prev => ({ ...prev, client: { ...prev.client, showCode: v } }))} />
                    <Toggle label="Mostrar CPF" checked={!!receiptConfig.client?.showCpf} onChange={(v) => setReceiptConfig(prev => ({ ...prev, client: { ...prev.client, showCpf: v } }))} />
                    <Toggle label="Mostrar CNPJ" checked={!!receiptConfig.client?.showCnpj} onChange={(v) => setReceiptConfig(prev => ({ ...prev, client: { ...prev.client, showCnpj: v } }))} />
                    <Toggle label="Mostrar telefone" checked={!!receiptConfig.client?.showPhone} onChange={(v) => setReceiptConfig(prev => ({ ...prev, client: { ...prev.client, showPhone: v } }))} />
                    <Toggle label="Mostrar WhatsApp" checked={!!receiptConfig.client?.showWhatsapp} onChange={(v) => setReceiptConfig(prev => ({ ...prev, client: { ...prev.client, showWhatsapp: v } }))} />
                    <Toggle label="Mostrar e-mail" checked={!!receiptConfig.client?.showEmail} onChange={(v) => setReceiptConfig(prev => ({ ...prev, client: { ...prev.client, showEmail: v } }))} />
                    <Toggle label="Mostrar CEP" checked={!!receiptConfig.client?.showCep} onChange={(v) => setReceiptConfig(prev => ({ ...prev, client: { ...prev.client, showCep: v } }))} />
                    <Toggle label="Mostrar endereço" checked={!!receiptConfig.client?.showAddress} onChange={(v) => setReceiptConfig(prev => ({ ...prev, client: { ...prev.client, showAddress: v } }))} />
                    <Toggle label="Mostrar número" checked={!!receiptConfig.client?.showNumber} onChange={(v) => setReceiptConfig(prev => ({ ...prev, client: { ...prev.client, showNumber: v } }))} />
                    <Toggle label="Mostrar complemento" checked={!!receiptConfig.client?.showComplement} onChange={(v) => setReceiptConfig(prev => ({ ...prev, client: { ...prev.client, showComplement: v } }))} />
                    <Toggle label="Mostrar bairro" checked={!!receiptConfig.client?.showNeighborhood} onChange={(v) => setReceiptConfig(prev => ({ ...prev, client: { ...prev.client, showNeighborhood: v } }))} />
                    <Toggle label="Mostrar cidade" checked={!!receiptConfig.client?.showCity} onChange={(v) => setReceiptConfig(prev => ({ ...prev, client: { ...prev.client, showCity: v } }))} />
                    <Toggle label="Mostrar estado" checked={!!receiptConfig.client?.showState} onChange={(v) => setReceiptConfig(prev => ({ ...prev, client: { ...prev.client, showState: v } }))} />
                    <Toggle label="Mostrar identidade/RG" checked={!!receiptConfig.client?.showIdentity} onChange={(v) => setReceiptConfig(prev => ({ ...prev, client: { ...prev.client, showIdentity: v } }))} />
                    <Toggle label="Mostrar indicador IE" checked={!!receiptConfig.client?.showStateRegistrationIndicator} onChange={(v) => setReceiptConfig(prev => ({ ...prev, client: { ...prev.client, showStateRegistrationIndicator: v } }))} />
                    <Toggle label="Mostrar nome da mãe" checked={!!receiptConfig.client?.showMotherName} onChange={(v) => setReceiptConfig(prev => ({ ...prev, client: { ...prev.client, showMotherName: v } }))} />
                    <Toggle label="Mostrar data de nascimento" checked={!!receiptConfig.client?.showBirthDate} onChange={(v) => setReceiptConfig(prev => ({ ...prev, client: { ...prev.client, showBirthDate: v } }))} />
                    <Toggle label="Mostrar observações do cliente" checked={!!receiptConfig.client?.showNotes} onChange={(v) => setReceiptConfig(prev => ({ ...prev, client: { ...prev.client, showNotes: v } }))} />
                  </div>
                </div>

                <div className="border dark:border-gray-700 rounded-lg p-4">
                  <div className="text-sm font-semibold text-gray-800 dark:text-white">Produtos</div>
                  <div className="mt-3 space-y-3">
                    <Toggle label="Mostrar seção de produtos" checked={!!receiptConfig.items?.showSection} onChange={(v) => setReceiptConfig(prev => ({ ...prev, items: { ...prev.items, showSection: v } }))} />
                    <Toggle label="Mostrar quantidade" checked={!!receiptConfig.items?.showQty} onChange={(v) => setReceiptConfig(prev => ({ ...prev, items: { ...prev.items, showQty: v } }))} />
                    <Toggle label="Mostrar total por item" checked={!!receiptConfig.items?.showTotal} onChange={(v) => setReceiptConfig(prev => ({ ...prev, items: { ...prev.items, showTotal: v } }))} />
                    <Toggle label="Mostrar preço unitário" checked={!!receiptConfig.items?.showUnitPrice} onChange={(v) => setReceiptConfig(prev => ({ ...prev, items: { ...prev.items, showUnitPrice: v } }))} />
                  </div>
                </div>

                <div className="border dark:border-gray-700 rounded-lg p-4">
                  <div className="text-sm font-semibold text-gray-800 dark:text-white">Totais</div>
                  <div className="mt-3 space-y-3">
                    <Toggle label="Mostrar seção de totais" checked={!!receiptConfig.totals?.showSection} onChange={(v) => setReceiptConfig(prev => ({ ...prev, totals: { ...prev.totals, showSection: v } }))} />
                    <Toggle label="Mostrar subtotal" checked={!!receiptConfig.totals?.showSubtotal} onChange={(v) => setReceiptConfig(prev => ({ ...prev, totals: { ...prev.totals, showSubtotal: v } }))} />
                    <Toggle label="Mostrar taxas" checked={!!receiptConfig.totals?.showFees} onChange={(v) => setReceiptConfig(prev => ({ ...prev, totals: { ...prev.totals, showFees: v } }))} />
                    <Toggle label="Mostrar desconto" checked={!!receiptConfig.totals?.showDiscount} onChange={(v) => setReceiptConfig(prev => ({ ...prev, totals: { ...prev.totals, showDiscount: v } }))} />
                    <Toggle label="Mostrar total" checked={!!receiptConfig.totals?.showTotal} onChange={(v) => setReceiptConfig(prev => ({ ...prev, totals: { ...prev.totals, showTotal: v } }))} />
                  </div>
                </div>

                <div className="border dark:border-gray-700 rounded-lg p-4">
                  <div className="text-sm font-semibold text-gray-800 dark:text-white">Pagamentos</div>
                  <div className="mt-3 space-y-3">
                    <Toggle label="Mostrar seção de pagamentos" checked={!!receiptConfig.payments?.showSection} onChange={(v) => setReceiptConfig(prev => ({ ...prev, payments: { ...prev.payments, showSection: v } }))} />
                  </div>
                </div>

                <div className="border dark:border-gray-700 rounded-lg p-4">
                  <div className="text-sm font-semibold text-gray-800 dark:text-white">Observações (da venda)</div>
                  <div className="mt-3 space-y-3">
                    <Toggle label="Mostrar observações da venda" checked={!!receiptConfig.observations?.showSection} onChange={(v) => setReceiptConfig(prev => ({ ...prev, observations: { ...prev.observations, showSection: v } }))} />
                  </div>
                </div>

                <div className="border dark:border-gray-700 rounded-lg p-4">
                  <div className="text-sm font-semibold text-gray-800 dark:text-white">Termo de garantia</div>
                  <div className="mt-3 space-y-3">
                    <Toggle label="Mostrar termo de garantia no recibo" checked={!!receiptConfig.warranty?.showSection} onChange={(v) => setReceiptConfig(prev => ({ ...prev, warranty: { ...prev.warranty, showSection: v } }))} />
                    <textarea
                      value={warrantyText}
                      onChange={e => setWarrantyText(e.target.value)}
                      className="w-full h-56 border dark:border-gray-600 rounded px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 dark:text-gray-100 focus:bg-white dark:focus:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-green-500 whitespace-pre-wrap"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center gap-3">
              <button
                onClick={() => setReceiptConfigOpen(false)}
                className="flex-1 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm font-medium"
                disabled={receiptConfigSaving}
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!storeId) return
                  if (receiptConfigSaving) return
                  setReceiptConfigSaving(true)
                  setReceiptConfigError('')
                  try {
                    await updateStore(storeId, { receiptConfig, warrantyTerms: warrantyText })
                    setReceiptConfigOpen(false)
                  } catch {
                    setReceiptConfigError('Não foi possível salvar as configurações.')
                  } finally {
                    setReceiptConfigSaving(false)
                  }
                }}
                className="flex-1 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-60"
                disabled={receiptConfigSaving}
              >
                {receiptConfigSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden overflow-x-auto border border-gray-100 dark:border-gray-700">
        <div 
          className="min-w-full grid items-center px-2 py-2 text-xs lg:text-sm text-gray-600 dark:text-gray-300 font-bold border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 gap-2"
          style={{ gridTemplateColumns: `${columns.filter(c => c.visible).map(c => c.width).join(' ')} 3rem` }}
        >
          {columns.filter(c => c.visible).map(col => (
            <div key={col.id} className={`text-${col.align === 'right' ? 'right' : (col.align === 'center' ? 'center' : 'left')}`}>
              {col.label}
            </div>
          ))}
          <div className="flex justify-center">
            <button 
              onClick={(e) => {
                e.stopPropagation()
                setSelectColumnsOpen(true)
              }} 
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Configurar colunas"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
        {paginatedData.map(o => (
          <div 
            key={o.id} 
            onClick={() => {
              setSelectedSale(o)
              setDetailModalOpen(true)
            }}
            className="min-w-full grid items-center px-2 py-2 border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors gap-2"
            style={{ gridTemplateColumns: `${columns.filter(c => c.visible).map(c => c.width).join(' ')} 3rem` }}
          >
            {columns.filter(c => c.visible).map(col => (
              <React.Fragment key={col.id}>
                {renderCell(o, col)}
              </React.Fragment>
            ))}
            <div className="flex justify-center text-gray-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        ))}
        {!filtered.length && (
          <div className="px-4 py-6 text-sm text-gray-600 dark:text-gray-400">Nenhuma venda encontrada.</div>
        )}
      </div>

      {/* Pagination Controls */}
      {filtered.length > ITEMS_PER_PAGE && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} de {filtered.length} resultados
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded border text-sm transition-colors ${
                currentPage === 1 
                  ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed dark:border-gray-700' 
                  : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
              }`}
            >
              Anterior
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded border text-sm transition-colors ${
                currentPage === totalPages 
                  ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed dark:border-gray-700' 
                  : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
              }`}
            >
              Próximo
            </button>
          </div>
        </div>
      )}

      {/* Modal Nova Venda */}
      <NewSaleModal open={newSaleOpen} onClose={()=>setNewSaleOpen(false)} storeId={storeId} user={user} />
      
      {/* Modal Detalhes da Venda */}
      <SaleDetailModal 
        open={detailModalOpen} 
        onClose={() => setDetailModalOpen(false)} 
        sale={selectedSale}
        storeId={storeId}
        store={store}
        products={products}
        user={user}

        onEdit={(s) => { 
          setDetailModalOpen(false)
          setEditSale(s)
          setEditSaleOpen(true)
        }} 
      />
      <SalesDateFilterModal 
        open={dateFilterOpen} 
        onClose={()=>setDateFilterOpen(false)} 
        onApply={setDateRange}
        currentLabel={dateRange.label}
      />
      <SalesAdvancedFilterModal 
        open={advFiltersOpen}
        onClose={()=>setAdvFiltersOpen(false)}
        onApply={setAdvFilters}
        initialFilters={advFilters}
      />
      <NewSaleModal 
        open={editSaleOpen} 
        onClose={()=>setEditSaleOpen(false)} 
        storeId={storeId} 
        user={user} 
        isEdit={true}
        sale={editSale}
      />
      <SelectColumnsModal
        open={selectColumnsOpen}
        onClose={() => setSelectColumnsOpen(false)}
        columns={columns}
        onSave={(newCols) => {
          setColumns(newCols)
          setSelectColumnsOpen(false)
        }}
        onReset={() => setColumns(defaultColumns)}
      />
    </div>
  )
}
