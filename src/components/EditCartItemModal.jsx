import React, { useState, useEffect } from 'react'

export default function EditCartItemModal({ open, onClose, item, onSave, onRemove }) {
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [discountPercent, setDiscountPercent] = useState('')
  const [discountValue, setDiscountValue] = useState('')

  useEffect(() => {
    if (open && item) {
      setQuantity(item.quantity)
      setPrice(item.price)
      setDiscountPercent(item.discountPercent || 0)
      setDiscountValue(item.discountValue || 0)
    }
  }, [open, item])

  if (!open || !item) return null

  const handlePriceChange = (val) => {
    setPrice(val)
    const p = parseFloat(val)
    const dPct = parseFloat(discountPercent)
    if (!isNaN(p) && !isNaN(dPct)) {
      const dVal = p * (dPct / 100)
      setDiscountValue(dVal.toFixed(2))
    }
  }

  const handlePercentChange = (val) => {
    setDiscountPercent(val)
    const pct = parseFloat(val)
    const p = parseFloat(price)
    if (!isNaN(pct) && !isNaN(p)) {
      const dVal = p * (pct / 100)
      setDiscountValue(dVal.toFixed(2))
    }
  }

  const handleValueChange = (val) => {
    setDiscountValue(val)
    const v = parseFloat(val)
    const p = parseFloat(price)
    if (!isNaN(v) && !isNaN(p) && p !== 0) {
      const pct = (v / p) * 100
      setDiscountPercent(pct.toFixed(2))
    }
  }

  const handleConfirm = () => {
    onSave(
      Number(quantity), 
      Number(price), 
      Number(discountPercent), 
      Number(discountValue)
    )
  }

  const q = parseFloat(quantity) || 0
  const p = parseFloat(price) || 0
  const dVal = parseFloat(discountValue) || 0
  
  const subtotal = q * p
  const totalDiscount = dVal * q
  const total = (p - dVal) * q

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-in fade-in zoom-in duration-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Editar Produto</h3>
        <p className="text-sm text-gray-800 font-bold mb-6 uppercase border-b pb-4">{item.product.name}</p>

        <div className="grid grid-cols-2 gap-4 mb-2">
          <div className="bg-gray-100 rounded p-2">
             <label className="block text-xs text-gray-500 text-right mb-1">Quantidade</label>
             <input
               type="number"
               min="1"
               value={quantity}
               onChange={e => setQuantity(e.target.value)}
               className="w-full bg-transparent border-none text-right font-medium focus:ring-0 p-0 text-gray-800"
             />
          </div>
          <div className="bg-gray-100 rounded p-2">
             <label className="block text-xs text-gray-500 text-right mb-1">Preço</label>
             <input
               type="number"
               step="0.01"
               value={price}
               onChange={e => handlePriceChange(e.target.value)}
               className="w-full bg-transparent border-none text-right font-medium focus:ring-0 p-0 text-gray-800"
             />
          </div>
        </div>

        <div className="flex justify-between items-center mb-4 px-1">
          <span className="text-gray-600">Subtotal</span>
          <span className="text-xl font-medium text-gray-800">
            {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-gray-100 rounded p-2">
            <label className="block text-xs text-gray-500 text-right mb-1">Desc. item (%)</label>
            <input
               type="number"
               step="0.01"
               value={discountPercent}
               onChange={e => handlePercentChange(e.target.value)}
               className="w-full bg-transparent border-none text-right font-medium focus:ring-0 p-0 text-gray-800"
            />
          </div>
          <div className="bg-gray-100 rounded p-2">
            <label className="block text-xs text-gray-500 text-right mb-1">Desc. item (R$)</label>
            <input
               type="number"
               step="0.01"
               value={discountValue}
               onChange={e => handleValueChange(e.target.value)}
               className="w-full bg-transparent border-none text-right font-medium focus:ring-0 p-0 text-gray-800"
            />
          </div>
          <div className="bg-gray-100 rounded p-2">
            <label className="block text-xs text-gray-500 text-right mb-1">Total desc. (R$)</label>
            <div className="w-full text-right font-medium text-gray-800">
                {totalDiscount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 mb-6 px-1">
          <span className="text-lg font-medium text-gray-800">Total</span>
          <span className="text-3xl font-bold text-green-600">
            {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="flex justify-between gap-3 pt-4 border-t">
          {onRemove && (
            <button
              onClick={onRemove}
              className="flex items-center gap-2 text-gray-500 hover:text-red-600 text-sm transition-colors"
            >
              🗑️ Remover
            </button>
          )}
          <div className="flex gap-4 ml-auto">
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
            >
              ✕ Cancelar
            </button>
            <button
              onClick={handleConfirm}
              className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
            >
              ✓ Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
