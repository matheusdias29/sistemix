import React, { useMemo, useState, useEffect } from 'react'
import { listenProducts, updateProduct, addProduct, removeProduct } from '../services/products'
import NewProductModal from './NewProductModal'
import { listenCategories, updateCategory } from '../services/categories'
import NewCategoryModal from './NewCategoryModal'
import { listenSuppliers, updateSupplier } from '../services/suppliers'
import NewSupplierModal from './NewSupplierModal'
import ProductsFilterModal from './ProductsFilterModal'
import ProductLabelsPage from './ProductLabelsPage'
import { listenOrders } from '../services/orders'
import { recordStockMovement } from '../services/stockMovements'
import StockMovementsModal from './StockMovementsModal'

const tabs = [
  { key: 'produto', label: 'Produto' },
  { key: 'categorias', label: 'Categorias' },
  { key: 'movestoque', label: 'Movimento De Estoque' },
  { key: 'fornecedores', label: 'Fornecedores' },
  { key: 'compras', label: 'Compras' },
]

export default function ProductsPage({ storeId, addNewSignal, user }){
  const [tab, setTab] = useState('produto')
  const [products, setProducts] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState('list')
  const [showFilters, setShowFilters] = useState(false)
  const [activeFilters, setActiveFilters] = useState({})
  const [modalOpen, setModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  // Mobile: controle de sanfona por linha (produtos abertos)
  const [mobileOpenRows, setMobileOpenRows] = useState(() => new Set())
  const [openMenuId, setOpenMenuId] = useState(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const [stockModalOpen, setStockModalOpen] = useState(false)
  const [stockTargetProduct, setStockTargetProduct] = useState(null)
  const [selectedVarIdx, setSelectedVarIdx] = useState(0)
  const [stockType, setStockType] = useState('entrada')
  const [stockQty, setStockQty] = useState('0')
  const [stockDesc, setStockDesc] = useState('')
  const [savingAction, setSavingAction] = useState(false)
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)
  const [confirmRemoveProduct, setConfirmRemoveProduct] = useState(null)
  const [reservedOpen, setReservedOpen] = useState(false)
  const [reservedProduct, setReservedProduct] = useState(null)

  const [gridCols, setGridCols] = useState(null)
  const [showExtras, setShowExtras] = useState(true)

  useEffect(() => {
    function handleResize() {
      const w = window.innerWidth
      if (w < 768) {
        setGridCols(null) // mobile default via class
        setShowExtras(false)
      } else if (w < 1300) {
        setGridCols('1.5rem minmax(0, 1fr) 8rem 5rem 5.5rem 2rem')
        setShowExtras(false)
      } else {
        setGridCols('1.5rem minmax(0, 1fr) 5rem 5rem 3rem minmax(0, 1fr) 8rem 5rem 5.5rem 2rem')
        setShowExtras(true)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const [movementsModalOpen, setMovementsModalOpen] = useState(false)
  const [movementsTargetProduct, setMovementsTargetProduct] = useState(null)
  const [allOrders, setAllOrders] = useState([])

  // Categorias
  const [categories, setCategories] = useState([])
  const [catSelected, setCatSelected] = useState(() => new Set())
  const [catShowActive, setCatShowActive] = useState(true)
  const [catShowInactive, setCatShowInactive] = useState(false)
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [catEditOpen, setCatEditOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)

  // Fornecedores
  const [suppliers, setSuppliers] = useState([])
  const [supplierModalOpen, setSupplierModalOpen] = useState(false)
  const [supplierEditOpen, setSupplierEditOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [supSelected, setSupSelected] = useState(() => new Set())
  // Opções menu
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [showLabelsScreen, setShowLabelsScreen] = useState(false)
  const [categoryMenuId, setCategoryMenuId] = useState(null)
  const [bulkCategory, setBulkCategory] = useState(null)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkType, setBulkType] = useState('add')
  const [bulkAmount, setBulkAmount] = useState('')
  const [bulkPercent, setBulkPercent] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkReviewOpen, setBulkReviewOpen] = useState(false)
  const [bulkCandidateIds, setBulkCandidateIds] = useState([])
  const [bulkSelectedIds, setBulkSelectedIds] = useState(() => new Set())
  const [bulkSelectedSlots, setBulkSelectedSlots] = useState([true, true, true, true, true])
  const [bulkConfig, setBulkConfig] = useState(null)
  const [bulkReviewQuery, setBulkReviewQuery] = useState('')

  useEffect(() => {
    const unsubProd = listenProducts(items => setProducts(items), storeId)
    const unsubCat = listenCategories(items => setCategories(items), storeId)
    const unsubSup = listenSuppliers(items => setSuppliers(items), storeId)
    return () => {
      unsubProd && unsubProd()
      unsubCat && unsubCat()
      unsubSup && unsubSup()
    }
  }, [storeId])

  useEffect(() => {
    if (!storeId) return
    const unsub = listenOrders(items => setAllOrders(items), storeId)
    return () => { unsub && unsub() }
  }, [storeId])

  const reservedMap = useMemo(() => {
    const map = {}
    allOrders.forEach(o => {
      const st = (o.status || '').toLowerCase()
      // Status que não reservam (liberam a reserva)
      const isFree = 
        st.includes('faturada') || 
        st.includes('cancelado') || 
        st.includes('sem conserto') ||
        st.includes('devolução') ||
        st.includes('devolucao') ||
        st === 'finalizado'

      if (!isFree) {
        if (Array.isArray(o.products)) {
          o.products.forEach(p => {
             if (p.productId) {
               const qty = Number(p.quantity || 0)
               map[p.productId] = (map[p.productId] || 0) + qty
             }
          })
        }
      }
    })
    return map
  }, [allOrders])

  const filtered = useMemo(()=>{
    const q = query.trim().toLowerCase()
    let res = products.filter(p => 
      (p.name || '').toLowerCase().includes(q) || 
      (p.reference || '').toLowerCase().includes(q)
    )

    // Apply filters
    if (activeFilters.categoryId) {
       res = res.filter(p => p.categoryId === activeFilters.categoryId)
    }
    if (activeFilters.supplier) {
       // Check if supplier is stored as name or ID. Usually name in this codebase based on previous context.
       // But let's check strict match or includes.
       // NewProductModal stores supplier name string.
       res = res.filter(p => p.supplier === activeFilters.supplier)
    }
    if (activeFilters.origin) {
       res = res.filter(p => String(p.origin) === String(activeFilters.origin))
    }
    if (activeFilters.ncm) {
       res = res.filter(p => (p.ncm || '').includes(activeFilters.ncm))
    }
    if (activeFilters.cest) {
       res = res.filter(p => (p.cest || '').includes(activeFilters.cest))
    }
    if (activeFilters.validityStart) {
       res = res.filter(p => p.validityDate && p.validityDate >= activeFilters.validityStart)
    }
    if (activeFilters.validityEnd) {
       res = res.filter(p => p.validityDate && p.validityDate <= activeFilters.validityEnd)
    }
    if (activeFilters.lowStock) {
       res = res.filter(p => {
          const s = Number(p.stock||0)
          const m = Number(p.stockMin||0)
          return s <= m
       })
    }
    if (activeFilters.noStock) {
       res = res.filter(p => Number(p.stock||0) === 0)
    }

    // Status
    const fActive = activeFilters.filterActive ?? true // default true if not set
    const fInactive = activeFilters.filterInactive ?? false // default false if not set? 
    // Wait, earlier I decided default is All? 
    // If activeFilters is empty, defaults are not set.
    // If user opens modal and clicks filter, activeFilters will be populated.
    // If activeFilters is empty, I show all.
    // If activeFilters is NOT empty, I follow the logic.
    // But how do I distinguish "empty" from "user selected Active only"?
    // I can check if keys exist.
    
    if (Object.keys(activeFilters).length > 0) {
        if (fActive && !fInactive) {
           res = res.filter(p => (p.active ?? true) === true)
        } else if (!fActive && fInactive) {
           res = res.filter(p => (p.active ?? true) === false)
        } else if (!fActive && !fInactive) {
           res = []
        }
    }
    
    return res
  }, [products, query, activeFilters])

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase()
    return categories
      .filter(c => (c.name || '').toLowerCase().includes(q))
      .filter(c => (c.active ?? true) ? catShowActive : catShowInactive)
  }, [categories, query, catShowActive, catShowInactive])

  const bulkCandidates = useMemo(() => {
    if (!bulkCategory) return []
    if (!Array.isArray(bulkCandidateIds) || bulkCandidateIds.length === 0) return []
    const ids = new Set(bulkCandidateIds)
    return products.filter(p => ids.has(p.id))
  }, [products, bulkCategory, bulkCandidateIds])

  const bulkFilteredCandidates = useMemo(() => {
    const list = bulkCandidates
    const q = bulkReviewQuery.trim().toLowerCase()
    if (!q) return list
    return list.filter(p => {
      const name = (p.name || '').toLowerCase()
      const ref = (p.reference || '').toLowerCase()
      return name.includes(q) || ref.includes(q)
    })
  }, [bulkCandidates, bulkReviewQuery])

  const bulkMaxSlots = useMemo(() => {
    if (!bulkCategory) return 0
    if (!bulkCandidates.length) return 0
    const selectedIds = bulkSelectedIds && bulkSelectedIds.size > 0 ? bulkSelectedIds : null
    const source = selectedIds
      ? bulkCandidates.filter(p => selectedIds.has(p.id))
      : bulkCandidates
    if (!source.length) return 0
    const max = Math.max(
      ...source.map(p =>
        Array.isArray(p.variationsData) ? p.variationsData.length : 0
      )
    )
    if (!max) return 0
    return Math.min(max, bulkSelectedSlots.length)
  }, [bulkCategory, bulkCandidates, bulkSelectedIds, bulkSelectedSlots])

  const getClientFinalPrice = (p) => {
    if (Array.isArray(p.variationsData) && p.variationsData.length > 0) {
      const targetNames = [
        '1 - PREÇO P/ CLIENTE FINAL',
        '1- PREÇO DO PRODUTO',
        '1- VALOR DO PRODUTO'
      ]
      let v = p.variationsData.find(x => targetNames.includes(x.name))
      if (!v) v = p.variationsData[0]
      const promo = v.promoPrice != null ? Number(v.promoPrice) : null
      const sale = Number(v.salePrice ?? 0)
      if (promo && !isNaN(promo)) return promo
      if (sale && !isNaN(sale)) return sale
    }
    const promo = p.promoPrice != null ? Number(p.promoPrice) : null
    const sale = Number(p.salePrice ?? 0)
    const min = Number(p.priceMin ?? 0)
    if (promo && !isNaN(promo)) return promo
    if (sale && !isNaN(sale)) return sale
    if (min && !isNaN(min)) return min
    return 0
  }

  const toggleSelect = (id) => {
    const next = new Set(selected)
    if(next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }

  const toggleMobileRow = (id) => {
    const next = new Set(mobileOpenRows)
    if(next.has(id)) next.delete(id); else next.add(id)
    setMobileOpenRows(next)
  }

  const toggleCatSelect = (id) => {
    const next = new Set(catSelected)
    if(next.has(id)) next.delete(id); else next.add(id)
    setCatSelected(next)
  }

  const toggleCategoryActive = async (id) => {
    const c = categories.find(x=>x.id===id)
    if(!c) return
    await updateCategory(id, { active: !c.active })
  }

  const addNew = () => {
    if(tab === 'categorias'){
      setCatModalOpen(true)
    } else if (tab === 'fornecedores'){
      setSupplierModalOpen(true)
    } else {
      setModalOpen(true)
    }
  }

  // Disparo pelo Header: quando o sinal muda, abre o modal apropriado
  useEffect(() => {
    if (typeof addNewSignal === 'number' && addNewSignal > 0) {
      // evita executar no mount inicial (state começa em 0)
      addNew()
    }
  }, [addNewSignal])

  const startEdit = (product) => {
    setEditingProduct(product)
    setEditModalOpen(true)
  }

  const handleClone = async (product) => {
    if (!storeId) return
    try {
      setSavingAction(true)
      const { id, createdAt, updatedAt, number, ...rest } = product || {}
      
      // Lógica de sufixo alfabético (A, B, C...)
      let newCode = String(product.reference || '').trim()
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

      // Encontrar todos os produtos que começam com o mesmo código base
      // Ex: se o código é 12345, procura por 12345, 12345A, 12345B...
      // Se o código já for 12345A, a base é 12345
      
      // Regex para identificar base e sufixo
      // Captura grupo 1: parte numérica ou texto base
      // Captura grupo 2: letra final opcional
      const match = newCode.match(/^(.*)([A-Z])$/)
      let baseCode = newCode
      if (match) {
        // Se já termina com letra (ex: 54860A), a base é 54860
        baseCode = match[1]
      }

      // Filtrar produtos que tenham o código começando com a base
      const similarProducts = products.filter(p => {
        const c = String(p.reference || '').trim()
        // Deve começar com a base E ter tamanho compatível (base + 0 ou 1 char)
        return c.startsWith(baseCode)
      })

      // Encontrar o próximo sufixo disponível
      let nextSuffix = 'A'
      
      // Coletar todos os sufixos existentes para essa base
      const existingSuffixes = new Set()
      similarProducts.forEach(p => {
        const c = String(p.reference || '').trim()
        
        // Se for exatamente a base (ex: 54860), não tem sufixo
        if (c === baseCode) return 

        // Se tiver tamanho diferente de base + 1, ignora (ex: 54860123 não conta)
        if (c.length !== baseCode.length + 1) return

        const suffix = c.slice(baseCode.length)
        if (alphabet.includes(suffix)) {
          existingSuffixes.add(suffix)
        }
      })

      // Procurar a primeira letra livre
      for (let i = 0; i < alphabet.length; i++) {
        if (!existingSuffixes.has(alphabet[i])) {
          nextSuffix = alphabet[i]
          break
        }
      }

      const finalCode = `${baseCode}${nextSuffix}`

      const data = { 
        ...rest, 
        name: product?.name || 'Produto',
        reference: finalCode,
        stock: 0 // Zera o estoque ao clonar, por segurança/padrão
      }
      
      if (data.variationsData && Array.isArray(data.variationsData)) {
        data.variationsData = data.variationsData.map(v => ({ ...v, stock: 0 }))
      }

      await addProduct(data, storeId)
      setOpenMenuId(null)
    } finally {
      setSavingAction(false)
    }
  }

  const handleToggleActive = async (product) => {
    try {
      setSavingAction(true)
      const next = !(product.active ?? true)
      await updateProduct(product.id, { active: next })
      setOpenMenuId(null)
    } finally {
      setSavingAction(false)
    }
  }

  const openStockModal = (product) => {
    setStockTargetProduct(product)
    const hasVars = Array.isArray(product?.variationsData) && product.variationsData.length > 0
    setSelectedVarIdx(hasVars ? 0 : -1)
    setStockType('entrada')
    setStockQty('0')
    setStockDesc('')
    setStockModalOpen(true)
    setOpenMenuId(null)
  }

  const openMovementsModal = (product) => {
    setMovementsTargetProduct(product)
    setMovementsModalOpen(true)
    setOpenMenuId(null)
  }

  const openConfirmRemove = (product) => {
    setConfirmRemoveProduct(product)
    setConfirmRemoveOpen(true)
    setOpenMenuId(null)
  }

  const confirmRemoveFromCatalog = async () => {
    const p = confirmRemoveProduct
    if (!p) return setConfirmRemoveOpen(false)
    try {
      setSavingAction(true)
      await removeProduct(p.id)
      setConfirmRemoveOpen(false)
    } finally {
      setSavingAction(false)
    }
  }

  const confirmStockAdjust = async () => {
    const p = stockTargetProduct
    if (!p) return setStockModalOpen(false)
    const q = Math.max(0, parseInt(String(stockQty), 10) || 0)
    const delta = stockType === 'entrada' ? q : -q
    const hasVars = Array.isArray(p.variationsData) && p.variationsData.length > 0
    const varIndex = hasVars ? 0 : -1
    try {
      setSavingAction(true)
      if (hasVars && varIndex >= 0) {
        const items = p.variationsData.map((v) => ({ ...v }))
        const cur = Number(items[varIndex]?.stock ?? 0)
        items[varIndex].stock = Math.max(0, cur + delta)
        const total = items.reduce((s, v) => s + (Number(v.stock ?? 0)), 0)
        await updateProduct(p.id, { variationsData: items, stock: total })
        
        await recordStockMovement({
          productId: p.id,
          productName: p.name,
          variationId: items[varIndex].id || null,
          variationName: items[varIndex].name || items[varIndex].label || `Variação ${varIndex+1}`,
          type: stockType === 'entrada' ? 'in' : 'out',
          quantity: q,
          reason: 'manual_adjust',
          description: stockDesc,
          userId: user?.uid,
          userName: user?.name
        })

      } else {
        const cur = Number(p.stock ?? 0)
        const next = Math.max(0, cur + delta)
        await updateProduct(p.id, { stock: next })
        
        await recordStockMovement({
          productId: p.id,
          productName: p.name,
          type: stockType === 'entrada' ? 'in' : 'out',
          quantity: q,
          reason: 'manual_adjust',
          description: stockDesc,
          userId: user?.uid,
          userName: user?.name
        })
      }
      setStockModalOpen(false)
    } finally {
      setSavingAction(false)
    }
  }

  const startCategoryEdit = (category) => {
    setEditingCategory(category)
    setCatEditOpen(true)
  }

  const startSupplierEdit = (supplier) => {
    setEditingSupplier(supplier)
    setSupplierEditOpen(true)
  }

  const openBulkPricing = (category) => {
    setBulkCategory(category)
    setBulkType('add')
    setBulkAmount('')
    setBulkPercent('')
    setBulkModalOpen(true)
    setCategoryMenuId(null)
  }

  const confirmBulkPricing = async () => {
    if (!bulkCategory || !storeId) {
      setBulkModalOpen(false)
      return
    }
    const amountValue = (() => {
      const raw = String(bulkAmount || '').trim()
      if (!raw) return 0
      const normalized = raw.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
      const num = parseFloat(normalized)
      return isNaN(num) ? 0 : num
    })()
    const percentValue = (() => {
      const num = parseFloat(String(bulkPercent || '').replace(',', '.'))
      return isNaN(num) ? 0 : num
    })()
    if (!amountValue && !percentValue) {
      return
    }
    const affected = products.filter(p => p.categoryId === bulkCategory.id)
    if (!affected.length) {
      setBulkModalOpen(false)
      return
    }
    const type = bulkType === 'remove' ? -1 : 1
    setBulkConfig({ amountValue, percentValue, type })
    setBulkCandidateIds(affected.map(p => p.id))
    setBulkSelectedIds(new Set())
    setBulkSelectedSlots([true, true, true, true, true])
    setBulkReviewQuery('')
    setBulkModalOpen(false)
    setBulkReviewOpen(true)
  }

  const applyBulkPricing = async () => {
    if (!bulkCategory || !storeId || !bulkConfig) {
      setBulkReviewOpen(false)
      return
    }
    const { amountValue, percentValue, type } = bulkConfig
    if (!amountValue && !percentValue) {
      setBulkReviewOpen(false)
      return
    }
    if (!bulkSelectedIds || bulkSelectedIds.size === 0) {
      setBulkReviewOpen(false)
      return
    }
    const affected = products.filter(p => p.categoryId === bulkCategory.id && bulkSelectedIds.has(p.id))
    if (!affected.length) {
      setBulkReviewOpen(false)
      return
    }
    try {
      setBulkSaving(true)
      for (const p of affected) {
        const baseSale = Number(p.salePrice ?? 0)
        const baseMin = Number(p.priceMin ?? baseSale)
        const baseMax = Number(p.priceMax ?? (baseSale || baseMin))
        const applyAmount = (value, amount) => {
          const next = value + type * amount
          return next < 0 ? 0 : Number(next.toFixed(2))
        }
        const applyPercent = (value, percent) => {
          const factor = 1 + type * (percent / 100)
          const next = value * factor
          return next < 0 ? 0 : Number(next.toFixed(2))
        }
        let nextSale = baseSale
        let nextMin = baseMin
        let nextMax = baseMax
        if (amountValue) {
          if (baseSale) nextSale = applyAmount(baseSale, amountValue)
          if (baseMin) nextMin = applyAmount(baseMin, amountValue)
          if (baseMax) nextMax = applyAmount(baseMax, amountValue)
        }
        if (percentValue) {
          if (baseSale) nextSale = applyPercent(nextSale, percentValue)
          if (baseMin) nextMin = applyPercent(nextMin, percentValue)
          if (baseMax) nextMax = applyPercent(nextMax, percentValue)
        }
        const payload = {}
        if (!isNaN(nextSale) && baseSale) payload.salePrice = nextSale
        if (!isNaN(nextMin) && baseMin) payload.priceMin = nextMin
        if (!isNaN(nextMax) && baseMax) payload.priceMax = nextMax
        if (Array.isArray(p.variationsData) && p.variationsData.length > 0) {
          const items = p.variationsData.map((v, idx) => {
            const slotSelected =
              bulkMaxSlots > 0 &&
              idx < bulkMaxSlots &&
              idx < bulkSelectedSlots.length &&
              bulkSelectedSlots[idx]
            if (!slotSelected) {
              return v
            }
            const vSaleBase = Number(v.salePrice ?? 0)
            const vMinBase = Number(v.priceMin ?? vSaleBase)
            const vMaxBase = Number(v.priceMax ?? (vSaleBase || vMinBase))
            let vSale = vSaleBase
            let vMin = vMinBase
            let vMax = vMaxBase
            if (amountValue) {
              if (vSaleBase) vSale = applyAmount(vSaleBase, amountValue)
              if (vMinBase) vMin = applyAmount(vMinBase, amountValue)
              if (vMaxBase) vMax = applyAmount(vMaxBase, amountValue)
            }
            if (percentValue) {
              if (vSaleBase) vSale = applyPercent(vSale, percentValue)
              if (vMinBase) vMin = applyPercent(vMin, percentValue)
              if (vMaxBase) vMax = applyPercent(vMax, percentValue)
            }
            return {
              ...v,
              salePrice: !isNaN(vSale) && vSaleBase ? vSale : v.salePrice,
              priceMin: !isNaN(vMin) && vMinBase ? vMin : v.priceMin,
              priceMax: !isNaN(vMax) && vMaxBase ? vMax : v.priceMax,
            }
          })
          payload.variationsData = items
        }
        if (Object.keys(payload).length > 0) {
          await updateProduct(p.id, payload)
        }
      }
      setBulkReviewOpen(false)
      setBulkConfig(null)
      setBulkCandidateIds([])
      setBulkSelectedIds(new Set())
    } finally {
      setBulkSaving(false)
    }
  }

  if (showLabelsScreen) {
    return (
      <ProductLabelsPage 
        products={products}
        categories={categories}
        suppliers={suppliers}
        onBack={() => setShowLabelsScreen(false)}
      />
    )
  }

  return (
    <div>
      {/* Tabs no topo: rolável no mobile */}
      <div className="mb-3">
        <div className="flex items-center gap-3 text-sm overflow-x-auto whitespace-nowrap md:overflow-visible scrollbar-none -mx-2 px-2">
          {tabs.map(t => (
            <button
              key={t.key}
              className={`shrink-0 inline-flex px-2 py-1 ${tab===t.key ? 'text-green-700 font-medium border-b-2 border-green-600' : 'text-gray-600'}`}
              onClick={()=>setTab(t.key)}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {/* Toolbar de busca com botões à direita */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-2">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input 
              value={query} 
              onChange={e=>setQuery(e.target.value)} 
              placeholder="Pesquisar..." 
              className="pl-10 pr-3 py-2 border rounded w-full bg-gray-100 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 border-gray-200" 
            />
          </div>

          {/* Filtros */}
          <button
            className="md:hidden h-9 w-9 shrink-0 rounded border flex items-center justify-center bg-gray-50"
            aria-label="Filtros"
            title="Filtros"
            onClick={()=>setShowFilters(x=>!x)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M3 5h18M6 12h12M10 19h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded border text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100" onClick={()=>setShowFilters(x=>!x)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 5h18M6 12h12M10 19h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Filtros
          </button>

          {/* Alternador de visualização */}
          <button className="px-3 py-2 rounded border text-sm text-gray-500 bg-gray-50 hover:bg-gray-100" onClick={()=>setViewMode(viewMode==='list'?'grid':'list')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Opções */}
          <div className="relative hidden md:inline-block">
            <button 
              className="px-4 py-2 rounded border border-green-500 text-green-600 text-sm font-medium hover:bg-green-50"
              onClick={() => setOptionsOpen(!optionsOpen)}
            >
              Opções
            </button>
            {optionsOpen && (
              <div className="absolute top-full left-0 mt-1 w-40 bg-white rounded-lg shadow-xl border z-50 py-1">
                 <button 
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700"
                  onClick={() => { setOptionsOpen(false); setShowLabelsScreen(true); }}
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                   </svg>
                   Etiquetas
                 </button>
                 <button 
                   className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700"
                   onClick={() => { setOptionsOpen(false); /* TODO: Exportar */ }}
                 >
                   <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                   </svg>
                   Exportar
                 </button>
              </div>
            )}
          </div>

          {/* + Novo */}
          <button className="hidden md:inline-flex px-4 py-2 rounded bg-green-500 text-white text-sm font-medium hover:bg-green-600" onClick={addNew}>
            + Novo
          </button>
        </div>
      </div>

      {/* Barra fina de cabeçalho da listagem (oculta no mobile quando tab=produto) */}
      <div className={`mt-2 px-2 py-2 border-b bg-gray-50 text-xs lg:text-sm text-gray-600 font-bold overflow-x-auto ${tab==='produto' ? 'hidden md:block' : ''}`}>
        {tab==='produto' && (
          <div 
            className="grid gap-x-2 min-w-full"
            style={gridCols ? { gridTemplateColumns: gridCols } : {}}
          >
            <div></div>
            <div>Produto ({filtered.length})</div>
            {showExtras && <div>Código</div>}
            {showExtras && <div className="text-center">Atualizado </div>}
            {showExtras && <div className="text-center">Hora</div>}
            {showExtras && <div className="text-center">Funcionário</div>}
            <div className="text-right">Preço</div>
            <div className="text-right">Estoque</div>
            <div className="text-right">Status</div>
            <div></div>
          </div>
        )}
        {tab==='categorias' && (
          <div className="grid grid-cols-[1fr_8rem_6rem]">
            <div>Categorias ({filteredCategories.length})</div>
            <div className="text-right">Status</div>
            <div></div>
          </div>
        )}
        {tab==='fornecedores' && (
          <div className="grid grid-cols-[1fr_8rem_6rem]">
            <div>Fornecedores ({suppliers.length})</div>
            <div className="text-right">Status</div>
            <div></div>
          </div>
        )}
      </div>

      <div className="mt-4">
        {(tab==='produto') ? (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            {filtered.map(p => {
              const clientFinal = getClientFinalPrice(p)
              const priceText = clientFinal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
              const stock = Number(p.stock ?? 0)
              const reserved = reservedMap[p.id] || 0
              const stockDotClass = stock <= 0 ? 'red-dot' : (stock === 1 ? 'orange-dot' : 'green-dot')
              return (
                <>
                <div 
                  key={p.id} 
                  className="relative grid grid-cols-[1.5rem_1fr_auto_auto] md:grid-cols-none gap-x-2 items-center px-2 py-2 border-b last:border-0 min-w-full hover:bg-gray-50 transition-colors"
                  style={gridCols ? { gridTemplateColumns: gridCols } : {}}
                >
                  <div>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={()=>toggleSelect(p.id)} />
                  </div>
                  <div className="text-xs lg:text-sm overflow-hidden">
                    <div className="truncate" title={p.name}>
                      {p.name}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      Estoque: {stock.toLocaleString('pt-BR')}
                      <span className={stockDotClass} />
                    </div>
                  </div>
                  {showExtras && (
                    <div className="hidden md:block text-xs lg:text-sm text-gray-500 font-mono">
                      {p.reference || '-'}
                    </div>
                  )}
                  {/* Data de atualização (substituindo prévia de variações) */}
                  {showExtras && (
                    <div className="hidden md:flex text-xs lg:text-sm text-gray-700 justify-center items-center whitespace-nowrap">
                       {p.updatedAt?.seconds ? new Date(p.updatedAt.seconds * 1000).toLocaleDateString('pt-BR') : '—'}
                    </div>
                  )}
                  {showExtras && (
                    <div className="hidden md:flex text-xs lg:text-sm text-gray-700 justify-center items-center whitespace-nowrap">
                       {p.updatedAt?.seconds ? new Date(p.updatedAt.seconds * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                  )}
                  {showExtras && (
                    <div className="hidden md:flex text-xs lg:text-sm text-gray-700 justify-center items-center truncate px-2" title={p.lastEditedBy || p.createdBy || ''}>
                       {p.lastEditedBy || p.createdBy || '—'}
                    </div>
                  )}
                  <div className="text-right whitespace-nowrap md:whitespace-normal md:text-right md:pl-0 pl-4 justify-self-end flex flex-col items-end justify-center">
                    <div className="text-xs lg:text-sm whitespace-nowrap">{priceText}</div>
                    {/* Botão sanfona (mobile e desktop) abaixo do preço */}
                    {(Array.isArray(p.variationsData) && p.variationsData.length > 0) && (
                      <div className="mt-1">
                        <button
                          type="button"
                          aria-label="Abrir precificações"
                          title="Abrir precificações"
                          className="inline-flex h-6 w-6 items-center justify-center rounded border bg-white hover:bg-gray-50"
                          onClick={()=>toggleMobileRow(p.id)}
                        >
                          <svg
                            className={`${mobileOpenRows.has(p.id) ? '' : 'rotate-180'} transition-transform`}
                            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          >
                            <polyline points="18 15 12 9 6 15"></polyline>
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Div anterior do botão sanfona removida/esvaziada para manter grid, ou ajustada */}
                  <div className="md:hidden text-right hidden"></div>
                  <div className={`hidden md:block text-right text-xs lg:text-sm whitespace-nowrap ${stock === 0 ? 'text-red-500' : ''}`}>{stock.toLocaleString('pt-BR')}</div>
                  <div className="hidden md:block text-right text-xs lg:text-sm">
                    <div className={`inline-block px-2 py-0.5 rounded text-xs lg:text-sm font-semibold border ${(p.active ?? true) ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{(p.active ?? true) ? 'Ativo' : 'Inativo'}</div>
                  </div>
                  <div className="text-right text-sm relative">
                    <button
                      type="button"
                      aria-label="Mais ações"
                      title="Mais ações"
                      className="inline-flex h-8 w-8 items-center justify-center rounded border"
                      onClick={(e) => {
                        e.stopPropagation()
                        const rect = e.currentTarget.getBoundingClientRect()
                        // w-56 = 14rem = 224px. Ajuste para alinhar a direita do menu com a direita do botão
                        setMenuPos({ top: rect.bottom + 2, left: rect.right - 224 })
                        setOpenMenuId(openMenuId === p.id ? null : p.id)
                      }}
                    >
                      ⋯
                    </button>
                    {openMenuId === p.id && (
                      <div 
                        className="fixed z-[9999] w-56 bg-white border rounded-lg shadow-lg"
                        style={{ top: menuPos.top, left: menuPos.left }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="py-2">
                          <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2" onClick={()=> { startEdit(p); setOpenMenuId(null); }}>
                            <span>✏️</span>
                            <span>Editar</span>
                          </button>
                          <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2" onClick={()=> handleClone(p)}>
                            <span>📄</span>
                            <span>Clonar</span>
                          </button>
                          <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2" onClick={()=> handleToggleActive(p)}>
                            <span>{(p.active ?? true) ? '✖️' : '✔️'}</span>
                            <span>{(p.active ?? true) ? 'Inativar' : 'Ativar'}</span>
                          </button>
                        <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2" onClick={()=> openStockModal(p)}>
                          <span>📦</span>
                          <span>Alterar estoque</span>
                        </button>
                        <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2" onClick={()=> openMovementsModal(p)}>
                          <span>📊</span>
                          <span>Movimentações</span>
                        </button>
                        <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2" onClick={()=>{ setReservedProduct(p); setReservedOpen(true); setOpenMenuId(null) }}>
                          <span>🔖</span>
                          <span>Reservados</span>
                        </button>
                        <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2" onClick={()=>{ console.log('destacar', p.id) }}>
                          <span>⭐</span>
                          <span>Destacar</span>
                        </button>
                        <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2" onClick={()=> openConfirmRemove(p)}>
                          <span>🗂️</span>
                          <span>Excluir do catálogo</span>
                        </button>
                        <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2" onClick={()=>{ console.log('sincronizar', p.id) }}>
                          <span>🔁</span>
                          <span>Sincronizar entre empresas</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                </div>
                  {/* Painel sanfona com variações (somente mobile) com animação */}
                  <div className={`md:hidden px-4 ${mobileOpenRows.has(p.id) ? 'py-2 bg-gray-50 border-b' : 'py-0'} last:border-0`}
                  >
                    <div className={`overflow-hidden transition-all duration-200 ease-in-out ${mobileOpenRows.has(p.id) ? 'max-h-[480px] opacity-100' : 'max-h-0 opacity-0'}`}>
                      {Array.isArray(p.variationsData) && p.variationsData.length > 0 ? (
                        <div className="space-y-2">
                          {p.variationsData.map((v, idx) => {
                            const sale = Number(v?.salePrice ?? 0)
                            const promo = v?.promoPrice != null ? Number(v.promoPrice) : null
                            const price = promo != null ? promo : sale
                            const stockVar = Number(v?.stock ?? 0)
                            return (
                              <div className="grid grid-cols-[1fr_6rem] items-center gap-2 text-xs">
                                <div className="truncate" title={v?.name || v?.label || `Variação ${idx+1}`}>
                                  <span className="font-medium">{v?.name || v?.label || `Variação ${idx+1}`}</span>
                                  {p.reference ? (<span className="ml-1 text-gray-500">({p.reference})</span>) : null}
                                  {stockVar ? (<span className="ml-2 text-gray-500">Estoque: {stockVar.toLocaleString('pt-BR')}</span>) : null}
                                </div>
                                <div className="text-right whitespace-nowrap">
                                  {price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-600 py-2">Sem variações cadastradas</div>
                      )}
                    </div>
                  </div>
                  {/* Painel sanfona com variações (somente desktop) com animação */}
                  <div className={`hidden md:block px-4 ${mobileOpenRows.has(p.id) ? 'py-2 bg-gray-50 border-b' : 'py-0'} last:border-0`}>
                    <div className={`overflow-hidden transition-all duration-200 ease-in-out ${mobileOpenRows.has(p.id) ? 'max-h-[480px] opacity-100' : 'max-h-0 opacity-0'}`}>
                      {Array.isArray(p.variationsData) && p.variationsData.length > 0 ? (
                        <div className="space-y-2">
                          {p.variationsData.map((v, idx) => {
                            const sale = Number(v?.salePrice ?? 0)
                            const promo = v?.promoPrice != null ? Number(v.promoPrice) : null
                            const price = promo != null ? promo : sale
                            const stockVar = Number(v?.stock ?? 0)
                            return (
                              <div 
                                key={idx} 
                                className="grid gap-x-4 items-center text-xs min-w-full"
                                style={gridCols ? { gridTemplateColumns: gridCols } : {}}
                              >
                                <div></div>
                                <div className={`${showExtras ? 'col-span-5' : 'col-span-1'} truncate`} title={v?.name || v?.label || `Variação ${idx+1}`}>
                                  <span className="font-medium text-gray-700">{v?.name || v?.label || `Variação ${idx+1}`}</span>
                                  {p.reference ? (<span className="ml-1 text-gray-500">({p.reference})</span>) : null}
                                </div>
                                <div className="text-right whitespace-nowrap">
                                  {price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                                </div>
                                <div className="text-right text-gray-500">
                                  {stockVar ? stockVar.toLocaleString('pt-BR') : '-'}
                                </div>
                                <div></div>
                                <div></div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600 py-2">Sem variações cadastradas</div>
                      )}
                    </div>
                  </div>
                </>
              )
            })}
          </div>
        ) : (
          tab==='categorias' ? (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {/* Mantém listagem de categorias */}
              <div className="grid grid-cols-[1.5rem_1fr_8rem_2rem] items-center px-4 py-3 text-xs text-gray-500 border-b">
                <div></div>
                <div>Nome</div>
                <div className="text-right">Status</div>
                <div></div>
              </div>
              {filteredCategories.map(c => (
                <div key={c.id} className="grid grid-cols-[1.5rem_1fr_8rem_2rem] items-center px-4 py-3 border-b last:border-0">
                  <div></div>
                  <div className="text-sm">
                    <div className="font-medium cursor-pointer" onClick={()=>startCategoryEdit(c)}>{c.name}</div>
                  </div>
                  <div className="hidden md:block text-sm text-right">
                    <div className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${(c.active ?? true) ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                      {(c.active ?? true) ? 'Ativo' : 'Inativo'}
                    </div>
                  </div>
                  <div className="text-right text-sm relative">
                    <button
                      type="button"
                      aria-label="Mais ações de categoria"
                      title="Mais ações"
                      className="inline-flex h-8 w-8 items-center justify-center rounded border"
                      onClick={() => setCategoryMenuId(categoryMenuId === c.id ? null : c.id)}
                    >
                      ⋯
                    </button>
                    {categoryMenuId === c.id && (
                      <div className="absolute z-50 right-0 top-full mt-1 w-56 bg-white border rounded-lg shadow">
                        <div className="py-2">
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            onClick={() => openBulkPricing(c)}
                          >
                            <span>⚙️</span>
                            <span>Precificações em massa</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : tab==='fornecedores' ? (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="grid grid-cols-[1.5rem_1fr_8rem_2rem] items-center px-4 py-3 text-xs text-gray-500 border-b">
                <div></div>
                <div>Fornecedor ({suppliers.length})</div>
                <div className="text-right">Status</div>
                <div></div>
              </div>
              {suppliers.map(s => (
                <div key={s.id} className="grid grid-cols-[1.5rem_1fr_8rem_2rem] items-center px-4 py-3 border-b last:border-0">
                  <div></div>
                  <div className="text-sm">
                    <div className="font-medium cursor-pointer" onClick={()=>startSupplierEdit(s)}>{s.name}</div>
                  </div>
                  <div className="hidden md:block text-sm text-right">
                    <div className={`px-2 py-1 rounded text-xs ${(s.active ?? true) ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>{(s.active ?? true) ? 'Ativo' : 'Inativo'}</div>
                  </div>
                  <div className="text-right text-sm">⋯</div>
                </div>
              ))}
            </div>
          ) : null)
        }
      </div>
      {(openMenuId || categoryMenuId) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setOpenMenuId(null)
            setCategoryMenuId(null)
          }}
        />
      )}
      <NewProductModal open={modalOpen} onClose={()=>setModalOpen(false)} categories={categories} suppliers={suppliers} storeId={storeId} user={user} />
      <NewProductModal open={editModalOpen} onClose={()=>setEditModalOpen(false)} isEdit={true} product={editingProduct} categories={categories} suppliers={suppliers} storeId={storeId} user={user} />
      <NewCategoryModal open={catModalOpen} onClose={()=>setCatModalOpen(false)} storeId={storeId} />
      <NewCategoryModal open={catEditOpen} onClose={()=>setCatEditOpen(false)} isEdit={true} category={editingCategory} storeId={storeId} />
      <NewSupplierModal open={supplierModalOpen} onClose={()=>setSupplierModalOpen(false)} storeId={storeId} />
      <NewSupplierModal open={supplierEditOpen} onClose={()=>setSupplierEditOpen(false)} isEdit={true} supplier={editingSupplier} storeId={storeId} />
      
      <StockMovementsModal 
        open={movementsModalOpen} 
        onClose={() => setMovementsModalOpen(false)} 
        product={movementsTargetProduct} 
      />

      {confirmRemoveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setConfirmRemoveOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-lg w-[95vw] max-w-[520px]">
            <div className="px-4 py-3 border-b">
              <h3 className="text-base font-medium">Excluir do catálogo</h3>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div>
                Tem certeza que deseja excluir “{confirmRemoveProduct?.name}” do catálogo?
              </div>
              <div>
                Esta ação também zera o estoque do produto{Array.isArray(confirmRemoveProduct?.variationsData) && (confirmRemoveProduct?.variationsData?.length||0) > 0 ? ' e de todas as variações' : ''}.
              </div>
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button className="px-3 py-2 text-sm rounded border" onClick={()=>setConfirmRemoveOpen(false)} disabled={savingAction}>Cancelar</button>
              <button className="px-3 py-2 text-sm rounded bg-red-600 text-white" onClick={confirmRemoveFromCatalog} disabled={savingAction}>Excluir</button>
            </div>
          </div>
        </div>
      )}
      {stockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setStockModalOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-lg w-[95vw] max-w-[560px]">
            <div className="px-4 py-3 border-b">
              <h3 className="text-base font-medium">Adicionar / Remover Estoque</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <div className="text-xs text-gray-600 mb-1">Tipo</div>
                <div className="flex items-center gap-2">
                  <button type="button" className={`px-3 py-1 rounded border text-sm ${stockType==='entrada' ? 'bg-green-50 border-green-300 text-green-700' : ''}`} onClick={()=>setStockType('entrada')}>Entrada</button>
                  <button type="button" className={`px-3 py-1 rounded border text-sm ${stockType==='saida' ? 'bg-red-50 border-red-300 text-red-700' : ''}`} onClick={()=>setStockType('saida')}>Saida</button>
                </div>
              </div>
              <div className="text-sm text-gray-800">
                {stockTargetProduct?.name} {Array.isArray(stockTargetProduct?.variationsData) && (stockTargetProduct?.variationsData?.length || 0) > 0 ? ` - ${(stockTargetProduct?.variationsData?.[0]?.name || stockTargetProduct?.variationsData?.[0]?.label || '')}` : ''}
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Quantidade</div>
                <input type="number" value={stockQty} onChange={e=>setStockQty(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="text-sm text-gray-700">
                {(() => {
                  const hasVars = Array.isArray(stockTargetProduct?.variationsData) && (stockTargetProduct?.variationsData?.length||0) > 0
                  const base = hasVars ? Number(stockTargetProduct?.variationsData?.[0]?.stock ?? 0) : Number(stockTargetProduct?.stock ?? 0)
                  const qty = Math.max(0, parseInt(String(stockQty), 10) || 0)
                  const sign = stockType==='entrada' ? '+' : '-'
                  const total = Math.max(0, base + (stockType==='entrada' ? qty : -qty))
                  return `Estoque: ${base} ${sign} ${qty} = ${total}`
                })()}
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Descrição (opcional)</div>
                <input value={stockDesc} onChange={e=>setStockDesc(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button className="px-3 py-2 text-sm rounded border" onClick={()=>setStockModalOpen(false)} disabled={savingAction}>Cancelar</button>
              <button className="px-3 py-2 text-sm rounded bg-green-600 text-white" onClick={confirmStockAdjust} disabled={savingAction}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
      {reservedOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setReservedOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-lg w-[95vw] max-w-[640px]">
            <div className="px-4 py-3 border-b">
              <h3 className="text-base font-medium">Reservados</h3>
            </div>
            <div className="p-4">
              {(() => {
                const baseId = String(reservedProduct?.id || '')
                const list = (allOrders || []).filter(o => {
                  const type = String(o.type || '').toLowerCase()
                  const st = String(o.status || '').toLowerCase().trim()

                  // Regra 1: Vendas (PV) somente com status 'pedido'
                  // Vendas geralmente têm type='sale'
                  // Se não tiver type, assumimos venda se status for 'pedido', 'pago', etc.
                  const isSaleType = type === 'sale'
                  const isSaleStatus = ['pedido', 'venda', 'pago', 'finalizado'].includes(st)
                  
                  // Consideramos Venda se for type='sale' OU (sem type e status de venda)
                  // Mas a regra específica do usuário é mostrar APENAS status 'pedido' para vendas
                  const isSaleCandidate = isSaleType || (!type && isSaleStatus)
                  
                  // Aplicando o filtro específico: Venda deve ser 'pedido'
                  const showSale = isSaleCandidate && st === 'pedido'
                  
                  // Regra 2: Ordens de Serviço (OS) somente com status 'Iniciado'
                  // OS geralmente têm type='service_order' ou type='os'
                  // Se não tiver type, assumimos OS se status NÃO for de venda e não for 'sale'
                  const isOSType = type === 'os' || type === 'service_order'
                  const isOSStatus = !isSaleStatus // Se não é status de venda, provável OS (ex: iniciado, aguardando, etc)
                  
                  const isOSCandidate = isOSType || (!type && isOSStatus)
                  
                  // Aplicando o filtro específico: OS deve ser 'Iniciado'
                  const showOS = isOSCandidate && st === 'iniciado'

                  // Se não atender a nenhum dos critérios de exibição, ignora
                  if (!showSale && !showOS) return false

                  const prods = Array.isArray(o.products) ? o.products : []
                  return prods.some(op => {
                    const opId = String(op.id || op.productId || '')
                    return opId === baseId || opId.startsWith(baseId + '-')
                  })
                })
                
                return (
                  <div className="space-y-2">
                    {list.map(o => {
                      const qty = (Array.isArray(o.products) ? o.products : []).filter(op => {
                        const opId = String(op.id || op.productId || '')
                        return opId === baseId || opId.startsWith(baseId + '-')
                      }).reduce((s, op) => s + (Number(op.quantity || 0)), 0)
                      
                      const d = o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000) : (o.createdAt ? new Date(o.createdAt) : null)
                      const ds = d ? d.toLocaleDateString('pt-BR') : '-'
                      
                      const digits = String(o.number || '').replace(/\D/g, '')
                      const n = parseInt(digits, 10)
                      const ref = isNaN(n) ? String(o.id).slice(-4) : String(n).padStart(4, '0')
                      
                      // Define label
                      // Recalcula se é OS para definir o label correto
                      const type = String(o.type || '').toLowerCase()
                      const st = String(o.status || '').toLowerCase().trim()
                      const isSaleStatus = ['pedido', 'venda', 'pago', 'finalizado'].includes(st)
                      const isOSCandidate = (type === 'os' || type === 'service_order') || (!type && !isSaleStatus)
                      
                      const label = isOSCandidate ? `O.S:${ref}` : `PV:${ref}`

                      return (
                        <div key={o.id} className="grid grid-cols-[6rem_1fr_6rem] items-center gap-3 text-sm border-b last:border-0 px-2 py-2">
                          <div>{label}</div>
                          <div className="leading-tight">
                            <div className="font-medium">{o.client || 'Consumidor Final'}</div>
                            <div className="text-xs text-gray-500">{ds} • {o.status || (isOSCandidate ? 'Iniciado' : 'Pedido')}</div>
                          </div>
                          <div className="text-right">{qty}</div>
                        </div>
                      )
                    })}
                    {list.length === 0 && <div className="text-sm text-gray-600">Nenhum pedido ou ordem de serviço encontrado reservando este item.</div>}
                  </div>
                )
              })()}
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-end">
              <button type="button" className="px-3 py-2 border rounded text-sm" onClick={()=>setReservedOpen(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
      {bulkModalOpen && bulkCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setBulkModalOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-lg w-[95vw] max-w-[520px]">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div>
                <h3 className="text-base font-medium">Precificação em massa</h3>
                <div className="text-xs text-gray-500 mt-0.5">
                  Categoria: {bulkCategory.name}
                </div>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">Tipo:</span>
                <div className="inline-flex rounded border overflow-hidden">
                  <button
                    type="button"
                    className={`px-3 py-1 text-sm ${bulkType === 'add' ? 'bg-green-50 text-green-700' : 'bg-white text-gray-700'}`}
                    onClick={()=>setBulkType('add')}
                  >
                    Adicionar
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 text-sm border-l ${bulkType === 'remove' ? 'bg-red-50 text-red-700' : 'bg-white text-gray-700'}`}
                    onClick={()=>setBulkType('remove')}
                  >
                    Remover
                  </button>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Ajuste R$</div>
                <input
                  type="text"
                  value={bulkAmount}
                  onChange={e=>setBulkAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Ajuste (%)</div>
                <input
                  type="number"
                  value={bulkPercent}
                  onChange={e=>setBulkPercent(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
                <div className="flex items-center gap-2 mt-2">
                  {[5,10,15,20].map(v => (
                    <button
                      key={v}
                      type="button"
                      className="flex-1 border rounded px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                      onClick={()=>setBulkPercent(String(v))}
                    >
                      {v}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 text-sm rounded border"
                onClick={()=>setBulkModalOpen(false)}
                disabled={bulkSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-3 py-2 text-sm rounded bg-green-600 text-white"
                onClick={confirmBulkPricing}
                disabled={bulkSaving}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      {bulkReviewOpen && bulkCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setBulkReviewOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-lg w-[95vw] max-w-[900px]">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div>
                <h3 className="text-base font-medium">Aplicar ajuste em massa</h3>
                <div className="text-xs text-gray-500 mt-0.5">
                  Categoria: {bulkCategory.name} • {bulkCandidates.length} produtos encontrados
                </div>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-green-600"
                      checked={
                        bulkFilteredCandidates.length > 0 &&
                        bulkFilteredCandidates.every(p => bulkSelectedIds.has(p.id))
                      }
                      onChange={(e) => {
                        const checked = e.target.checked
                        if (!checked) {
                          setBulkSelectedIds(new Set())
                        } else {
                          const next = new Set(bulkSelectedIds)
                          bulkFilteredCandidates.forEach(p => next.add(p.id))
                          setBulkSelectedIds(next)
                        }
                      }}
                    />
                    <span>Selecionar todos os listados</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Buscar:</span>
                    <input
                      value={bulkReviewQuery}
                      onChange={e => setBulkReviewQuery(e.target.value)}
                      placeholder="Nome ou código"
                      className="border rounded px-2 py-1 text-xs w-48"
                    />
                  </div>
                </div>
                <div className="max-h-80 overflow-auto border rounded bg-gray-50/60">
                  {bulkCandidates.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-600">
                      Nenhum produto encontrado nesta categoria.
                    </div>
                  )}
                  {bulkCandidates.length > 0 && bulkFilteredCandidates.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-600">
                      Nenhum produto encontrado para a busca.
                    </div>
                  )}
                  {bulkFilteredCandidates.map(p => (
                    <label
                      key={p.id}
                      className={`flex items-start gap-3 px-4 py-3 border-b last:border-0 text-sm bg-white transition-colors ${
                        bulkSelectedIds.has(p.id) ? 'bg-green-50/60' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 text-green-600 rounded border-gray-300"
                        checked={bulkSelectedIds.has(p.id)}
                        onChange={() => {
                          const next = new Set(bulkSelectedIds)
                          if (next.has(p.id)) next.delete(p.id); else next.add(p.id)
                          setBulkSelectedIds(next)
                        }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium truncate">{p.name}</div>
                            <div className="text-xs text-gray-500">
                              {p.reference || ''}
                            </div>
                          </div>
                          {Array.isArray(p.variationsData) && p.variationsData.length > 0 && (
                            <div className="flex items-center gap-1">
                              {p.variationsData
                                .slice(0, Math.min(p.variationsData.length, bulkSelectedSlots.length))
                                .map((_, idx) => {
                                const slotActiveGlobal =
                                  bulkMaxSlots > 0 &&
                                  idx < bulkMaxSlots &&
                                  idx < bulkSelectedSlots.length &&
                                  bulkSelectedSlots[idx]
                                const active = bulkSelectedIds.has(p.id) && slotActiveGlobal
                                return (
                                  <span
                                    key={idx}
                                    className={`h-6 w-6 inline-flex items-center justify-center rounded-full border text-xs font-semibold ${
                                      active
                                        ? 'bg-green-600 border-green-600 text-white'
                                        : 'bg-white border-gray-300 text-gray-700'
                                    }`}
                                  >
                                    {idx+1}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Quais precificações ajustar</div>
                {bulkMaxSlots === 0 ? (
                  <div className="text-xs text-gray-500">
                    Os produtos selecionados não possuem precificações cadastradas.
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: bulkMaxSlots }).map((_, idx) => {
                        const active = idx < bulkSelectedSlots.length ? bulkSelectedSlots[idx] : false
                        return (
                          <button
                            key={idx}
                            type="button"
                            className={`px-4 py-2 rounded-lg border text-xs font-medium min-w-[44px] ${
                              active
                                ? 'bg-green-600 border-green-600 text-white'
                                : 'bg-white border-gray-300 text-gray-700'
                            }`}
                            onClick={() => {
                              setBulkSelectedSlots(prev => prev.map((v, i) => i === idx ? !v : v))
                            }}
                          >
                            {idx+1}
                          </button>
                        )
                      })}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      Se nenhuma precificação for marcada, apenas o preço principal será ajustado.
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 text-sm rounded border"
                onClick={()=>setBulkReviewOpen(false)}
                disabled={bulkSaving}
              >
                Voltar
              </button>
              <button
                type="button"
                className="px-3 py-2 text-sm rounded bg-green-600 text-white"
                onClick={applyBulkPricing}
                disabled={bulkSaving || !bulkSelectedIds || bulkSelectedIds.size === 0}
              >
                Aplicar ajuste
              </button>
            </div>
          </div>
        </div>
      )}
      <ProductsFilterModal 
        open={showFilters} 
        onClose={()=>setShowFilters(false)} 
        onFilter={(filters) => { setActiveFilters(filters); }}
        categories={categories}
        suppliers={suppliers}
        initialFilters={activeFilters}
      />
    </div>
  )
}
