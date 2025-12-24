import React, { useMemo, useState, useEffect } from 'react'
import { listenProducts, updateProduct, addProduct, removeProduct } from '../services/products'
import NewProductModal from './NewProductModal'
import { listenCategories, updateCategory } from '../services/categories'
import NewCategoryModal from './NewCategoryModal'
import { listenSuppliers, updateSupplier } from '../services/suppliers'
import NewSupplierModal from './NewSupplierModal'
import ProductsFilterModal from './ProductsFilterModal'
import ProductLabelsPage from './ProductLabelsPage'

const tabs = [
  { key: 'produto', label: 'Produto' },
  { key: 'categorias', label: 'Categorias' },
  { key: 'movestoque', label: 'Movimento De Estoque' },
  { key: 'fornecedores', label: 'Fornecedores' },
  { key: 'compras', label: 'Compras' },
]

export default function ProductsPage({ storeId, addNewSignal }){
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
  const [stockModalOpen, setStockModalOpen] = useState(false)
  const [stockTargetProduct, setStockTargetProduct] = useState(null)
  const [selectedVarIdx, setSelectedVarIdx] = useState(0)
  const [stockType, setStockType] = useState('entrada')
  const [stockQty, setStockQty] = useState('0')
  const [stockDesc, setStockDesc] = useState('')
  const [savingAction, setSavingAction] = useState(false)
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)
  const [confirmRemoveProduct, setConfirmRemoveProduct] = useState(null)

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

  const filtered = useMemo(()=>{
    const q = query.trim().toLowerCase()
    let res = products.filter(p => (p.name || '').toLowerCase().includes(q))

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
      const data = { ...rest, name: product?.name || 'Produto' }
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
    try {
      setSavingAction(true)
      if (hasVars && selectedVarIdx >= 0) {
        const items = p.variationsData.map((v) => ({ ...v }))
        const cur = Number(items[selectedVarIdx]?.stock ?? 0)
        items[selectedVarIdx].stock = Math.max(0, cur + delta)
        const total = items.reduce((s, v) => s + (Number(v.stock ?? 0)), 0)
        await updateProduct(p.id, { variationsData: items, stock: total })
      } else {
        const cur = Number(p.stock ?? 0)
        const next = Math.max(0, cur + delta)
        await updateProduct(p.id, { stock: next })
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
      <div className={`mt-2 px-3 py-2 rounded bg-gray-100 text-xs text-gray-600 ${tab==='produto' ? 'hidden md:block' : ''}`}>
        {tab==='produto' && (
          <div className="grid grid-cols-[1.5rem_1fr_1fr_12rem_6rem_6rem_2rem]">
            <div></div>
            <div>Produto ({filtered.length})</div>
            <div className="text-center">Atualizado </div>
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
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {filtered.map(p => {
              const priceMin = Number(p.priceMin ?? p.salePrice ?? 0)
              const priceMax = Number(p.priceMax ?? p.salePrice ?? priceMin)
              const priceText = priceMax.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
              const stock = Number(p.stock ?? 0)
              return (
                <>
                <div key={p.id} className="relative grid grid-cols-[1.5rem_1fr_auto_auto] md:grid-cols-[1.5rem_1fr_1fr_12rem_6rem_6rem_2rem] items-center px-4 py-3 border-b last:border-0">
                  <div>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={()=>toggleSelect(p.id)} />
                  </div>
                  <div className="text-xs md:text-sm">
                    <div className="font-medium">
                      {p.name} {p.reference && <span className="text-gray-400 text-xs font-normal">#{p.reference}</span>}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      Estoque: {stock.toLocaleString('pt-BR')}
                      <span className="red-dot" />
                    </div>
                  </div>
                  {/* Data de atualização (substituindo prévia de variações) */}
                  <div className="hidden md:flex text-xs text-gray-700 justify-center items-center">
                     {p.updatedAt?.seconds ? new Date(p.updatedAt.seconds * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </div>
                  <div className="text-right whitespace-nowrap md:whitespace-normal md:text-right md:pl-0 pl-4 justify-self-end flex flex-col items-end justify-center">
                    <div className="text-xs md:text-sm">{priceText}</div>
                    {/* Botão sanfona (mobile e desktop) abaixo do preço */}
                    {(Array.isArray(p.variationsData) && p.variationsData.length > 0) && (
                      <div className="mt-1">
                        <button
                          type="button"
                          aria-label="Abrir variações"
                          title="Abrir variações"
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
                  <div className={`hidden md:block text-right text-sm ${stock === 0 ? 'text-red-500' : ''}`}>{stock.toLocaleString('pt-BR')}</div>
                  <div className="hidden md:block text-right text-sm">
                    <div className={`px-2 py-1 rounded text-xs ${(p.active ?? true) ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>{(p.active ?? true) ? 'Ativo' : 'Inativo'}</div>
                  </div>
                  <div className="text-right text-sm relative">
                    <button
                      type="button"
                      aria-label="Mais ações"
                      title="Mais ações"
                      className="inline-flex h-8 w-8 items-center justify-center rounded border"
                      onClick={() => setOpenMenuId(openMenuId===p.id ? null : p.id)}
                    >
                      ⋯
                    </button>
                    {openMenuId === p.id && (
                      <div className="absolute z-50 right-0 top-full mt-1 w-56 bg-white border rounded-lg shadow">
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
                          <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2" onClick={()=>{ console.log('destacar', p.id) }}>
                            <span>⭐</span>
                            <span>Destacar</span>
                          </button>
                          <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2" onClick={()=> openConfirmRemove(p)}>
                            <span>🗂️</span>
                            <span>Remover do catálogo</span>
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
                              <div key={idx} className="grid grid-cols-[1fr_6rem] items-center gap-2 text-xs">
                                <div className="truncate">
                                  <span className="font-medium">{v?.name || v?.label || `Variação ${idx+1}`}</span>
                                  {v?.reference ? (<span className="ml-1 text-gray-500">({v.reference})</span>) : null}
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
                              <div key={idx} className="grid grid-cols-[1fr_6rem] items-center gap-2 text-sm">
                                <div className="truncate">
                                  <span className="font-medium">{v?.name || v?.label || `Variação ${idx+1}`}</span>
                                  {v?.reference ? (<span className="ml-1 text-gray-500">({v.reference})</span>) : null}
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
                    <div className={`px-2 py-1 rounded text-xs ${(c.active ?? true) ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>{(c.active ?? true) ? 'Ativo' : 'Inativo'}</div>
                  </div>
                  <div className="text-right text-sm">⋯</div>
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
      {openMenuId && (
        <div className="fixed inset-0 z-40" onClick={()=>setOpenMenuId(null)} />
      )}
      <NewProductModal open={modalOpen} onClose={()=>setModalOpen(false)} categories={categories} suppliers={suppliers} storeId={storeId} />
      <NewProductModal open={editModalOpen} onClose={()=>setEditModalOpen(false)} isEdit={true} product={editingProduct} categories={categories} suppliers={suppliers} storeId={storeId} />
      <NewCategoryModal open={catModalOpen} onClose={()=>setCatModalOpen(false)} storeId={storeId} />
      <NewCategoryModal open={catEditOpen} onClose={()=>setCatEditOpen(false)} isEdit={true} category={editingCategory} storeId={storeId} />
      <NewSupplierModal open={supplierModalOpen} onClose={()=>setSupplierModalOpen(false)} storeId={storeId} />
      <NewSupplierModal open={supplierEditOpen} onClose={()=>setSupplierEditOpen(false)} isEdit={true} supplier={editingSupplier} storeId={storeId} />
      {confirmRemoveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setConfirmRemoveOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-lg w-[95vw] max-w-[520px]">
            <div className="px-4 py-3 border-b">
              <h3 className="text-base font-medium">Remover do catálogo</h3>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div>
                Tem certeza que deseja remover “{confirmRemoveProduct?.name}” do catálogo?
              </div>
              <div>
                Esta ação também zera o estoque do produto{Array.isArray(confirmRemoveProduct?.variationsData) && (confirmRemoveProduct?.variationsData?.length||0) > 0 ? ' e de todas as variações' : ''}.
              </div>
            </div>
            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button className="px-3 py-2 text-sm rounded border" onClick={()=>setConfirmRemoveOpen(false)} disabled={savingAction}>Cancelar</button>
              <button className="px-3 py-2 text-sm rounded bg-red-600 text-white" onClick={confirmRemoveFromCatalog} disabled={savingAction}>Remover</button>
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
                <div className="text-xs text-gray-600 mb-1">Selecionar variação</div>
                {Array.isArray(stockTargetProduct?.variationsData) && (stockTargetProduct?.variationsData?.length || 0) > 0 ? (
                  <div className="flex items-center gap-2">
                    <button type="button" className="h-8 w-8 rounded border" onClick={()=>setSelectedVarIdx(i=> Math.max(0, i-1))}>‹</button>
                    <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
                      {(stockTargetProduct?.variationsData||[]).map((v, idx) => (
                        <button key={idx} type="button" className={`px-3 py-1 rounded border text-sm ${selectedVarIdx===idx ? 'bg-gray-200' : ''}`} onClick={()=>setSelectedVarIdx(idx)}>
                          {v?.name || v?.label || `Variação ${idx+1}`}
                        </button>
                      ))}
                    </div>
                    <button type="button" className="h-8 w-8 rounded border" onClick={()=>setSelectedVarIdx(i=> Math.min((stockTargetProduct?.variationsData?.length||1)-1, i+1))}>›</button>
                  </div>
                ) : (
                  <div className="text-sm text-gray-700">Produto sem variações</div>
                )}
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Tipo</div>
                <div className="flex items-center gap-2">
                  <button type="button" className={`px-3 py-1 rounded border text-sm ${stockType==='entrada' ? 'bg-green-50 border-green-300 text-green-700' : ''}`} onClick={()=>setStockType('entrada')}>Entrada</button>
                  <button type="button" className={`px-3 py-1 rounded border text-sm ${stockType==='saida' ? 'bg-red-50 border-red-300 text-red-700' : ''}`} onClick={()=>setStockType('saida')}>Saida</button>
                </div>
              </div>
              <div className="text-sm text-gray-800">
                {stockTargetProduct?.name} {Array.isArray(stockTargetProduct?.variationsData) && selectedVarIdx>=0 ? ` - ${(stockTargetProduct?.variationsData?.[selectedVarIdx]?.name || stockTargetProduct?.variationsData?.[selectedVarIdx]?.label || '')}` : ''}
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Quantidade</div>
                <input type="number" value={stockQty} onChange={e=>setStockQty(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="text-sm text-gray-700">
                {(() => {
                  const hasVars = Array.isArray(stockTargetProduct?.variationsData) && (stockTargetProduct?.variationsData?.length||0) > 0
                  const base = hasVars && selectedVarIdx>=0 ? Number(stockTargetProduct?.variationsData?.[selectedVarIdx]?.stock ?? 0) : Number(stockTargetProduct?.stock ?? 0)
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
