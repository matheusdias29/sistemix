import React, { useState, useEffect } from 'react'
import SelectCategoryModal from './SelectCategoryModal'
import SelectSupplierModal from './SelectSupplierModal'

export default function ProductsFilterModal({ 
  open, 
  onClose, 
  onFilter, 
  categories = [], 
  suppliers = [],
  initialFilters = {}
}) {
  const [categoryId, setCategoryId] = useState('')
  const [supplierName, setSupplierName] = useState('')

  const [origin, setOrigin] = useState('')
  const [ncm, setNcm] = useState('')
  const [cest, setCest] = useState('')
  const [validityStart, setValidityStart] = useState('')
  const [validityEnd, setValidityEnd] = useState('')
  const [lowStock, setLowStock] = useState(false)
  const [noStock, setNoStock] = useState(false)
  const [status, setStatus] = useState('active') // 'active', 'inactive', 'all' ?? Image shows "Ativo" (green check) and "Inativo" (gray). It seems like a toggle or single select. 
  // Actually image shows "Status" with "Ativo" (green) and "Inativo" (gray). 
  // If I click Inativo, does it toggle? Usually filters allow "All", "Active only", "Inactive only".
  // The image shows "Ativo" selected. I'll assume it allows selecting one or both? 
  // Or maybe it's a tri-state? Let's implement as a selection: Active, Inactive, or Both (if neither selected? or both selected?).
  // Let's assume default is "Ativo" selected. If user clicks "Inativo", maybe it switches?
  // I'll implement as two toggle buttons.
  const [filterActive, setFilterActive] = useState(true)
  const [filterInactive, setFilterInactive] = useState(false)

  // Selectors visibility
  const [catSelectOpen, setCatSelectOpen] = useState(false)
  const [supSelectOpen, setSupSelectOpen] = useState(false)

  useEffect(() => {
    if (open) {
      // Load initial filters if any
      if (initialFilters) {
        setCategoryId(initialFilters.categoryId || '')
        setSupplierName(initialFilters.supplier || '')
        setOrigin(initialFilters.origin || '')
        setNcm(initialFilters.ncm || '')
        setCest(initialFilters.cest || '')
        setValidityStart(initialFilters.validityStart || '')
        setValidityEnd(initialFilters.validityEnd || '')
        setLowStock(!!initialFilters.lowStock)
        setNoStock(!!initialFilters.noStock)
        setFilterActive(initialFilters.filterActive ?? true)
        setFilterInactive(initialFilters.filterInactive ?? false)
      }
    }
  }, [open, initialFilters])

  if (!open) return null

  const handleApply = () => {
    onFilter({
      categoryId,
      supplier: supplierName,
      origin,
      ncm,
      cest,
      validityStart,
      validityEnd,
      lowStock,
      noStock,
      filterActive,
      filterInactive
    })
    onClose()
  }

  const handleClear = () => {
    setCategoryId('')
    setSupplierName('')
    setOrigin('')
    setNcm('')
    setCest('')
    setValidityStart('')
    setValidityEnd('')
    setLowStock(false)
    setNoStock(false)
    setFilterActive(true)
    setFilterInactive(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Filtrar</h3>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          
          {/* Categoria */}
          <div className="relative">
            <button 
              type="button"
              onClick={() => { setCatSelectOpen(true); }}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <span className={categoryId ? "text-gray-900 font-medium" : "text-gray-500"}>
                {categoryId ? (categories.find(c => c.id === categoryId)?.name || 'Categoria não encontrada') : 'Categoria'}
              </span>
              <span className="text-gray-400">›</span>
            </button>
          </div>

          {/* Fornecedor */}
          <div className="relative">
            <button 
              type="button"
              onClick={() => { setSupSelectOpen(true); }}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <span className={supplierName ? "text-gray-900 font-medium" : "text-gray-500"}>
                {supplierName || 'Fornecedor'}
              </span>
              <span className="text-gray-400">›</span>
            </button>
          </div>

          {/* Origem da mercadoria */}
          <div className="relative">
            <select 
              value={origin} 
              onChange={e => setOrigin(e.target.value)}
              className="w-full appearance-none px-4 py-3 bg-gray-50 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-green-500"
            >
              <option value="">Origem da mercadoria</option>
              <option value="0">0 - Nacional</option>
              <option value="1">1 - Estrangeira (Importação direta)</option>
              <option value="2">2 - Estrangeira (Adquirida no mercado interno)</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* NCM & CEST */}
          <div className="grid grid-cols-2 gap-4">
            <input 
              value={ncm}
              onChange={e => setNcm(e.target.value)}
              placeholder="NCM"
              className="px-4 py-3 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <input 
              value={cest}
              onChange={e => setCest(e.target.value)}
              placeholder="CEST"
              className="px-4 py-3 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          {/* Validade */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1 ml-1">Validade inicial</label>
              <div className="relative">
                <input 
                  type="date"
                  value={validityStart}
                  onChange={e => setValidityStart(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 ml-1">Validade final</label>
              <div className="relative">
                <input 
                  type="date"
                  value={validityEnd}
                  onChange={e => setValidityEnd(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
            </div>
          </div>

          {/* Toggles Estoque */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3">
              <button 
                type="button" 
                onClick={() => setLowStock(!lowStock)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${lowStock ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${lowStock ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="text-sm text-gray-700">Com estoque baixo</span>
            </div>

            <div className="flex items-center gap-3">
              <button 
                type="button" 
                onClick={() => setNoStock(!noStock)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${noStock ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${noStock ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="text-sm text-gray-700">Sem estoque</span>
            </div>
          </div>

          {/* Status */}
          <div className="pt-2">
            <div className="text-sm font-medium text-gray-700 mb-2">Status</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFilterActive(!filterActive)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                  filterActive 
                    ? 'bg-green-100 text-green-800 ring-1 ring-green-200' 
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {filterActive && <span>✓</span>}
                Ativo
              </button>
              
              <button
                type="button"
                onClick={() => setFilterInactive(!filterInactive)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                  filterInactive 
                    ? 'bg-green-100 text-green-800 ring-1 ring-green-200' 
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {filterInactive && <span>✓</span>}
                Inativo
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end items-center gap-4">
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-sm font-medium"
          >
            ✕ Cancelar
          </button>
          <button 
            onClick={handleApply}
            className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Filtrar
          </button>
        </div>
      </div>
      
      <SelectCategoryModal
        open={catSelectOpen}
        onClose={() => setCatSelectOpen(false)}
        onSelect={(c) => { 
           // If c is null, it means clear
           setCategoryId(c ? c.id : '')
           setCatSelectOpen(false)
        }}
        categories={categories}
        onNew={null} // No "New" button in filter
      />
      
      <SelectSupplierModal
        open={supSelectOpen}
        onClose={() => setSupSelectOpen(false)}
        onSelect={(s) => { 
           setSupplierName(s ? s.name : '')
           setSupSelectOpen(false)
        }}
        suppliers={suppliers}
        onNew={null} // No "New" button in filter
      />
    </div>
  )
}
