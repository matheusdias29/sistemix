import React, { useEffect, useMemo, useState } from 'react'
import { listenProducts } from '../services/products'
import { listenCategories } from '../services/categories'
import { Search, Menu, ShoppingBag, Phone, MapPin, Grid, List, ChevronRight, ShoppingCart } from 'lucide-react'
import logoWhite from '../assets/logofundobranco.png'

export default function PublicCatalogPage({ storeId, store }) {
  const [products, setProducts] = useState([])
  const [categoriesData, setCategoriesData] = useState([])
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Todos')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const outOfStockSetting = store?.catalogOutOfStock || 'show'

  useEffect(() => {
    if (!storeId) return
    const unsubProd = listenProducts(items => setProducts(items), storeId)
    const unsubCat = listenCategories(items => setCategoriesData(items), storeId)
    return () => { 
      unsubProd && unsubProd()
      unsubCat && unsubCat()
    }
  }, [storeId])

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
    const cats = new Set(productsWithCategory.map(p => p.categoryName).filter(Boolean))
    return ['Todos', ...Array.from(cats).sort()]
  }, [productsWithCategory])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = productsWithCategory.filter(p => (p.active ?? true))
    
    if (selectedCategory !== 'Todos') {
      list = list.filter(p => p.categoryName === selectedCategory)
    }

    if (outOfStockSetting === 'hide') {
      list = list.filter(p => Number(p.stock || 0) > 0)
    }

    if (q) {
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.reference || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [productsWithCategory, query, selectedCategory, outOfStockSetting])

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
                 <img src={logoWhite} alt={store?.name} className="h-full w-auto object-contain" />
              </div>
              <div>
                <h1 className="font-bold text-xl leading-none text-gray-900 tracking-tight">{store?.name || 'Nossa Loja'}</h1>
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
              {(store?.catalogWhatsapp || store?.phone) && (
                <a 
                  href={`https://wa.me/55${(store.catalogWhatsapp || store.phone).replace(/\D/g, '')}`} 
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

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex gap-8">
        {/* Sidebar (Desktop) */}
        <aside className="w-64 hidden md:block shrink-0 space-y-8">
          <div>
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <List size={18} />
              Categorias
            </h3>
            <nav className="space-y-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex justify-between items-center group ${
                    selectedCategory === cat 
                      ? 'bg-green-50 text-green-700' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {cat}
                  {selectedCategory === cat && <ChevronRight size={14} />}
                </button>
              ))}
            </nav>
          </div>
          
          {/* Store Info Widget */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <h4 className="font-semibold text-sm text-gray-900 mb-3">Sobre a loja</h4>
            <div className="space-y-3 text-sm text-gray-600">
               {store?.address && (
                 <div className="flex items-start gap-2">
                   <MapPin size={16} className="mt-0.5 text-green-600 shrink-0" />
                   <span className="text-xs leading-relaxed">{store.address}</span>
                 </div>
               )}
               <div className="pt-3 border-t border-gray-50">
                 <p className="text-xs text-gray-400 text-center">
                   Horário de atendimento<br/>
                   {store?.catalogOpeningDays || 'Seg à Sex'}: {store?.catalogOpeningHours || '08h - 18h'}
                 </p>
               </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {/* Mobile Categories (Horizontal Scroll) */}
          <div className="md:hidden mb-6 -mx-4 px-4 overflow-x-auto scrollbar-hide flex gap-2 pb-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  selectedCategory === cat
                    ? 'bg-green-600 border-green-600 text-white shadow-md'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex justify-between items-end mb-6">
             <div>
               <h2 className="text-2xl font-bold text-gray-900">{selectedCategory}</h2>
               <p className="text-sm text-gray-500 mt-1">
                 {filtered.length} {filtered.length === 1 ? 'produto encontrado' : 'produtos encontrados'}
               </p>
             </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filtered.map(p => {
              const variations = p.variationsData || []
              
              // Pricing Logic
              const var4 = variations.find(v => v.name && (v.name.startsWith('4 -') || v.name.startsWith('4-')))
              const var5 = variations.find(v => v.name && (v.name.startsWith('5 -') || v.name.startsWith('5-')))
              
              const price4 = var4 ? Number(var4.salePrice || 0) : null
              const price5 = var5 ? Number(var5.salePrice || 0) : null
              
              const defaultPrice = Number(p.priceMin ?? p.salePrice ?? 0)
              const hasCustomPricing = price4 !== null || price5 !== null
              const stockZero = Number(p.stock || 0) === 0
              const isUnavailable = stockZero && outOfStockSetting === 'disabled'

              return (
                <div key={p.id} className="group bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden relative">
                  {/* Image Area */}
                  <div className="aspect-square bg-gray-50 relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                       {/* Placeholder for image */}
                       <ShoppingBag size={48} opacity={0.2} />
                    </div>
                    {/* Badge Overlay */}
                    {isUnavailable && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
                        <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">ESGOTADO</span>
                      </div>
                    )}
                  </div>

                  {/* Content Area */}
                  <div className="p-4 flex flex-col flex-1">
                    <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-semibold truncate">
                      {p.categoryName || 'Geral'}
                    </div>
                    <h3 className="font-medium text-gray-900 text-sm leading-snug line-clamp-2 mb-3 min-h-[2.5rem]" title={p.name}>
                      {p.name}
                    </h3>
                    
                    <div className="mt-auto pt-3 border-t border-dashed border-gray-100">
                      {hasCustomPricing ? (
                        <div className="space-y-1.5 mb-3">
                          {price4 !== null && (
                            <div className="flex justify-between items-baseline">
                               <span className="text-[10px] uppercase font-bold text-gray-400">(P/Levar)</span>
                               <span className="text-sm font-bold text-green-700">{price4.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
                            </div>
                          )}
                          {price5 !== null && (
                            <div className="flex justify-between items-baseline">
                               <span className="text-[10px] uppercase font-bold text-gray-400">(P/Instalar)</span>
                               <span className="text-sm font-bold text-blue-700">{price5.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col mb-3">
                          <span className="text-[10px] text-gray-400 font-medium uppercase">A partir de</span>
                          <span className="text-lg font-bold text-gray-900">{defaultPrice.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
                        </div>
                      )}
                      
                      <a 
                        href={
                          (store?.catalogWhatsapp || store?.phone) && !isUnavailable
                          ? `https://wa.me/55${(store.catalogWhatsapp || store.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Olá, tenho interesse no produto: ${p.name}`)}`
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
                <h2 className="text-lg font-bold text-gray-900">{store?.name || 'Sua Loja'}</h2>
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
