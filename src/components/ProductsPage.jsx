import React, { useMemo, useState, useEffect, useRef } from 'react'
import { getProductsByPage, searchProductsByPage, getTotalProductsCount, updateProduct, addProduct, removeProduct, getAllProducts } from '../services/products'
import NewProductModal, { ensureSupplierInStore } from './NewProductModal'
import { listenCategories, updateCategory, addCategory, removeCategory } from '../services/categories'
import NewCategoryModal from './NewCategoryModal'
import { listenSuppliers, updateSupplier, addSupplier, removeSupplier } from '../services/suppliers'
import NewSupplierModal from './NewSupplierModal'
import ProductsFilterModal from './ProductsFilterModal'
import ProductLabelsPage from './ProductLabelsPage'
import { listenOrders } from '../services/orders'
import { recordStockMovement } from '../services/stockMovements'
import StockMovementsModal from './StockMovementsModal'
import { getStoreById, listStoresByOwner } from '../services/stores'
import { collection, query as firestoreQuery, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

export default function ProductsPage({ storeId, addNewSignal, user }){
  const isOwner = !user?.memberId
  const perms = user?.permissions || {}

  const tabs = useMemo(() => {
    const t = [
      { key: 'produto', label: 'Produto' },
      { key: 'categorias', label: 'Categorias' },
      { key: 'movestoque', label: 'Movimento De Estoque' },
      { key: 'fornecedores', label: 'Fornecedores' },
      { key: 'compras', label: 'Compras' },
    ]
    if (isOwner) return t
    return t.filter(item => {
      if (item.key === 'categorias') return true
      if (item.key === 'movestoque') return perms.products?.edit || perms.products?.create
      if (item.key === 'fornecedores') return perms.suppliers?.view
      if (item.key === 'compras') return perms.purchases?.view
      return true
    })
  }, [isOwner, perms])

  const [tab, setTab] = useState('produto')
  const [products, setProducts] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('sistemix_view_mode') || 'list'
    return 'list'
  })

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('sistemix_view_mode', viewMode)
  }, [viewMode])

  // Pagination & Smart Cache
  const PAGE_SIZE = 30
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [totalResults, setTotalResults] = useState(0)
  const [cachedProducts, setCachedProducts] = useState(null)
  const [isCaching, setIsCaching] = useState(false)

  const [showFilters, setShowFilters] = useState(false)
  const [activeFilters, setActiveFilters] = useState({})
  const [modalOpen, setModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [syncingProduct, setSyncingProduct] = useState(null)
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
  const [showPermissionModal, setShowPermissionModal] = useState(false)
  const [reservedOpen, setReservedOpen] = useState(false)
  const [reservedProduct, setReservedProduct] = useState(null)
  
  // Estado para feedback de sincronização (substitui alerts)
  const [syncFeedback, setSyncFeedback] = useState({ 
    open: false, 
    loading: false, 
    logs: [], 
    finished: false,
    successCount: 0 
  })

  // Modal de Confirmação de Match
  const [syncConfirm, setSyncConfirm] = useState({
    open: false,
    source: null,
    target: null,
    targetCategoryName: '',
    storeName: '',
    resolver: null
  })

  const requestSyncConfirmation = (source, target, targetCategoryName, storeName) => {
    return new Promise((resolve) => {
      setSyncConfirm({
        open: true,
        source,
        target,
        targetCategoryName,
        storeName,
        resolver: resolve
      })
    })
  }

  const handleConfirmSync = (result) => {
    if (syncConfirm.resolver) {
      syncConfirm.resolver(result)
    }
    setSyncConfirm(prev => ({ ...prev, open: false, resolver: null }))
  }

  const [gridCols, setGridCols] = useState(null)
  const [showExtras, setShowExtras] = useState(true)

  useEffect(() => {
    function handleResize() {
      const w = window.innerWidth
      if (w < 768) {
        setGridCols(null) // mobile default via class
        setShowExtras(false)
      } else {
        // Desktop/Tablet - Show all 8 requested columns + checkbox/actions
        // Checkbox | Produto | Código | Atualizado | Hora | Funcionário | Preço | Estoque | Status | Actions
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
  const [confirmRemoveCategoryOpen, setConfirmRemoveCategoryOpen] = useState(false)
  const [categoryToRemove, setCategoryToRemove] = useState(null)

  // Fornecedores
  const [suppliers, setSuppliers] = useState([])
  const [supplierModalOpen, setSupplierModalOpen] = useState(false)
  const [supplierEditOpen, setSupplierEditOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [supSelected, setSupSelected] = useState(() => new Set())
  const [supplierMenuId, setSupplierMenuId] = useState(null)
  const [confirmRemoveSupplierOpen, setConfirmRemoveSupplierOpen] = useState(false)
  const [supplierToRemove, setSupplierToRemove] = useState(null)
  
  // Sincronização
  const [syncProducts, setSyncProducts] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sistemix_sync_products') === 'true'
    }
    return false
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sistemix_sync_products', String(syncProducts))
    }
  }, [syncProducts])

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
    // Categories and Suppliers (Listeners)
    const unsubCat = listenCategories(items => setCategories(items), storeId)
    const unsubSup = listenSuppliers(items => setSuppliers(items), storeId)
    return () => {
      unsubCat && unsubCat()
      unsubSup && unsubSup()
    }
  }, [storeId])

  // Products Pagination Logic
  // Efeito para Smart Cache (igual ao de clientes)
  // (Sem cache global; carregamento ocorre somente dentro da página)

  useEffect(() => {
    if (!storeId) return
    
    // Reset cache on store change
    setCachedProducts(null)
    setIsCaching(false)

    // Atualiza o total inicial baseado no que o servidor diz
    getTotalProductsCount(storeId).then(count => {
      if (!query.trim()) {
        setTotalResults(count)
      }
    }).catch(console.error)
  }, [storeId])

  useEffect(() => {
    if (!storeId) return

    // Se não tiver cache, inicia o download em segundo plano
    if (!cachedProducts && !isCaching) {
        setIsCaching(true)
        console.log('Iniciando Smart Cache de produtos...')
        getAllProducts(storeId).then(all => {
            console.log(`Smart Cache concluído: ${all.length} produtos baixados.`)
            setCachedProducts(all)
            // Se não estiver pesquisando, o total é o tamanho do cache
            if (!query.trim()) {
                setTotalResults(all.length)
            } else {
                // Se já estiver pesquisando, o useMemo 'filtered' vai cuidar do total via useEffect de sincronização
            }
            setIsCaching(false)
        }).catch(err => {
            console.error('Erro no Smart Cache:', err)
            // Se falhar o cache, garante que o isCaching volte a false para tentar novamente se necessário
            setIsCaching(false)
        })
    }
  }, [storeId, cachedProducts, isCaching, query])

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      // Se tiver cache, a busca e paginação são locais via useMemo 'filtered' e 'paginatedResults'
      // Portanto, não precisamos fazer nada aqui se houver cache.
      if (cachedProducts) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        if (query.trim()) {
           // Busca inicial enquanto o cache não carrega (legado/fallback)
           const { products: newProducts, total } = await searchProductsByPage(storeId, query, page, PAGE_SIZE)
           if(isMounted) {
             setProducts(newProducts)
             setTotalResults(total)
           }
        } else {
           // Carregamento normal por página (sem busca e sem cache ainda)
           const newProducts = await getProductsByPage(storeId, page, PAGE_SIZE)
           if(isMounted) {
             setProducts(newProducts)
             // O total vem do servidor
             getTotalProductsCount(storeId).then(c => isMounted && setTotalResults(c))
           }
        }
      } catch (err) {
        console.error(err)
      } finally {
        if(isMounted) setLoading(false)
      }
    }

    const delay = query.trim() ? 300 : 0
    const timeoutId = setTimeout(() => {
        load()
    }, delay)

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [storeId, page, query, cachedProducts])

  // Reset page on query or filter change
  useEffect(() => {
     setPage(1)
  }, [storeId, query, activeFilters])

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

  // Lógica de filtragem (usando cache se disponível)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    
    // Se temos cache, filtramos sobre TUDO (Busca Global)
    if (cachedProducts) {
      return cachedProducts.filter(p => {
        const nameMatch = (p.name || '').toLowerCase().includes(q)
        const refMatch = (p.reference || '').toLowerCase().includes(q)
        const barcodeMatch = (p.barcode || '').toLowerCase().includes(q)
        const nameLowerMatch = (p.nameLower || '').includes(q)
        
        // Filtros adicionais
        const categoryMatch = !activeFilters.categoryId || p.categoryId === activeFilters.categoryId
        const supplierMatch = !activeFilters.supplier || p.supplier === activeFilters.supplier
        const originMatch = !activeFilters.origin || String(p.origin) === String(activeFilters.origin)
        const ncmMatch = !activeFilters.ncm || (p.ncm || '').includes(activeFilters.ncm)
        const cestMatch = !activeFilters.cest || (p.cest || '').includes(activeFilters.cest)
        
        // Validade
        let validityMatch = true
        if (activeFilters.validityStart && (!p.validityDate || p.validityDate < activeFilters.validityStart)) validityMatch = false
        if (activeFilters.validityEnd && (!p.validityDate || p.validityDate > activeFilters.validityEnd)) validityMatch = false
        
        // Estoque
        let stockMatch = true
        if (activeFilters.lowStock) {
          const s = Number(p.stock || 0)
          const m = Number(p.stockMin || 0)
          stockMatch = s <= m
        }
        if (activeFilters.noStock) {
          stockMatch = Number(p.stock || 0) === 0
        }

        const matchesSearch = nameMatch || refMatch || barcodeMatch || nameLowerMatch
        const matchesFilters = categoryMatch && supplierMatch && originMatch && ncmMatch && cestMatch && validityMatch && stockMatch
        
        // Status filter
        let statusMatch = true
        const fActive = activeFilters.filterActive ?? true
        const fInactive = activeFilters.filterInactive ?? false
        
        if (fActive && !fInactive) statusMatch = (p.active !== false)
        else if (!fActive && fInactive) statusMatch = (p.active === false)
        else if (!fActive && !fInactive) statusMatch = false

        return (q ? matchesSearch : true) && matchesFilters && statusMatch
      })
    }

    // Caso contrário, retorna os produtos carregados do servidor (que já vêm filtrados se houver busca)
    return products
  }, [products, query, activeFilters, cachedProducts])

  // Paginação inteligente
  const paginatedResults = useMemo(() => {
    // Se temos cache, a filtragem é global, então precisamos paginar o array 'filtered' localmente
    if (cachedProducts) {
        const start = (page - 1) * PAGE_SIZE
        return filtered.slice(start, start + PAGE_SIZE)
    }
    // Se não temos cache, os 'products' (e portanto 'filtered') já representam a página correta vinda do servidor
    return filtered
  }, [filtered, page, cachedProducts])

  // Sincronização do total de resultados para o componente de Paginação
  useEffect(() => {
    if (cachedProducts) {
        // Se estamos usando cache, o total é o tamanho do array filtrado globalmente
        setTotalResults(filtered.length)
    }
  }, [filtered.length, cachedProducts])

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

  const openConfirmRemoveCategory = (category) => {
    setCategoryToRemove(category)
    setConfirmRemoveCategoryOpen(true)
    setCategoryMenuId(null)
  }

  const openConfirmRemoveSupplier = (supplier) => {
    if (!isOwner && !perms.suppliers?.delete) return
    setSupplierToRemove(supplier)
    setConfirmRemoveSupplierOpen(true)
    setSupplierMenuId(null)
  }

  const handleRemoveCategory = async () => {
    if(!isOwner && !perms.categories?.delete) return
    if (!categoryToRemove) return
    try {
      setSavingAction(true)
      await removeCategory(categoryToRemove.id)
      setConfirmRemoveCategoryOpen(false)
      setCategoryToRemove(null)
    } finally {
      setSavingAction(false)
    }
  }

  const handleRemoveSupplier = async () => {
    if (!isOwner && !perms.suppliers?.delete) return
    if (!supplierToRemove) return
    try {
      setSavingAction(true)
      await removeSupplier(supplierToRemove.id)
      setConfirmRemoveSupplierOpen(false)
      setSupplierToRemove(null)
    } finally {
      setSavingAction(false)
    }
  }

  const addNew = () => {
    if(tab === 'categorias'){
      if(!isOwner && !perms.categories?.create) return setShowPermissionModal(true)
      setCatModalOpen(true)
    } else if (tab === 'fornecedores'){
      if(!isOwner && !perms.suppliers?.create) return setShowPermissionModal(true)
      setSupplierModalOpen(true)
    } else {
      if(!isOwner && !perms.products?.create) return setShowPermissionModal(true)
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

  const startEdit = async (product) => {
    if(!isOwner && !perms.products?.edit) return
    try {
      // Busca detalhes completos sob demanda
      const mod = await (async ()=>{
        const m = await import('../services/products')
        return m
      })()
      const full = await mod.getProductById(product.id)
      setEditingProduct(full || product)
    } catch {
      setEditingProduct(product)
    }
    setEditModalOpen(true)
  }

  const handleClone = async (product) => {
    if(!isOwner && !perms.products?.create) return
    if (!storeId) return
    try {
      setSavingAction(true)
      const { id, createdAt, updatedAt, number, rootId, ...rest } = product || {}
      
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
    if(!isOwner && !perms.products?.edit) return
    try {
      setSavingAction(true)
      const next = !(product.active ?? true)
      const updateResult = await updateProduct(product.id, { active: next })
      
      // Atualiza o cache se disponível
      if (cachedProducts) {
        setCachedProducts(prev => prev.map(p => 
          p.id === product.id ? { ...p, active: next, updatedAt: updateResult.updatedAt } : p
        ))
      }

      setOpenMenuId(null)
    } finally {
      setSavingAction(false)
    }
  }

  const handleProductSave = (productData) => {
    if (!productData || !productData.id) return

    if (cachedProducts) {
      setCachedProducts(prev => {
        const index = prev.findIndex(p => p.id === productData.id)
        if (index !== -1) {
          // Edit: update existing product in cache
          const next = [...prev]
          next[index] = { ...next[index], ...productData }
          return next
        } else {
          // Create: add new product to cache
          setTotalResults(prev => prev + 1)
          return [productData, ...prev]
        }
      })
    }
    
    // Se não estiver usando cache (ainda carregando), o useEffect de load() cuidará disso
    // ou o usuário verá ao mudar de página/pesquisa.
    
    // Fecha os modais
    setModalOpen(false)
    setEditModalOpen(false)
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
    if (!isOwner && !perms.products?.delete) return
    setConfirmRemoveProduct(product)
    setConfirmRemoveOpen(true)
    setOpenMenuId(null)
  }

  const confirmRemoveFromCatalog = async () => {
    if (!isOwner && !perms.products?.delete) return
    const p = confirmRemoveProduct
    if (!p) return setConfirmRemoveOpen(false)
    try {
      setSavingAction(true)
      await removeProduct(p.id)
      
      // Atualiza o cache se disponível
      if (cachedProducts) {
        setCachedProducts(prev => prev.filter(item => item.id !== p.id))
        setTotalResults(prev => Math.max(0, prev - 1))
      }

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
    const varIndex = hasVars ? selectedVarIdx : -1
    try {
      setSavingAction(true)
      let updateData = {}
      if (hasVars && varIndex >= 0) {
        const items = p.variationsData.map((v) => ({ ...v }))
        const cur = Number(items[varIndex]?.stock ?? 0)
        items[varIndex].stock = Math.max(0, cur + delta)
        const total = items.reduce((s, v) => s + (Number(v.stock ?? 0)), 0)
        updateData = { variationsData: items, stock: total }
        await updateProduct(p.id, updateData)
        
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
        updateData = { stock: next }
        await updateProduct(p.id, updateData)
        
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

      // Atualiza o cache se disponível
      if (cachedProducts) {
        setCachedProducts(prev => prev.map(item => 
          item.id === p.id ? { ...item, ...updateData, updatedAt: new Date() } : item
        ))
      }

      setStockModalOpen(false)
    } finally {
      setSavingAction(false)
    }
  }

  const handleSyncProduct = async (product) => {
    if(!isOwner && !perms.products?.create) return
    if (!product || !storeId || syncingProduct) return
    
    // Iniciar modal de feedback
    setSyncFeedback({
      open: true,
      loading: true,
      logs: [`Iniciando sincronização para: ${product.name}...`],
      finished: false,
      successCount: 0
    })
    setSyncingProduct(product.id)

    const addLog = (msg) => {
        setSyncFeedback(prev => ({ ...prev, logs: [...prev.logs, msg] }))
    }

    try {
        // Garantir que o produto tenha um rootId para sincronização robusta
        let activeRootId = product.rootId
        if (!activeRootId) {
             activeRootId = crypto.randomUUID()
             await updateProduct(product.id, { rootId: activeRootId })
             addLog("Gerado ID único de sincronização.")
        }

        const currentStore = await getStoreById(storeId)
        if (!currentStore || !currentStore.ownerId) {
            addLog('Erro: Loja atual ou proprietário não identificados.')
            setSyncFeedback(prev => ({ ...prev, loading: false, finished: true }))
            return
        }

        addLog(`Buscando lojas do proprietário...`)
        const allStores = await listStoresByOwner(currentStore.ownerId)
        const otherStores = allStores.filter(s => s.id !== storeId)
        
        if (otherStores.length === 0) {
            addLog('Nenhuma outra loja encontrada para sincronizar.')
            setSyncFeedback(prev => ({ ...prev, loading: false, finished: true }))
            return
        }

        addLog(`Encontradas ${otherStores.length} outras lojas.`)

        // Dados de Categoria e Fornecedor da origem
        const sourceCategory = categories.find(c => c.id === product.categoryId)
        
        // Preparar Fornecedor
        const supplierName = product.supplier || ''
        let sourceSupplierFull = null
        if (supplierName) {
             const cleanSupplier = supplierName.trim()
             sourceSupplierFull = suppliers.find(s => s.name === cleanSupplier)
             if (!sourceSupplierFull) {
                 sourceSupplierFull = suppliers.find(s => s.name.toLowerCase() === cleanSupplier.toLowerCase())
             }
             // Busca no banco se não achar no state
             if (!sourceSupplierFull) {
                try {
                  const supCol = collection(db, 'suppliers')
                  const sourceSupQuery = firestoreQuery(supCol, where('storeId', '==', storeId), where('name', '==', cleanSupplier))
                  const sourceSupSnap = await getDocs(sourceSupQuery)
                  if (!sourceSupSnap.empty) {
                     sourceSupplierFull = sourceSupSnap.docs[0].data()
                  }
                } catch (e) {
                  addLog(`Aviso: Erro ao buscar dados completos do fornecedor: ${e.message}`)
                }
             }
             if (!sourceSupplierFull) {
                 sourceSupplierFull = { name: cleanSupplier }
             }
        }

        let syncCount = 0

        for (const store of otherStores) {
            try {
                addLog(`--------------------------------`)
                addLog(`Processando loja: ${store.name || store.id}...`)

                // 1. Sincronizar Categoria
                let targetCategoryId = null
                if (sourceCategory) {
                    const catCol = collection(db, 'categories')
                    const catQuery = firestoreQuery(catCol, where('storeId', '==', store.id), where('name', '==', sourceCategory.name))
                    const catSnap = await getDocs(catQuery)
                    if (!catSnap.empty) {
                        targetCategoryId = catSnap.docs[0].id
                        // addLog(`Categoria "${sourceCategory.name}" já existe.`)
                    } else {
                        targetCategoryId = await addCategory({ name: sourceCategory.name, active: true }, store.id)
                        addLog(`Categoria "${sourceCategory.name}" criada.`)
                    }
                }

                // 2. Sincronizar Fornecedor
                if (sourceSupplierFull) {
                    await ensureSupplierInStore(sourceSupplierFull, store.id)
                    // addLog(`Fornecedor verificado/criado.`)
                }

                // 3. Sincronizar Produto
                const prodCol = collection(db, 'products')
                let targetProduct = null

                // 1. Tentar buscar por rootId (Identificador único global)
                if (activeRootId) {
                    addLog(`Buscando por ID global...`)
                    const qRoot = firestoreQuery(prodCol, where('storeId', '==', store.id), where('rootId', '==', activeRootId))
                    const snapRoot = await getDocs(qRoot)
                    if (!snapRoot.empty) {
                        targetProduct = { id: snapRoot.docs[0].id, ...snapRoot.docs[0].data() }
                        addLog(`Produto encontrado pelo ID global.`)
                    }
                }

                // 2. Fallback: Se não achou por rootId, tenta por Código ou Nome
                if (!targetProduct) {
                    // Por Código
                    if (product.reference && product.reference.trim()) {
                        const refToSearch = product.reference.trim()
                        addLog(`Buscando por código (fallback): "${refToSearch}"`)
                        const qRef = firestoreQuery(prodCol, where('storeId', '==', store.id), where('reference', '==', refToSearch))
                        const snapRef = await getDocs(qRef)
                        if (!snapRef.empty) {
                            targetProduct = { id: snapRef.docs[0].id, ...snapRef.docs[0].data() }
                            addLog(`Produto encontrado pelo código.`)
                        }
                    }

                    // Por Nome
                    if (!targetProduct && product.name) {
                         addLog(`Buscando por nome (fallback): "${product.name}"`)
                         const qName = firestoreQuery(prodCol, where('storeId', '==', store.id), where('name', '==', product.name))
                         const snapName = await getDocs(qName)
                         if (!snapName.empty) {
                             targetProduct = { id: snapName.docs[0].id, ...snapName.docs[0].data() }
                             addLog(`Produto encontrado pelo nome.`)
                         }
                    }
                }

                // Prepara dados para salvar
                const dataToSync = { ...product, rootId: activeRootId }
                // Remove campos de sistema/origem
                delete dataToSync.id
                delete dataToSync.storeId
                delete dataToSync.createdAt
                delete dataToSync.updatedAt
                delete dataToSync.lastEditedBy // Será sobrescrito
                
                dataToSync.storeId = store.id
                dataToSync.categoryId = targetCategoryId
                dataToSync.lastEditedBy = user?.name || 'Sincronização Manual'

                if (targetProduct) {
                    // Busca nome da categoria do destino para exibir
                    let targetCatName = 'Sem Categoria'
                    if (targetProduct.categoryId) {
                         try {
                             const catDocRef = doc(db, 'categories', targetProduct.categoryId)
                             const catDocSnap = await getDoc(catDocRef)
                             if (catDocSnap.exists()) {
                                 targetCatName = catDocSnap.data().name
                             }
                         } catch (e) {
                             // Ignora erro
                         }
                    }

                    // Solicita confirmação
                    const confirmed = await requestSyncConfirmation(product, targetProduct, targetCatName, store.name)
                    if (!confirmed) {
                        addLog(`Item ignorado pelo usuário.`)
                        continue
                    }

                    // UPDATE - O produto JÁ EXISTE na outra loja
                    // IMPORTANTE: Preservar o estoque que está LÁ na outra loja
                    dataToSync.stock = targetProduct.stock
                    dataToSync.stockInitial = targetProduct.stockInitial
                    dataToSync.createdBy = targetProduct.createdBy // Mantém quem criou lá
                    
                    // IMPORTANTE: Preservar o CÓDIGO (Reference) que está LÁ na outra loja
                    // O usuário solicitou que o código não seja alterado na sincronização
                    if (targetProduct.reference) {
                        dataToSync.reference = targetProduct.reference
                    }
                    
                    // Variações: tentar preservar o estoque de cada variação existente lá
                    if (dataToSync.variationsData && dataToSync.variationsData.length > 0) {
                         dataToSync.variationsData = dataToSync.variationsData.map(v => {
                           // Tenta achar a variação correspondente no produto destino antigo
                           const oldVar = (targetProduct.variationsData || []).find(ov => ov.name === v.name)
                           if (oldVar) {
                             // Mantém estoque da variação antiga
                             return { ...v, stock: oldVar.stock, stockInitial: oldVar.stockInitial }
                           }
                           // Variação nova = estoque 0
                           return { ...v, stock: 0, stockInitial: 0 }
                         })
                         // Recalcula total
                         dataToSync.stock = dataToSync.variationsData.reduce((acc, curr) => acc + (Number(curr.stock)||0), 0)
                    } else {
                         // Se não tem variações, garante que stock é o do destino
                         dataToSync.stock = targetProduct.stock
                    }

                    await updateProduct(targetProduct.id, dataToSync)
                    addLog(`Produto ATUALIZADO com sucesso.`)
                } else {
                    // CREATE - Produto NÃO EXISTE na outra loja
                    // Nasce com estoque ZERO
                    dataToSync.stock = 0
                    dataToSync.stockInitial = 0
                    dataToSync.createdBy = user?.name || 'Sincronização Manual'
                    
                    if (dataToSync.variationsData && dataToSync.variationsData.length > 0) {
                        dataToSync.variationsData = dataToSync.variationsData.map(v => ({
                            ...v, stock: 0, stockInitial: 0
                        }))
                    }
                    
                    await addProduct(dataToSync, store.id)
                    addLog(`Produto CRIADO com sucesso.`)
                }
                syncCount++

            } catch (errStore) {
                console.error(`Erro na loja ${store.id}:`, errStore)
                addLog(`ERRO na loja ${store.name}: ${errStore.message}`)
            }
        }
        
        setSyncFeedback(prev => ({ ...prev, successCount: syncCount, finished: true, loading: false }))

    } catch (err) {
        console.error('Erro na sincronização manual:', err)
        addLog(`Erro fatal: ${err.message}`)
        setSyncFeedback(prev => ({ ...prev, finished: true, loading: false }))
    } finally {
        setSyncingProduct(null)
        setOpenMenuId(null)
    }
  }

  const startCategoryEdit = (category) => {
    if(!isOwner && !perms.categories?.edit) return
    setEditingCategory(category)
    setCatEditOpen(true)
  }

  const startSupplierEdit = (supplier) => {
    if(!isOwner && !perms.suppliers?.edit) return
    setEditingSupplier(supplier)
    setSupplierEditOpen(true)
  }

  const openBulkPricing = (category) => {
    if(!isOwner && !perms.categories?.bulkPricing) return
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
        // Registrar responsável e momento da precificação em massa
        payload.lastEditedBy = (user && (user.name || user.email || user.id)) || 'Sistema'
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

  const Pagination = () => {
    const totalPages = Math.ceil(totalResults / PAGE_SIZE) || 1
    if (totalPages <= 1) return null

    const renderPageNumbers = () => {
        const pages = []
        
        // Sempre mostra página 1
        pages.push(
            <button
                key={1}
                onClick={() => setPage(1)}
                className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                    page === 1 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
                1
            </button>
        )

        // Lógica para intervalo intermediário
        let start = Math.max(2, page - 1)
        let end = Math.min(totalPages - 1, page + 1)
        
        // Ajuste para mostrar mais se estiver perto do início ou fim
        if (page <= 3) {
            end = Math.min(totalPages - 1, 4)
        }
        if (page >= totalPages - 2) {
            start = Math.max(2, totalPages - 3)
        }

        if (start > 2) {
            pages.push(<span key="dots1" className="text-gray-400 px-1">...</span>)
        }

        for (let i = start; i <= end; i++) {
            pages.push(
                <button
                    key={i}
                    onClick={() => setPage(i)}
                    className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                        page === i 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                >
                    {i}
                </button>
            )
        }

        if (end < totalPages - 1) {
            pages.push(<span key="dots2" className="text-gray-400 px-1">...</span>)
        }

        // Sempre mostra última página se > 1
        if (totalPages > 1) {
            pages.push(
                <button
                    key={totalPages}
                    onClick={() => setPage(totalPages)}
                    className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                        page === totalPages 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                >
                    {totalPages}
                </button>
            )
        }

        return pages
    }

    return (
        <div className="flex items-center justify-center gap-2 py-4">
            <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30"
            >
                &lt;
            </button>
            
            <div className="flex items-center gap-1">
                {renderPageNumbers()}
            </div>

            <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30"
            >
                &gt;
            </button>
        </div>
    )
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
      {/* Modal de Aviso de Permissão */}
      {showPermissionModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6 animate-fade-in">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Acesso Negado</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Você não tem permissão para realizar esta ação. Contate o administrador do sistema.
              </p>
              <button
                onClick={() => setShowPermissionModal(false)}
                className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg text-sm font-medium transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs no topo: rolável no mobile */}
      <div className="mb-3">
        <div className="flex items-center gap-3 text-sm overflow-x-auto whitespace-nowrap md:overflow-visible scrollbar-none -mx-2 px-2">
          {tabs.map(t => (
            <button
              key={t.key}
              className={`shrink-0 inline-flex px-2 py-1 ${tab===t.key ? 'text-green-700 dark:text-green-400 font-medium border-b-2 border-green-600 dark:border-green-500' : 'text-gray-600 dark:text-gray-400'}`}
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
              className="pl-10 pr-3 py-2 border rounded w-full bg-gray-100 dark:bg-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400" 
            />
          </div>

          {/* Filtros */}
          <button
            className="md:hidden h-9 w-9 shrink-0 rounded border flex items-center justify-center bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400"
            aria-label="Filtros"
            title="Filtros"
            onClick={()=>setShowFilters(x=>!x)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M3 5h18M6 12h12M10 19h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded border text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600" onClick={()=>setShowFilters(x=>!x)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 5h18M6 12h12M10 19h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Filtros
          </button>

          {/* Alternador de visualização */}
          <button 
            className="px-3 py-2 rounded border text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600 transition-colors" 
            onClick={()=>setViewMode(viewMode==='list'?'grid':'list')}
            title={viewMode === 'list' ? "Visualizar em Grade" : "Visualizar em Lista"}
          >
            {viewMode === 'list' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            )}
          </button>
        </div>

        <div className="flex items-center gap-3">
          {loading && (
            <div className="hidden md:flex items-center gap-2 text-gray-500 dark:text-gray-300 text-sm">
              <span className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"></span>
              <span>Carregando…</span>
            </div>
          )}
          {/* Opções */}
          <div className="relative hidden md:inline-block">
            <button 
              className="px-4 py-2 rounded border border-green-500 text-green-600 dark:text-green-400 text-sm font-medium hover:bg-green-50 dark:hover:bg-green-900/30"
              onClick={() => setOptionsOpen(!optionsOpen)}
            >
              Opções
            </button>
            {optionsOpen && (
              <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 z-50 py-1">
                 {(isOwner || perms.products?.view) && (
                 <button 
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
                  onClick={() => { setOptionsOpen(false); setShowLabelsScreen(true); }}
                >
                  <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                   </svg>
                   Etiquetas
                 </button>
                 )}
                 {isOwner && (
                 <button 
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
                    onClick={() => { setOptionsOpen(false); /* TODO: Exportar */ }}
                  >
                    <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Exportar
                  </button>
                  )}

                  {isOwner && (
                  <>
                  <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                  <div className="px-4 py-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onClick={() => setSyncProducts(!syncProducts)}>
                    <span className="text-sm text-gray-700 dark:text-gray-200">Sincronizar produtos</span>
                    <div className={`w-8 h-4 flex items-center rounded-full p-1 duration-300 ease-in-out ${syncProducts ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <div className={`bg-white w-3 h-3 rounded-full shadow-md transform duration-300 ease-in-out ${syncProducts ? 'translate-x-3' : ''}`}></div>
                    </div>
                  </div>
                  </>
                  )}
              </div>
            )}
          </div>

          {/* + Novo */}
          {['produto', 'categorias', 'fornecedores'].includes(tab) && (
            <button className="hidden md:inline-flex px-4 py-2 rounded bg-green-500 text-white text-sm font-medium hover:bg-green-600" onClick={addNew}>
              + Novo
            </button>
          )}
        </div>
      </div>

      {/* Barra fina de cabeçalho da listagem (oculta no mobile quando tab=produto) */}
      <div className={`mt-2 px-2 py-2 border-b bg-gray-50 dark:bg-gray-700 text-xs lg:text-sm text-gray-600 dark:text-gray-300 font-bold overflow-x-auto border-gray-200 dark:border-gray-600 ${tab==='produto' ? (viewMode === 'list' ? 'hidden md:block' : 'hidden') : ''}`}>
        {tab==='produto' && (isOwner || perms.products?.view) && (
          <div 
            className="grid gap-x-2 min-w-full"
            style={gridCols ? { gridTemplateColumns: gridCols } : {}}
          >
            <div></div>
            <div>Produto ({totalResults})</div>
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
        {(tab==='produto' && (isOwner || perms.products?.view)) ? (
          <>
          {viewMode === 'grid' ? (
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
               {loading && paginatedResults.length === 0 && Array.from({length: 12}).map((_,i)=>(
                 <div key={`sk-${i}`} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 animate-pulse">
                   <div className="aspect-square mb-2 bg-gray-100 dark:bg-gray-700 rounded-md"></div>
                   <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
                   <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/3"></div>
                 </div>
               ))}
               {!loading && paginatedResults.map(p => {
                 const clientFinal = getClientFinalPrice(p)
                 const priceText = clientFinal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
                 return (
                   <div 
                     key={p.id}
                     className="relative bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all p-3 flex flex-col h-full cursor-pointer group animate-fade-in"
                     onClick={() => (isOwner || perms.products?.edit) && startEdit(p)}
                   >
                     {/* Imagem */}
                     <div className="relative aspect-square mb-2 bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden flex items-center justify-center">
                       {p.imageUrl ? (
                         <img src={p.imageUrl} alt={p.name} className="object-cover w-full h-full" />
                       ) : (
                         <svg className="w-10 h-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                         </svg>
                       )}
                       {/* Star Icon (Top Left) */}
                      {p.featured && (
                      <div className="absolute top-1 left-1">
                         <svg className="w-5 h-5 text-yellow-400 drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20">
                           <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                         </svg>
                      </div>
                      )}
                    </div>

                    {/* Nome */}
                    <h3 className="text-xs font-medium text-gray-900 dark:text-white line-clamp-2 leading-tight mb-1" title={p.name}>
                       {p.name}
                     </h3>

                     {/* Footer (Preço e Ícone) */}
                     <div className="mt-auto pt-2 flex items-end justify-between">
                       <div className="font-bold text-gray-900 dark:text-white">
                         {priceText}
                       </div>
                       <div className="flex flex-col items-end">
                          {/* Tag Icon */}
                          <svg className="w-4 h-4 text-gray-400 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                       </div>
                     </div>
                   </div>
                 )
               })}
             </div>
          ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
            {loading && paginatedResults.length === 0 && (
              <div className="divide-y dark:divide-gray-700">
                {Array.from({length: 8}).map((_,i)=>(
                  <div key={`row-sk-${i}`} className="grid grid-cols-[1.5rem_1fr_auto_auto] md:grid-cols-none gap-x-2 items-center px-2 py-3 animate-pulse">
                    <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                    <div className="hidden md:block h-3 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                    <div className="hidden md:block h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                    <div className="hidden md:block h-3 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                    <div className="hidden md:block h-3 bg-gray-200 dark:bg-gray-700 rounded w-10"></div>
                  </div>
                ))}
              </div>
            )}
            {!loading && paginatedResults.map(p => {
              const clientFinal = getClientFinalPrice(p)
              const priceText = clientFinal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
              const stock = Number(p.stock ?? 0)
              const reserved = reservedMap[p.id] || 0
              const stockDotClass = stock <= 0 ? 'red-dot' : (stock === 1 ? 'orange-dot' : 'green-dot')
              return (
                <>
                <div 
                  key={p.id} 
                  className="relative grid grid-cols-[1.5rem_1fr_auto_auto] md:grid-cols-none gap-x-2 items-center px-2 py-2 border-b last:border-0 min-w-full hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors dark:border-gray-700"
                  style={gridCols ? { gridTemplateColumns: gridCols } : {}}
                >
                  <div>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={()=>toggleSelect(p.id)} className="dark:bg-gray-700 dark:border-gray-600" />
                  </div>
                  <div className="text-xs overflow-hidden">
                    <div className="truncate text-gray-900 dark:text-white flex items-center gap-1" title={p.name}>
                      {p.featured && (
                        <span className="text-yellow-400 text-base">★</span>
                      )}
                      {p.name}
                    </div>
                    <div className="md:hidden text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                      Estoque: {stock.toLocaleString('pt-BR')}
                      <span className={stockDotClass} />
                    </div>
                  </div>
                  {showExtras && (
                    <div className="hidden md:block text-xs lg:text-sm text-gray-500 dark:text-gray-400 font-mono">
                      {p.reference || '-'}
                    </div>
                  )}
                  {/* Data de atualização (substituindo prévia de variações) */}
                  {showExtras && (
                    <div className="hidden md:flex text-xs lg:text-sm text-gray-700 dark:text-gray-300 justify-center items-center whitespace-nowrap">
                       {(() => {
                         if (!p.updatedAt) return '—';
                         const d = p.updatedAt.seconds ? new Date(p.updatedAt.seconds * 1000) : new Date(p.updatedAt);
                         return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
                       })()}
                    </div>
                  )}
                  {showExtras && (
                    <div className="hidden md:flex text-xs lg:text-sm text-gray-700 dark:text-gray-300 justify-center items-center whitespace-nowrap">
                       {(() => {
                         if (!p.updatedAt) return '—';
                         const d = p.updatedAt.seconds ? new Date(p.updatedAt.seconds * 1000) : new Date(p.updatedAt);
                         return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                       })()}
                    </div>
                  )}
                  {showExtras && (
                    <div className="hidden md:flex text-xs lg:text-sm text-gray-700 dark:text-gray-300 justify-center items-center truncate px-2" title={p.lastEditedBy || p.createdBy || ''}>
                       {p.lastEditedBy || p.createdBy || '—'}
                    </div>
                  )}
                  <div className="text-right whitespace-nowrap md:whitespace-normal md:text-right md:pl-0 pl-4 justify-self-end flex flex-col items-end justify-center">
                    <div className="text-xs lg:text-sm whitespace-nowrap text-gray-900 dark:text-white">{priceText}</div>
                    {/* Botão sanfona (mobile e desktop) abaixo do preço */}
                    {(Array.isArray(p.variationsData) && p.variationsData.length > 0) && (
                      <div className="mt-1">
                        <button
                          type="button"
                          aria-label="Abrir precificações"
                          title="Abrir precificações"
                          className="inline-flex h-6 w-6 items-center justify-center rounded border bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400"
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
                  <div className={`hidden md:block text-right text-xs lg:text-sm whitespace-nowrap ${stock === 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{stock.toLocaleString('pt-BR')}</div>
                  <div className="hidden md:block text-right text-xs lg:text-sm">
                    <div className={`inline-block px-2 py-0.5 rounded text-xs lg:text-sm font-semibold border ${(p.active ?? true) ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/50' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-900/50'}`}>{(p.active ?? true) ? 'Ativo' : 'Inativo'}</div>
                  </div>
                  <div className="text-right text-sm relative">
                    <button
                      type="button"
                      aria-label="Mais ações"
                      title="Mais ações"
                      className="inline-flex h-8 w-8 items-center justify-center rounded border bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600"
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
                        className="fixed z-[9999] w-56 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg"
                        style={{ top: menuPos.top, left: menuPos.left }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="py-2">
                          {(isOwner || perms.products?.edit) && (
                          <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-200" onClick={()=> { startEdit(p); setOpenMenuId(null); }}>
                            <span>✏️</span>
                            <span>Editar</span>
                          </button>
                          )}
                          {(isOwner || perms.products?.create) && (
                          <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-200" onClick={()=> handleClone(p)}>
                            <span>📄</span>
                            <span>Clonar</span>
                          </button>
                          )}
                          {(isOwner || perms.products?.edit) && (
                          <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-200" onClick={()=> handleToggleActive(p)}>
                            <span>{(p.active ?? true) ? '✖️' : '✔️'}</span>
                            <span>{(p.active ?? true) ? 'Inativar' : 'Ativar'}</span>
                          </button>
                          )}
                        {(isOwner || perms.products?.edit) && (
                        <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-200" onClick={()=> openStockModal(p)}>
                          <span>📦</span>
                          <span>Alterar estoque</span>
                        </button>
                          )}
                          {(isOwner || perms.products?.view || perms.products?.edit) && (
                        <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-200" onClick={()=> openMovementsModal(p)}>
                          <span>📊</span>
                          <span>Movimentações</span>
                        </button>
                          )}
                        {(isOwner || perms.sales?.viewAll) && (
                        <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-200" onClick={()=>{ setReservedProduct(p); setReservedOpen(true); setOpenMenuId(null) }}>
                          <span>🔖</span>
                          <span>Reservados</span>
                        </button>
                        )}
                        {(isOwner || perms.products?.edit) && (
                        <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-200" onClick={()=>{ console.log('destacar', p.id) }}>
                          <span>⭐</span>
                          <span>Destacar</span>
                        </button>
                        )}
                        {(isOwner || perms.products?.delete) && (
                        <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-200" onClick={()=> openConfirmRemove(p)}>
                          <span>🗂️</span>
                          <span>Excluir do catálogo</span>
                        </button>
                        )}
                        {(isOwner || perms.products?.create) && (
                        <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-200" onClick={()=> handleSyncProduct(p)} disabled={syncingProduct === p.id}>
                          <span>{syncingProduct === p.id ? '⏳' : '🔁'}</span>
                          <span>{syncingProduct === p.id ? 'Sincronizando...' : 'Sincronizar entre empresas'}</span>
                        </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                </div>
                  {/* Painel sanfona com variações (somente mobile) com animação */}
                    <div className={`md:hidden px-4 ${mobileOpenRows.has(p.id) ? 'py-2 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700' : 'py-0'} last:border-0`}>
                      <div className={`overflow-hidden transition-all duration-200 ease-in-out ${mobileOpenRows.has(p.id) ? 'max-h-[480px] opacity-100' : 'max-h-0 opacity-0'}`}>
                        {Array.isArray(p.variationsData) && p.variationsData.length > 0 ? (
                          <div className="space-y-2">
                            {p.variationsData.map((v, idx) => {
                              const sale = Number(v?.salePrice ?? 0)
                              const promo = v?.promoPrice != null ? Number(v.promoPrice) : null
                              const price = promo != null ? promo : sale
                              const stockVar = Number(v?.stock ?? 0)
                              return (
                                <div key={idx} className="grid grid-cols-[1fr_6rem] items-center gap-2 text-xs text-gray-700 dark:text-gray-200">
                                  <div className="truncate" title={v?.name || v?.label || `Variação ${idx+1}`}>
                                    <span className="font-medium">{v?.name || v?.label || `Variação ${idx+1}`}</span>
                                    {p.reference ? (<span className="ml-1 text-gray-500 dark:text-gray-400">({p.reference})</span>) : null}
                                    {stockVar ? (<span className="ml-2 text-gray-500 dark:text-gray-400">Estoque: {stockVar.toLocaleString('pt-BR')}</span>) : null}
                                  </div>
                                  <div className="text-right whitespace-nowrap">
                                    {price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-600 dark:text-gray-400 py-2">Sem variações cadastradas</div>
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
          )
          }
          <Pagination />
          </>
        ) : (
          tab==='categorias' ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              {/* Mantém listagem de categorias */}
              <div className="grid grid-cols-[1.5rem_1fr_8rem_2rem] items-center px-4 py-3 text-xs text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                <div></div>
                <div>Nome</div>
                <div className="text-right">Status</div>
                <div></div>
              </div>
              {filteredCategories.map(c => (
                <div key={c.id} className="grid grid-cols-[1.5rem_1fr_8rem_2rem] items-center px-4 py-3 border-b dark:border-gray-700 last:border-0">
                  <div></div>
                  <div className="text-sm text-gray-900 dark:text-white">
                    <div className="font-medium cursor-pointer" onClick={()=> (isOwner || perms.categories?.edit) && startCategoryEdit(c)}>{c.name}</div>
                  </div>
                  <div className="hidden md:block text-sm text-right">
                    <div className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${(c.active ?? true) ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'}`}>
                      {(c.active ?? true) ? 'Ativo' : 'Inativo'}
                    </div>
                  </div>
                  <div className="text-right text-sm relative">
                    <button
                      type="button"
                      aria-label="Mais ações de categoria"
                      title="Mais ações"
                      className="inline-flex h-8 w-8 items-center justify-center rounded border dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        const rect = e.currentTarget.getBoundingClientRect()
                        setMenuPos({ top: rect.bottom + 2, left: rect.right - 224 })
                        setCategoryMenuId(categoryMenuId === c.id ? null : c.id)
                      }}
                    >
                      ⋯
                    </button>
                    {categoryMenuId === c.id && (
                      <div 
                        className="fixed z-[9999] w-56 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg"
                        style={{ top: menuPos.top, left: menuPos.left }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="py-2">
                          {(isOwner || perms.categories?.bulkPricing) && (
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-200"
                            onClick={() => openBulkPricing(c)}
                          >
                            <span>⚙️</span>
                            <span>Precificações em massa</span>
                          </button>
                          )}
                          {(isOwner || perms.categories?.delete) && (
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"
                            onClick={() => openConfirmRemoveCategory(c)}
                          >
                            <span>🗑️</span>
                            <span>Excluir</span>
                          </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : tab==='fornecedores' ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="grid grid-cols-[1.5rem_1fr_8rem_2rem] items-center px-4 py-3 text-xs text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                <div></div>
                <div>Fornecedor ({suppliers.length})</div>
                <div className="text-right">Status</div>
                <div></div>
              </div>
              {suppliers.map(s => (
                <div key={s.id} className="grid grid-cols-[1.5rem_1fr_8rem_2rem] items-center px-4 py-3 border-b dark:border-gray-700 last:border-0">
                  <div></div>
                  <div className="text-sm text-gray-900 dark:text-white">
                    <div className="font-medium cursor-pointer" onClick={()=> (isOwner || perms.suppliers?.edit) && startSupplierEdit(s)}>{s.name}</div>
                  </div>
                  <div className="hidden md:block text-sm text-right">
                    <div className={`px-2 py-1 rounded text-xs ${(s.active ?? true) ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-400'}`}>{(s.active ?? true) ? 'Ativo' : 'Inativo'}</div>
                  </div>
                  <div className="text-right text-sm relative">
                    <button
                      type="button"
                      aria-label="Mais ações de fornecedor"
                      title="Mais ações"
                      className="inline-flex h-8 w-8 items-center justify-center rounded border dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        const rect = e.currentTarget.getBoundingClientRect()
                        setMenuPos({ top: rect.bottom + 2, left: rect.right - 224 })
                        setSupplierMenuId(supplierMenuId === s.id ? null : s.id)
                      }}
                    >
                      ⋯
                    </button>
                    {supplierMenuId === s.id && (
                      <div 
                        className="fixed z-[9999] w-56 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg"
                        style={{ top: menuPos.top, left: menuPos.left }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="py-2">
                          {(isOwner || perms.suppliers?.delete) && (
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"
                            onClick={() => openConfirmRemoveSupplier(s)}
                          >
                            <span>🗑️</span>
                            <span>Excluir</span>
                          </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : null)
        }
      </div>
      {(openMenuId || categoryMenuId || supplierMenuId) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setOpenMenuId(null)
            setCategoryMenuId(null)
            setSupplierMenuId(null)
          }}
        />
      )}
      
      {/* Modal de Feedback de Sincronização */}
      {syncFeedback.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6 relative flex flex-col max-h-[90vh]">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
              {syncFeedback.loading ? <span className="animate-spin">⏳</span> : (syncFeedback.successCount > 0 ? '✅' : 'ℹ️')}
              {syncFeedback.loading ? 'Sincronizando...' : 'Sincronização Concluída'}
            </h3>
            
            <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded flex-1 overflow-y-auto mb-4 text-xs font-mono border dark:border-gray-700 min-h-[200px] text-gray-800 dark:text-gray-200">
              {syncFeedback.logs.map((log, idx) => (
                <div key={idx} className="mb-1 border-b border-gray-200 dark:border-gray-700 last:border-0 pb-1 break-words">
                  {log}
                </div>
              ))}
              {syncFeedback.loading && (
                 <div className="animate-pulse text-blue-600 dark:text-blue-400 font-bold mt-2">Processando...</div>
              )}
            </div>

            <div className="flex justify-end gap-2">
               {!syncFeedback.loading && (
                  <button 
                    onClick={() => setSyncFeedback(prev => ({ ...prev, open: false }))}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Fechar
                  </button>
               )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Sync */}
      {syncConfirm.open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl p-6 relative flex flex-col animate-fade-in">
            <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-white border-b dark:border-gray-700 pb-2">
              Confirmar Sincronização
            </h3>
            
            <p className="mb-4 text-gray-600 dark:text-gray-300">
              Um produto similar foi encontrado na loja <strong className="text-blue-600 dark:text-blue-400">{syncConfirm.storeName}</strong>.
              Confira se trata-se do mesmo item antes de prosseguir.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded border border-blue-100 dark:border-blue-800">
                <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2 text-sm uppercase">Produto de Origem (Esta Loja)</h4>
                <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                  <p><span className="font-semibold">Nome:</span> {syncConfirm.source?.name}</p>
                  <p><span className="font-semibold">Ref:</span> {syncConfirm.source?.reference || '-'}</p>
                  <p><span className="font-semibold">Fornecedor:</span> {syncConfirm.source?.supplier || '-'}</p>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded border border-yellow-100 dark:border-yellow-800">
                <h4 className="font-bold text-yellow-800 dark:text-yellow-300 mb-2 text-sm uppercase">Produto Encontrado (Destino)</h4>
                <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                  <p><span className="font-semibold">Nome:</span> {syncConfirm.target?.name}</p>
                  <p><span className="font-semibold">Ref:</span> {syncConfirm.target?.reference || '-'}</p>
                  <p><span className="font-semibold">Fornecedor:</span> {syncConfirm.target?.supplier || '-'}</p>
                  <p><span className="font-semibold">Categoria:</span> {syncConfirm.targetCategoryName || '-'}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-auto pt-4 border-t dark:border-gray-700">
               <button 
                 onClick={() => handleConfirmSync(false)}
                 className="px-5 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors"
               >
                 Não, é diferente (Pular)
               </button>
               <button 
                 onClick={() => handleConfirmSync(true)}
                 className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium shadow-lg hover:shadow-xl transition-all"
               >
                 Sim, é o mesmo (Sincronizar)
               </button>
            </div>
          </div>
        </div>
      )}

      <NewProductModal 
        open={modalOpen}  
        onClose={()=>setModalOpen(false)} 
        categories={categories} 
        suppliers={suppliers} 
        storeId={storeId} 
        user={user} 
        syncProducts={syncProducts}
        canCreateCategory={isOwner || perms.categories?.create}
        canCreateSupplier={isOwner || perms.suppliers?.create}
        onSuccess={handleProductSave}
      />
      <NewProductModal 
        open={editModalOpen} 
        onClose={()=>setEditModalOpen(false)} 
        isEdit={true} 
        product={editingProduct} 
        categories={categories} 
        suppliers={suppliers} 
        storeId={storeId} 
        user={user}
        syncProducts={syncProducts}
        canCreateCategory={isOwner || perms.categories?.create}
        canCreateSupplier={isOwner || perms.suppliers?.create}
        onSuccess={handleProductSave}
      />
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
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg w-[95vw] max-w-[520px]">
            <div className="px-4 py-3 border-b dark:border-gray-700">
              <h3 className="text-base font-medium text-gray-900 dark:text-white">Excluir do catálogo</h3>
            </div>
            <div className="p-4 space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <div>
                Tem certeza que deseja excluir “{confirmRemoveProduct?.name}” do catálogo?
              </div>
              <div>
                Esta ação também zera o estoque do produto{Array.isArray(confirmRemoveProduct?.variationsData) && (confirmRemoveProduct?.variationsData?.length||0) > 0 ? ' e de todas as variações' : ''}.
              </div>
            </div>
            <div className="px-4 py-3 border-t dark:border-gray-700 flex items-center justify-end gap-2">
              <button className="px-3 py-2 text-sm rounded border dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={()=>setConfirmRemoveOpen(false)} disabled={savingAction}>Cancelar</button>
              <button className="px-3 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700" onClick={confirmRemoveFromCatalog} disabled={savingAction}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {confirmRemoveCategoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setConfirmRemoveCategoryOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg w-[95vw] max-w-[520px]">
            <div className="px-4 py-3 border-b dark:border-gray-700">
              <h3 className="text-base font-medium text-gray-900 dark:text-white">Excluir categoria</h3>
            </div>
            <div className="p-4 space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <div>
                Tem certeza que deseja excluir a categoria “{categoryToRemove?.name}”?
              </div>
              <div className="text-gray-500 dark:text-gray-400">
                Isso não excluirá os produtos, mas eles ficarão sem categoria.
              </div>
            </div>
            <div className="px-4 py-3 border-t dark:border-gray-700 flex items-center justify-end gap-2">
              <button className="px-3 py-2 text-sm rounded border dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={()=>setConfirmRemoveCategoryOpen(false)} disabled={savingAction}>Cancelar</button>
              <button className="px-3 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700" onClick={handleRemoveCategory} disabled={savingAction}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {confirmRemoveSupplierOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setConfirmRemoveSupplierOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg w-[95vw] max-w-[520px]">
            <div className="px-4 py-3 border-b dark:border-gray-700">
              <h3 className="text-base font-medium text-gray-900 dark:text-white">Excluir fornecedor</h3>
            </div>
            <div className="p-4 space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <div>
                Tem certeza que deseja excluir o fornecedor “{supplierToRemove?.name}”?
              </div>
              <div className="text-gray-500 dark:text-gray-400">
                Isso não excluirá os produtos vinculados, mas eles ficarão sem fornecedor.
              </div>
            </div>
            <div className="px-4 py-3 border-t dark:border-gray-700 flex items-center justify-end gap-2">
              <button className="px-3 py-2 text-sm rounded border dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={()=>setConfirmRemoveSupplierOpen(false)} disabled={savingAction}>Cancelar</button>
              <button className="px-3 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700" onClick={handleRemoveSupplier} disabled={savingAction}>Excluir</button>
            </div>
          </div>
        </div>
      )}
      {stockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setStockModalOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg w-[95vw] max-w-[560px]">
            <div className="px-4 py-3 border-b dark:border-gray-700">
              <h3 className="text-base font-medium text-gray-900 dark:text-white">Adicionar / Remover Estoque</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Tipo</div>
                <div className="flex items-center gap-2">
                  <button type="button" className={`px-3 py-1 rounded border text-sm ${stockType==='entrada' ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400' : 'dark:border-gray-600 dark:text-gray-300'}`} onClick={()=>setStockType('entrada')}>Entrada</button>
                  <button type="button" className={`px-3 py-1 rounded border text-sm ${stockType==='saida' ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400' : 'dark:border-gray-600 dark:text-gray-300'}`} onClick={()=>setStockType('saida')}>Saida</button>
                </div>
              </div>
              <div className="text-sm text-gray-800 dark:text-gray-200">
                {stockTargetProduct?.name} {Array.isArray(stockTargetProduct?.variationsData) && (stockTargetProduct?.variationsData?.length || 0) > 0 ? ` - ${(stockTargetProduct?.variationsData?.[0]?.name || stockTargetProduct?.variationsData?.[0]?.label || '')}` : ''}
              </div>
              <div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Quantidade</div>
                <input type="number" value={stockQty} onChange={e=>setStockQty(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300">
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
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Descrição (opcional)</div>
                <input value={stockDesc} onChange={e=>setStockDesc(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
            </div>
            <div className="px-4 py-3 border-t dark:border-gray-700 flex items-center justify-end gap-2">
              <button className="px-3 py-2 text-sm rounded border dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={()=>setStockModalOpen(false)} disabled={savingAction}>Cancelar</button>
              <button className="px-3 py-2 text-sm rounded bg-green-600 text-white hover:bg-green-700" onClick={confirmStockAdjust} disabled={savingAction}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
      {reservedOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setReservedOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg w-[95vw] max-w-[640px]">
            <div className="px-4 py-3 border-b dark:border-gray-700">
              <h3 className="text-base font-medium text-gray-900 dark:text-white">Reservados</h3>
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
                        <div key={o.id} className="grid grid-cols-[6rem_1fr_6rem] items-center gap-3 text-sm border-b dark:border-gray-700 last:border-0 px-2 py-2 text-gray-700 dark:text-gray-300">
                          <div className="font-bold text-gray-900 dark:text-white">{label}</div>
                          <div className="leading-tight">
                            <div className="font-medium text-gray-900 dark:text-white">{o.client || 'Consumidor Final'}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{ds} • {o.status || (isOSCandidate ? 'Iniciado' : 'Pedido')}</div>
                          </div>
                          <div className="text-right font-mono">{qty}</div>
                        </div>
                      )
                    })}
                    {list.length === 0 && <div className="text-sm text-gray-600 dark:text-gray-400">Nenhum pedido ou ordem de serviço encontrado reservando este item.</div>}
                  </div>
                )
              })()}
            </div>
            <div className="px-4 py-3 border-t dark:border-gray-700 flex items-center justify-end">
              <button type="button" className="px-3 py-2 border rounded text-sm dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" onClick={()=>setReservedOpen(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
      {bulkModalOpen && bulkCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setBulkModalOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg w-[95vw] max-w-[520px]">
            <div className="px-4 py-3 border-b dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-base font-medium dark:text-white">Precificação em massa</h3>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Categoria: {bulkCategory.name}
                </div>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600 dark:text-gray-300">Tipo:</span>
                <div className="inline-flex rounded border dark:border-gray-600 overflow-hidden">
                  <button
                    type="button"
                    className={`px-3 py-1 text-sm ${bulkType === 'add' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                    onClick={()=>setBulkType('add')}
                  >
                    Adicionar
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 text-sm border-l dark:border-gray-600 ${bulkType === 'remove' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                    onClick={()=>setBulkType('remove')}
                  >
                    Remover
                  </button>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Ajuste R$</div>
                <input
                  type="text"
                  value={bulkAmount}
                  onChange={e=>setBulkAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Ajuste (%)</div>
                <input
                  type="number"
                  value={bulkPercent}
                  onChange={e=>setBulkPercent(e.target.value)}
                  className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white"
                />
                <div className="flex items-center gap-2 mt-2">
                  {[5,10,15,20].map(v => (
                    <button
                      key={v}
                      type="button"
                      className="flex-1 border dark:border-gray-600 rounded px-2 py-1 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      onClick={()=>setBulkPercent(String(v))}
                    >
                      {v}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t dark:border-gray-700 flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 text-sm rounded border dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={()=>setBulkModalOpen(false)}
                disabled={bulkSaving}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-3 py-2 text-sm rounded bg-green-600 text-white hover:bg-green-700"
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
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg w-[95vw] max-w-[900px]">
            <div className="px-4 py-3 border-b dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-base font-medium dark:text-white">Aplicar ajuste em massa</h3>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Categoria: {bulkCategory.name} • {bulkCandidates.length} produtos encontrados
                </div>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-green-600"
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
                    <span className="text-xs text-gray-600 dark:text-gray-300">Buscar:</span>
                    <input
                      value={bulkReviewQuery}
                      onChange={e => setBulkReviewQuery(e.target.value)}
                      placeholder="Nome ou código"
                      className="border dark:border-gray-600 rounded px-2 py-1 text-xs w-48 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
                <div className="max-h-80 overflow-auto border dark:border-gray-700 rounded bg-gray-50/60 dark:bg-gray-900/30">
                  {bulkCandidates.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                      Nenhum produto encontrado nesta categoria.
                    </div>
                  )}
                  {bulkCandidates.length > 0 && bulkFilteredCandidates.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                      Nenhum produto encontrado para a busca.
                    </div>
                  )}
                  {bulkFilteredCandidates.map(p => (
                    <label
                      key={p.id}
                      className={`flex items-start gap-3 px-4 py-3 border-b dark:border-gray-700 last:border-0 text-sm bg-white dark:bg-gray-800 transition-colors ${
                        bulkSelectedIds.has(p.id) ? 'bg-green-50/60 dark:bg-green-900/20' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 text-green-600 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
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
                            <div className="font-medium truncate dark:text-white">{p.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
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
                                        : 'bg-white border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'
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
                <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Quais precificações ajustar</div>
                {bulkMaxSlots === 0 ? (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
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
                                : 'bg-white border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'
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
                    <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                      Se nenhuma precificação for marcada, apenas o preço principal será ajustado.
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t dark:border-gray-700 flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 text-sm rounded border dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={()=>setBulkReviewOpen(false)}
                disabled={bulkSaving}
              >
                Voltar
              </button>
              <button
                type="button"
                className="px-3 py-2 text-sm rounded bg-green-600 text-white hover:bg-green-700"
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
