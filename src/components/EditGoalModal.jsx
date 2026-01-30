import React, { useEffect, useState } from 'react'
import { updateGoal, removeGoal } from '../services/goals'

export default function EditGoalModal({ open, onClose, goal }){
  const [monthYear, setMonthYear] = useState('')
  const [target, setTarget] = useState('R$ 0,00')
  const [type, setType] = useState('sale') // sale | os
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (goal) {
      setMonthYear(goal.monthYear || '')
      const t = Number(goal.target || 0)
      const formatted = t.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      setTarget(formatted)
      
      // Determine initial type
      if (goal.includeServiceOrder && !goal.includeSale) {
        setType('os')
      } else {
        setType('sale')
      }
    }
  }, [goal])

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
    if (!goal?.id) return onClose && onClose()
    const mmYY = monthYear.trim()
    if (!mmYY || !/^(0?[1-9]|1[0-2])\/(\d{4})$/.test(mmYY)) return
    const tgt = Number(String(target).replace(/[^0-9.,]/g,'').replace('.', '').replace(',', '.'))
    setSaving(true)
    try {
      await updateGoal(goal.id, { 
        monthYear: mmYY, 
        target: tgt, 
        includeSale: type === 'sale', 
        includeServiceOrder: type === 'os' 
      })
      onClose && onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(){
    if (!goal?.id) return
    if (!window.confirm('Tem certeza que deseja excluir esta meta?')) return
    setSaving(true)
    try {
      await removeGoal(goal.id)
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
          <h3 className="text-base font-medium dark:text-white">Editar Meta</h3>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400">Tipo</label>
            <div className="flex items-center gap-4 mt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="editGoalType" 
                  checked={type === 'sale'} 
                  onChange={() => setType('sale')}
                  className="text-green-600 focus:ring-green-500"
                />
                <span className="text-sm dark:text-gray-300">Venda</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="editGoalType" 
                  checked={type === 'os'} 
                  onChange={() => setType('os')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm dark:text-gray-300">Ordem de Serviço</span>
              </label>
            </div>
          </div>

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
        <div className="px-4 py-3 border-t dark:border-gray-700 flex items-center justify-between">
          <button className="px-3 py-2 text-sm rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" onClick={handleRemove} disabled={saving}>Excluir</button>
          <div className="flex gap-2">
            <button className="px-3 py-2 text-sm rounded border dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="px-3 py-2 text-sm rounded bg-green-600 text-white hover:bg-green-700 transition-colors" onClick={handleConfirm} disabled={saving}>Salvar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
