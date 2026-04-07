import React, { useEffect, useMemo, useState, useRef } from 'react'
import { listenCatalogProducts } from '../services/products'
import { listenCategories } from '../services/categories'
import { listenStore } from '../services/stores'
import { Search, Menu, ShoppingBag, Phone, MapPin, Grid, List, ChevronRight, ShoppingCart } from 'lucide-react'
import logoWhite from '../assets/logofundobranco.png'

export default function PublicCatalogPage({ storeId, store, loading }) {
  const [products, setProducts] = useState([])
  const [categoriesData, setCategoriesData] = useState([])
  const [storeData, setStoreData] = useState(store)
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Todos')
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 16
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [bannerIndex, setBannerIndex] = useState(0)
  const hoverRef = useRef(false)
  const categoryScrollRef = useRef(null)

  const outOfStockSetting = storeData?.catalogOutOfStock || 'show'
  const banners = Array.isArray(storeData?.catalogBanners) ? storeData.catalogBanners.filter(b => !!b?.url) : []

  useEffect(() => {
    setStoreData(store)
  }, [store])

  // Reset page when filtering
  useEffect(() => {
    setCurrentPage(1)
  }, [query, selectedCategory])

  useEffect(() => {
    if (!storeId) return
    const unsubProd = listenCatalogProducts(items => setProducts(items), storeId)
    const unsubCat = listenCategories(items => setCategoriesData(items), storeId)
    const unsubStore = listenStore(storeId, (s) => setStoreData(s))
    return () => { 
      unsubProd && unsubProd()
      unsubCat && unsubCat()
      unsubStore && unsubStore()
    }
  }, [storeId])

  useEffect(() => {
    if (!banners.length) return
    const id = setInterval(() => {
      if (hoverRef.current) return
      setBannerIndex(i => (i + 1) % banners.length)
    }, 5000)
    return () => clearInterval(id)
  }, [banners.length])

  const nextBanner = () => setBannerIndex(i => (i + 1) % (banners.length || 1))
  const prevBanner = () => setBannerIndex(i => (i - 1 + (banners.length || 1)) % (banners.length || 1))

  const scrollCategories = (direction) => {
    if (categoryScrollRef.current) {
      const scrollAmount = 200
      categoryScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
    }
  }

  // Map category names to products
  const productsWithCategory = useMemo(() => {
    return products.map(p => {
      const cat = categoriesData.find(c => c.id === p.categoryId)
      let name = 'Geral'
      if (cat) name = cat.name
      else if (p.category && typeof p.category === 'string') name = p.category
      
      return { ...p, categoryName: name }
    })
  }, [products, categoriesData])

  const categories = useMemo(() => {
    const cats = new Set(
      productsWithCategory
        .filter(p => (p.active ?? true) && p.showInCatalog === true)
        .map(p => p.categoryName)
        .filter(Boolean)
    )
    return ['Todos', ...Array.from(cats).sort()]
  }, [productsWithCategory])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = productsWithCategory.filter(p => (p.active ?? true) && p.showInCatalog === true)
    
    if (selectedCategory !== 'Todos') {
      list = list.filter(p => p.categoryName === selectedCategory)
    }

    if (outOfStockSetting === 'hide') {
      list = list.filter(p => Number(p.stock || 0) > 0)
    }

    if (q) {
      list = list.filter(p => {
        const name = String(p.name || '').toLowerCase()
        const ref = String(p.reference || '').toLowerCase()
        const code = String(p.code || '').toLowerCase()
        const barcode = String(p.barcode || '').toLowerCase()
        
        return name.includes(q) || ref.includes(q) || code.includes(q) || barcode.includes(q)
      })
    }
    
    // Ordenar por destaque primeiro
    list.sort((a, b) => {
      if (!!a.featured && !b.featured) return -1
      if (!a.featured && !!b.featured) return 1
      return 0
    })

    return list
  }, [productsWithCategory, query, selectedCategory, outOfStockSetting])

  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filtered.slice(start, start + ITEMS_PER_PAGE)
  }, [filtered, currentPage, ITEMS_PER_PAGE])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    )
  }

  if (!storeId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <ShoppingBag className="w-16 h-16 mx-auto text-gray-300" />
          <div className="text-xl font-semibold text-gray-700">Loja não encontrada</div>
          <div className="text-sm text-gray-500">Verifique o link do catálogo.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex flex-col">
      {/* Top Navigation / Header */}
      <header className="sticky top-0 z-30 bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo / Brand */}
            <div className="flex items-center gap-3">
              <div className="h-12 w-auto overflow-hidden rounded-lg flex items-center justify-center bg-white shadow-sm border border-gray-100 p-1">
                 <img src={logoWhite} alt={storeData?.name} className="h-full w-auto object-contain" />
              </div>
              <div>
                <h1 className="font-bold text-xl leading-none text-gray-900 tracking-tight">{storeData?.name || 'Nossa Loja'}</h1>
                <p className="text-xs text-gray-500 font-medium">Catálogo Digital</p>
              </div>
            </div>

            {/* Desktop Search */}
            <div className="hidden md:flex flex-1 max-w-lg mx-8 relative">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="O que você procura hoje?"
                className="w-full bg-gray-100 border-none rounded-full py-2.5 pl-12 pr-4 text-sm focus:ring-2 focus:ring-green-500/20 focus:bg-white transition-all"
              />
              <Search className="absolute left-4 top-2.5 text-gray-400 w-4 h-4" />
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                <Search size={20} />
              </button>
              {(storeData?.catalogWhatsapp || storeData?.phone) && (
                <a 
                  href={`https://wa.me/55${(storeData.catalogWhatsapp || storeData.phone).replace(/\D/g, '')}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hidden md:flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-all shadow-sm hover:shadow"
                >
                  <Phone size={16} />
                  <span>Fale Conosco</span>
                </a>
              )}
            </div>
          </div>
        </div>
        
        {/* Mobile Search Bar (Expandable) */}
        {mobileMenuOpen && (
           <div className="md:hidden px-4 pb-4 animate-in slide-in-from-top-2">
             <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar produtos..."
                className="w-full bg-gray-100 border-none rounded-lg py-2 pl-4 pr-4 text-sm"
                autoFocus
              />
           </div>
        )}
      </header>

      {banners.length > 0 && (
        <div 
          className="bg-white border-b border-gray-100"
          onMouseEnter={() => { hoverRef.current = true }}
          onMouseLeave={() => { hoverRef.current = false }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="relative overflow-hidden rounded-2xl shadow-sm group">
              <div className="relative w-full h-[140px] sm:h-[180px] md:h-[220px]">
                {banners.map((b, i) => (
                  <img
                    key={i}
                    src={b.url}
                    alt={storeData?.name || 'Banner'}
                    loading="lazy"
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${i === bannerIndex ? 'opacity-100' : 'opacity-0'}`}
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                ))}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/10 to-transparent pointer-events-none"></div>
                <div className="absolute inset-y-0 left-0 flex items-center">
                  {banners.length > 1 && (
                    <button
                      onClick={prevBanner}
                      className="m-2 sm:m-3 p-2 rounded-full bg-white/80 hover:bg-white text-gray-700 shadow transition hidden sm:flex"
                    >
                      <ChevronRight className="rotate-180" size={18} />
                    </button>
                  )}
                </div>
                <div className="absolute inset-y-0 right-0 flex items-center">
                  {banners.length > 1 && (
                    <button
                      onClick={nextBanner}
                      className="m-2 sm:m-3 p-2 rounded-full bg-white/80 hover:bg-white text-gray-700 shadow transition hidden sm:flex"
                    >
                      <ChevronRight size={18} />
                    </button>
                  )}
                </div>
                {banners.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {banners.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all ${i === bannerIndex ? 'w-5 bg-white' : 'w-2 bg-white/70'}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Carousel (Horizontal) */}
      <div className="bg-white border-b border-gray-100 sticky top-16 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="relative flex items-center group/cat">
            {/* Left Arrow */}
            <button 
              onClick={() => scrollCategories('left')}
              className="absolute left-0 z-10 p-1.5 rounded-full bg-white shadow-md border border-gray-100 text-gray-600 hover:text-green-600 transition-all opacity-0 group-hover/cat:opacity-100 -translate-x-1/2"
            >
              <ChevronRight className="rotate-180" size={18} />
            </button>

            {/* Scrollable Container */}
            <div 
              ref={categoryScrollRef}
              className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth px-2"
            >
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`whitespace-nowrap px-5 py-2 rounded-lg text-sm font-bold border transition-all shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-green-600 border-green-600 text-white shadow-sm'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-green-500 hover:text-green-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Right Arrow */}
            <button 
              onClick={() => scrollCategories('right')}
              className="absolute right-0 z-10 p-1.5 rounded-full bg-white shadow-md border border-gray-100 text-gray-600 hover:text-green-600 transition-all opacity-0 group-hover/cat:opacity-100 translate-x-1/2"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex gap-8">
        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="flex justify-between items-end mb-6">
             <div>
               <h2 className="text-2xl font-bold text-gray-900">{selectedCategory}</h2>
               <p className="text-sm text-gray-500 mt-1">
                 {filtered.length} {filtered.length === 1 ? 'produto encontrado' : 'produtos encontrados'}
                 {totalPages > 1 && ` - Exibindo página ${currentPage} de ${totalPages}`}
               </p>
             </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {paginatedResults.map(p => {
              const variations = Array.isArray(p.variationsData) ? p.variationsData : []
              
              // Pricing Logic
              const findVarPriceBySlot = (slot) => {
                const slotRegex = new RegExp(`^${slot}\\s*-`)
                const synonyms = slot === 1 
                  ? [
                      '1- PREÇO DO PRODUTO',
                      '1- VALOR DO PRODUTO',
                      '1 - PREÇO P/ CLIENTE FINAL'
                    ]
                  : [
                      '5 - PREÇO P/ LOJISTA INSTALAR NA LOJA',
                      '5 - PREÇO MAO DE OBRA P/INSTALAR NA LOJA',
                      '5-PREÇO P/INSTALAR NA LOJA',
                      '5-VALOR P/INSTALAR NA LOJA'
                    ]
                const v = variations.find(v => {
                  if (!v?.name) return false
                  return slotRegex.test(v.name) || synonyms.includes(v.name)
                })
                if (!v) return null
                const val = Number(v.salePrice ?? v.promoPrice ?? 0)
                return isFinite(val) ? val : null
              }
              
              const selectedNames = Array.isArray(p.catalogVisibleVariationNames) ? p.catalogVisibleVariationNames : []
              const labelsMap = (p.catalogCatalogLabels && typeof p.catalogCatalogLabels === 'object') ? p.catalogCatalogLabels : {}
              const items = selectedNames.map(name => {
                const v = variations.find(v => v.name === name)
                if (!v) return null
                const price = Number(v.promoPrice ?? v.salePrice ?? 0)
                if (!isFinite(price)) return null
                const label = (labelsMap[name] && String(labelsMap[name]).trim()) ? String(labelsMap[name]).trim() : name
                return { label, price }
              }).filter(Boolean)
              
              const defaultPrice = Number(p.priceMin ?? p.salePrice ?? 0)
              const hasCustomPricing = items.length > 0
              const stockZero = Number(p.stock || 0) === 0
              const isUnavailable = stockZero && outOfStockSetting === 'disabled'

              const cat = categoriesData.find(c => c.id === p.categoryId)
              const msgTemplate = (cat && cat.catalogMessage) ? cat.catalogMessage : (storeData?.catalogMessage || 'Olá, tenho interesse no produto: {produto}')
              let msg = msgTemplate
              if (msg.includes('{produto}') || msg.includes('{nome}')) {
                msg = msg.replace(/{produto}/g, p.name).replace(/{nome}/g, p.name)
              } else {
                msg = `${msg} ${p.name}`
              }

              return (
                <div key={p.id} className={`group bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden relative ${p.featured ? 'border-2 border-yellow-400 ring-1 ring-yellow-400/20' : 'border border-gray-100'}`}>
                  {/* Image Area */}
                  <div className="aspect-square bg-gray-50 relative overflow-hidden">
                    {p.featured && (
                      <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-1 rounded shadow-sm z-10">
                        DESTAQUE
                      </div>
                    )}
                    {p.imageUrl ? (
                      <img 
                        src={p.imageUrl} 
                        alt={p.name} 
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                        <ShoppingBag size={48} opacity={0.2} />
                      </div>
                    )}
                    {/* Badge Overlay */}
                    {isUnavailable && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
                        <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">ESGOTADO</span>
                      </div>
                    )}
                  </div>

                  {/* Content Area */}
                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold truncate">
                        {p.categoryName || 'Geral'}
                      </div>
                      <div className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${Number(p.stock || 0) > 0 ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'} whitespace-nowrap`}>
                        {Number(p.stock || 0) > 0 ? `DISPONÍVEL: ${Number(p.stock || 0)}` : 'INDISPONÍVEL'}
                      </div>
                    </div>
                    <h3 className="font-medium text-gray-900 text-sm leading-snug line-clamp-2 mb-3 min-h-[2.5rem]" title={p.name}>
                      {p.name}
                    </h3>
                    
                    <div className="mt-auto pt-3 border-t border-dashed border-gray-100">
                      {hasCustomPricing ? (
                        <div className="space-y-1.5 mb-3">
                          {items.map((it, i) => (
                            <div key={i} className="flex justify-between items-baseline">
                               <span className="text-[10px] font-bold text-gray-600">{it.label}</span>
                               <span className="text-sm font-bold text-green-700">{it.price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col mb-3">
                          <span className="text-[10px] text-gray-400 font-medium uppercase">A partir de</span>
                          <span className="text-lg font-bold text-gray-900">{defaultPrice.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
                        </div>
                      )}
                      
                      <a 
                        href={
                          (storeData?.catalogWhatsapp || storeData?.phone) && !isUnavailable
                          ? `https://wa.me/55${(storeData.catalogWhatsapp || storeData.phone).replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
                          : '#'
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${
                          isUnavailable 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                            : 'bg-green-600 hover:bg-green-700 text-white shadow-sm hover:shadow-md'
                        }`}
                        onClick={(e) => {
                          if (isUnavailable) e.preventDefault()
                        }}
                      >
                        <ShoppingCart size={16} />
                        {isUnavailable ? 'Indisponível' : 'Comprar'}
                      </a>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-10">
              <button 
                onClick={() => {
                  setCurrentPage(p => Math.max(1, p - 1))
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                disabled={currentPage === 1}
                className="p-2.5 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-green-600 hover:border-green-600 transition-all shadow-sm disabled:opacity-30 disabled:hover:text-gray-500 disabled:hover:border-gray-200"
              >
                <ChevronRight className="rotate-180" size={20} />
              </button>
              
              <div className="flex items-center gap-2">
                {[...Array(totalPages)].map((_, i) => {
                  const p = i + 1
                  // Mostrar apenas as primeiras 3, a atual, e as últimas 3 se houver muitas páginas
                  const isNearCurrent = Math.abs(p - currentPage) <= 1
                  const isStartOrEnd = p <= 2 || p >= totalPages - 1
                  
                  if (!isNearCurrent && !isStartOrEnd) {
                    if (p === 3 || p === totalPages - 2) {
                      return <span key={p} className="text-gray-400 px-1">...</span>
                    }
                    return null
                  }

                  return (
                    <button
                      key={p}
                      onClick={() => {
                        setCurrentPage(p)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className={`w-10 h-10 rounded-full text-sm font-bold transition-all ${
                        currentPage === p 
                          ? 'bg-green-600 text-white shadow-md' 
                          : 'bg-white border border-gray-200 text-gray-600 hover:border-green-600 hover:text-green-600'
                      }`}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>

              <button 
                onClick={() => {
                  setCurrentPage(p => Math.min(totalPages, p + 1))
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                disabled={currentPage === totalPages}
                className="p-2.5 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-green-600 hover:border-green-600 transition-all shadow-sm disabled:opacity-30 disabled:hover:text-gray-500 disabled:hover:border-gray-200"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Search className="text-gray-400" size={24} />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Nenhum produto encontrado</h3>
              <p className="text-gray-500 max-w-sm mt-1">
                Tente buscar por outro termo ou navegue por outras categorias.
              </p>
              <button 
                onClick={() => { setQuery(''); setSelectedCategory('Todos'); }}
                className="mt-4 text-green-600 font-medium hover:underline"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
           <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-center md:text-left">
                <h2 className="text-lg font-bold text-gray-900">{storeData?.name || 'Sua Loja'}</h2>
                <p className="text-sm text-gray-500">© {new Date().getFullYear()} Todos os direitos reservados.</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>Powered by</span>
                <span className="font-bold text-gray-600">Sistemix</span>
              </div>
           </div>
        </div>
      </footer>
    </div>
  )
}
