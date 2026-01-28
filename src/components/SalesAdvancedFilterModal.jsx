import React, { useState, useEffect } from 'react'

export default function SalesAdvancedFilterModal({ open, onClose, onApply, initialFilters }) {
  const [filters, setFilters] = useState({
    client: '',
    attendant: '',
    supplier: '',
    product: '',
    paymentMethod: ''
  })

  useEffect(() => {
    if (open) {
      setFilters(initialFilters || {
        client: '',
        attendant: '',
        supplier: '',
        product: '',
        paymentMethod: ''
      })
    }
  }, [open, initialFilters])

  if (!open) return null

  const handleChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  const handleApply = () => {
    onApply(filters)
    onClose()
  }

  const handleClear = () => {
    const cleared = {
      client: '',
      attendant: '',
      supplier: '',
      product: '',
      paymentMethod: ''
    }
    setFilters(cleared)
    // Optionally apply immediately or wait for "Filtrar"
    // The UI shows "Limpar Filtros" as a separate action, likely clearing form.
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Filtrar</h3>
        </div>
        
        <div className="p-4 overflow-y-auto space-y-4">
          {/* Cliente */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cliente</label>
            <div className="relative">
              <input 
                value={filters.client}
                onChange={e => handleChange('client', e.target.value)}
                placeholder="Nome do cliente"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-gray-50 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">&gt;</span>
            </div>
          </div>

          {/* Vendedor */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Vendedor</label>
            <div className="relative">
              <input 
                value={filters.attendant}
                onChange={e => handleChange('attendant', e.target.value)}
                placeholder="Nome do vendedor"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-gray-50 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">&gt;</span>
            </div>
          </div>

          {/* Fornecedor */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Fornecedor</label>
            <div className="relative">
              <input 
                value={filters.supplier}
                onChange={e => handleChange('supplier', e.target.value)}
                placeholder="Nome do fornecedor"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-gray-50 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">&gt;</span>
            </div>
          </div>

          {/* Produto */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Produto</label>
            <div className="relative">
              <input 
                value={filters.product}
                onChange={e => handleChange('product', e.target.value)}
                placeholder="Nome do produto"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-gray-50 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">&gt;</span>
            </div>
          </div>

          {/* Método de pagamento */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Método de pagamento</label>
            <div className="relative">
              <select
                value={filters.paymentMethod}
                onChange={e => handleChange('paymentMethod', e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500 bg-gray-50 dark:bg-gray-700 dark:text-white appearance-none"
              >
                <option value="">Todos</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">Pix</option>
                <option value="cartao_credito">Cartão de Crédito</option>
                <option value="cartao_debito">Cartão de Débito</option>
                <option value="boleto">Boleto</option>
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">&gt;</span>
            </div>
          </div>

          <div className="pt-2 text-center">
            <button 
              onClick={handleClear}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Limpar Filtros
            </button>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 dark:bg-gray-700/50 dark:border-gray-700 flex justify-between items-center gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm font-medium transition-colors"
          >
            &times; Cancelar
          </button>
          <button 
            onClick={handleApply}
            className="flex-1 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 shadow-sm transition-colors"
          >
            Filtrar
          </button>
        </div>
      </div>
    </div>
  )
}
