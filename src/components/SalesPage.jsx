import React, { useEffect, useMemo, useState } from 'react'
import { listenOrders } from '../services/orders'
import { listenProducts } from '../services/products'
import NewSaleModal from './NewSaleModal'
import SaleDetailModal from './SaleDetailModal'
import SalesDateFilterModal from './SalesDateFilterModal'
import SalesAdvancedFilterModal from './SalesAdvancedFilterModal'

const tabs = [
  { key: 'todos', label: 'Todos' },
  { key: 'pedido', label: 'Pedido' },
  { key: 'venda', label: 'Vendas' },
  { key: 'cancelada', label: 'Canceladas' },
]

export default function SalesPage({ initialDayFilter = null, storeId, user }){
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

  useEffect(() => {
    const unsub = listenOrders(items => setOrders(items), storeId)
    const unsubP = listenProducts(items => setProducts(items), storeId)
    return () => { 
      unsub && unsub() 
      unsubP && unsubP()
    }
  }, [storeId])

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
        return name.includes(q) || idstr.includes(q)
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
        if(tab==='venda') return s==='venda' || s==='finalizado' || s==='pago'
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
          <button 
            onClick={()=>setDateFilterOpen(true)} 
            className="px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-md text-sm font-medium flex items-center gap-2"
          >
            <span>📅</span> {dateRange.label}
          </button>
          <button 
            onClick={()=>setAdvFiltersOpen(true)} 
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium flex items-center gap-2"
          >
            <span>⚙️</span> Filtros
          </button>
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
          <div 
            key={o.id} 
            onClick={() => {
              setSelectedSale(o)
              setDetailModalOpen(true)
            }}
            className="grid grid-cols-[6rem_1fr_8rem_10rem_8rem_8rem_8rem] items-center px-4 py-3 border-b last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
          >
            <div className="text-sm">{o.number || `#${String(o.id).slice(-4)}`}</div>
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
      <NewSaleModal open={newSaleOpen} onClose={()=>setNewSaleOpen(false)} storeId={storeId} user={user} />
      
      {/* Modal Detalhes da Venda */}
      <SaleDetailModal 
        open={detailModalOpen} 
        onClose={() => setDetailModalOpen(false)} 
        sale={selectedSale}
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
    </div>
  )
}
