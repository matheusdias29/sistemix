import React, { useState } from 'react'
import { addGoal } from '../services/goals'

export default function NewGoalModal({ open, onClose, storeId, initialType }){
  const [monthYear, setMonthYear] = useState('')
  const [target, setTarget] = useState('R$ 0,00')
  const [type, setType] = useState('sale') // sale | os
  const [saving, setSaving] = useState(false)

  // Atualiza estados quando modal abre com novo initialType
  React.useEffect(() => {
    if (open) {
      if (initialType === 'sale') setType('sale')
      else if (initialType === 'os') setType('os')
      else setType('sale') // Default for 'all'
    }
  }, [open, initialType])

  if (!open) return null

  function formatBRLInput(value){
    const raw = String(value).replace(/\D/g, '')
    const digits = raw.replace(/^0+/, '') || '0'
    const intPart = digits.length > 2 ? digits.slice(0, -2) : '0'
    const decPart = digits.slice(-2).padStart(2, '0')
    const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return `R$ ${withThousands},${decPart}`
  }

  async function handleConfirm(){
    if (!storeId) return onClose && onClose()
    const mmYY = monthYear.trim()
    if (!mmYY || !/^(0?[1-9]|1[0-2])\/(\d{4})$/.test(mmYY)) return
    const tgt = Number(String(target).replace(/[^0-9.,]/g,'').replace('.', '').replace(',', '.'))
    setSaving(true)
    try {
      await addGoal({ 
        monthYear: mmYY, 
        target: tgt, 
        includeSale: type === 'sale', 
        includeServiceOrder: type === 'os' 
      }, storeId)
      onClose && onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg w-[95vw] max-w-[520px]">
        <div className="px-4 py-3 border-b dark:border-gray-700">
          <h3 className="text-base font-medium dark:text-white">Definir Meta</h3>
        </div>
        <div className="p-4 space-y-3">
          {/* Se não for específico, permite escolher */}
          {(!initialType || initialType === 'all') && (
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400">Tipo</label>
              <div className="flex items-center gap-4 mt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="goalType" 
                    checked={type === 'sale'} 
                    onChange={() => setType('sale')}
                    className="text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm dark:text-gray-300">Venda</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="goalType" 
                    checked={type === 'os'} 
                    onChange={() => setType('os')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm dark:text-gray-300">Ordem de Serviço</span>
                </label>
              </div>
            </div>
          )}
          
          {/* Se for específico, mostra apenas informativo (ou nada) */}
          {(initialType === 'sale' || initialType === 'os') && (
             <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
               Tipo: <span className={initialType === 'sale' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}>
                 {initialType === 'sale' ? 'Venda' : 'Ordem de Serviço'}
               </span>
             </div>
          )}

          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400">Mês / Ano</label>
            <input
              value={monthYear}
              onChange={e=>setMonthYear(e.target.value)}
              placeholder="MM/AAAA"
              className="mt-1 w-full border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400">Meta</label>
            <input
              value={target}
              onChange={e=>setTarget(formatBRLInput(e.target.value))}
              placeholder="R$ 0,00"
              className="mt-1 w-full border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
            />
          </div>
        </div>
        <div className="px-4 py-3 border-t dark:border-gray-700 flex items-center justify-end gap-2">
          <button className="px-3 py-2 text-sm rounded border dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="px-3 py-2 text-sm rounded bg-green-600 text-white hover:bg-green-700 transition-colors" onClick={handleConfirm} disabled={saving}>Confirmar</button>
        </div>
      </div>
    </div>
  )
}
