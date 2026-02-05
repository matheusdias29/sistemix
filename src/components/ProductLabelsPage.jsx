import React, { useState, useMemo } from 'react'
import ProductsFilterModal from './ProductsFilterModal'
import SelectVariationModal from './SelectVariationModal'

export default function ProductLabelsPage({ 
  products = [], 
  categories = [], 
  suppliers = [], 
  onBack 
}) {
  const [query, setQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState({})
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedItems, setSelectedItems] = useState([]) // { product, variation?, qty }
  const [labelModel, setLabelModel] = useState('a4_gondola')
  
  // Variation Modal
  const [varModalOpen, setVarModalOpen] = useState(false)
  const [targetProduct, setTargetProduct] = useState(null)
  const filteredProducts = useMemo(() => {
    let res = products.filter(p => (p.name || '').toLowerCase().includes(query.trim().toLowerCase()))

    // Apply filters
    if (activeFilters.categoryId) {
       res = res.filter(p => p.categoryId === activeFilters.categoryId)
    }
    if (activeFilters.supplier) {
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
    const fActive = activeFilters.filterActive ?? true 
    const fInactive = activeFilters.filterInactive ?? false 
    
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

  const handleAdd = (product) => {
    // Check variations
    if (product.variationsData && product.variationsData.length > 0) {
      setTargetProduct(product)
      setVarModalOpen(true)
      return
    }

    // If exists, increment quantity
    if (selectedItems.find(i => i.product.id === product.id)) {
      setSelectedItems(selectedItems.map(i => 
        i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i
      ))
      return
    }
    
    setSelectedItems([...selectedItems, { product, qty: 1 }])
  }

  const handleVariationSelect = (variation) => {
    if (!targetProduct) return
    
    const uid = `${targetProduct.id}-${variation.name}` 
    
    // If exists, increment quantity
    if (selectedItems.find(i => (i.uid || i.product.id) === uid)) {
      setSelectedItems(selectedItems.map(i => 
        (i.uid || i.product.id) === uid ? { ...i, qty: i.qty + 1 } : i
      ))
      setVarModalOpen(false)
      setTargetProduct(null)
      return
    }

    const newItem = { 
       product: targetProduct, 
       variation, 
       qty: 1,
       uid
    }
    
    setSelectedItems([...selectedItems, newItem])
    setVarModalOpen(false)
    setTargetProduct(null)
  }

  const handleRemove = (uid) => {
    setSelectedItems(selectedItems.filter(i => (i.uid || i.product.id) !== uid))
  }

  const handleQtyChange = (uid, val) => {
    const qty = parseInt(val) || 0
    setSelectedItems(selectedItems.map(i => (i.uid || i.product.id) === uid ? { ...i, qty } : i))
  }

  const totalLabels = selectedItems.reduce((acc, curr) => acc + curr.qty, 0)

  return (
    <div className="flex flex-col h-full animate-fadeIn">
      {/* Header / Top Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 w-full md:w-auto">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded text-gray-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          )}
          <div className="relative flex-1 md:w-80">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
               </svg>
            </span>
            <input 
              type="text"
              placeholder="Pesquisar..."
              className="w-full pl-9 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setFilterOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-700 bg-white"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filtros
          </button>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex flex-col text-sm text-gray-500">
            <span className="text-xs">Modelo</span>
            <select 
              className="border-none bg-transparent font-medium text-gray-700 focus:ring-0 p-0 cursor-pointer"
              value={labelModel}
              onChange={e => setLabelModel(e.target.value)}
            >
              <option value="a4_gondola">Papel A4 normal para gôndola</option>
              <option value="termica_gondola">Térmica 40mm para gôndola</option>
              <option value="termica_produto">Térmica para produto</option>
            </select>
          </div>
          <button className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium shadow-sm transition-colors">
            Gerar
          </button>
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0 overflow-hidden">
        
        {/* Left: Product Selection */}
        <div className="bg-white rounded-lg shadow border flex flex-col min-h-0">
          <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">
              {filteredProducts.length} produtos encontrados
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10 text-xs text-gray-500 uppercase font-medium">
                <tr>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredProducts.map(product => (
                  <tr 
                    key={product.id} 
                    className="hover:bg-gray-50 group cursor-pointer"
                    onClick={() => handleAdd(product)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800 flex items-center gap-2">
                        {product.name}
                        {product.variationsData && product.variationsData.length > 0 && (
                          <span className="text-xs text-gray-500 font-normal">
                             {product.variationsData.length} variações
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">Estoque: {product.stock || 0}</div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                       {product.salePrice ? Number(product.salePrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        className="p-1 rounded hover:bg-green-100 text-green-600 transition-colors"
                        title="Adicionar"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan="3" className="px-4 py-8 text-center text-gray-500">
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Selected for Labels */}
        <div className="bg-white rounded-lg shadow border flex flex-col min-h-0">
          <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
             <span className="text-sm font-medium text-gray-600">
               {selectedItems.length} produtos selecionados, {totalLabels} etiquetas pendentes
             </span>
             {selectedItems.length > 0 && (
               <button 
                 onClick={() => setSelectedItems([])}
                 className="text-red-500 hover:text-red-700"
                 title="Limpar tudo"
               >
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                 </svg>
               </button>
             )}
          </div>

          <div className="flex-1 overflow-y-auto">
             <table className="w-full text-left border-collapse">
               <thead className="bg-gray-50 sticky top-0 z-10 text-xs text-gray-500 uppercase font-medium">
                 <tr>
                   <th className="px-4 py-3">Descrição</th>
                   <th className="px-4 py-3 text-right w-32">Nº etiquetas</th>
                   <th className="px-4 py-3 w-10"></th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 text-sm">
                 {selectedItems.map((item) => (
                   <tr key={item.uid || item.product.id} className="hover:bg-gray-50">
                     <td className="px-4 py-3">
                       <div className="font-medium text-gray-800">
                         {item.product.name}
                         {item.variation && (
                           <span className="text-gray-500 ml-1">- {item.variation.name}</span>
                         )}
                       </div>
                     </td>
                     <td className="px-4 py-3 text-right">
                       <input 
                         type="number"
                         min="1"
                         className="w-20 text-right border rounded px-2 py-1 focus:ring-green-500 focus:border-green-500"
                         value={item.qty}
                         onChange={(e) => handleQtyChange(item.uid || item.product.id, e.target.value)}
                       />
                     </td>
                     <td className="px-4 py-3 text-right">
                       <button 
                         onClick={() => handleRemove(item.uid || item.product.id)}
                         className="p-1 rounded hover:bg-red-50 text-red-500 transition-colors"
                         title="Remover"
                       >
                         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                         </svg>
                       </button>
                     </td>
                   </tr>
                 ))}
                 {selectedItems.length === 0 && (
                   <tr>
                     <td colSpan="3" className="px-4 py-8 text-center text-gray-500">
                       Nenhum produto selecionado.
                     </td>
                   </tr>
                 )}
               </tbody>
             </table>
          </div>
        </div>
      </div>

      <ProductsFilterModal 
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={filters => {
          setActiveFilters(filters)
          setFilterOpen(false)
        }}
        initialFilters={activeFilters}
        categories={categories}
        suppliers={suppliers}
      />

      <SelectVariationModal
        open={varModalOpen}
        onClose={() => { setVarModalOpen(false); setTargetProduct(null); }}
        product={targetProduct}
        onChoose={handleVariationSelect}
      />
    </div>
  )
}
