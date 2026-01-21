import React, { useEffect, useState } from 'react'
import { updateGoal, removeGoal } from '../services/goals'
import Switch from './Switch'

export default function EditGoalModal({ open, onClose, goal }){
  const [monthYear, setMonthYear] = useState('')
  const [target, setTarget] = useState('R$ 0,00')
  const [includeSale, setIncludeSale] = useState(false)
  const [includeServiceOrder, setIncludeServiceOrder] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (goal) {
      setMonthYear(goal.monthYear || '')
      const t = Number(goal.target || 0)
      const formatted = t.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      // Normalize to input mask format (ensure R$ prefix and , as decimal)
      setTarget(formatted)
      setIncludeSale(!!goal.includeSale)
      setIncludeServiceOrder(!!goal.includeServiceOrder)
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
      await updateGoal(goal.id, { monthYear: mmYY, target: tgt, includeSale, includeServiceOrder })
      onClose && onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(){
    if (!goal?.id) return
    if (window.confirm('Tem certeza que deseja excluir esta meta?')) {
      setSaving(true)
      try {
        await removeGoal(goal.id)
        onClose && onClose()
      } catch (error) {
        console.error('Erro ao excluir meta:', error)
        alert('Erro ao excluir meta')
      } finally {
        setSaving(false)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-[95vw] max-w-[520px]">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="text-base font-medium">Editar Meta</h3>
          <button 
            onClick={handleDelete} 
            className="text-red-500 hover:text-red-700 p-1" 
            title="Excluir meta"
            disabled={saving}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-gray-600">Mês / Ano</label>
            <input
              value={monthYear}
              onChange={e=>setMonthYear(e.target.value)}
              placeholder="MM/AAAA"
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Meta</label>
            <input
              value={target}
              onChange={e=>setTarget(formatBRLInput(e.target.value))}
              placeholder="R$ 0,00"
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="pt-2">
            <div className="text-xs text-gray-600 mb-2">Escolha os registros que deseja incluir:</div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Venda</span>
                <Switch checked={includeSale} onChange={setIncludeSale} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Ordem de Serviço</span>
                <Switch checked={includeServiceOrder} onChange={setIncludeServiceOrder} />
              </div>
            </div>
          </div>
        </div>
        <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
          <button className="px-3 py-2 text-sm rounded border" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="px-3 py-2 text-sm rounded bg-green-600 text-white" onClick={handleConfirm} disabled={saving}>Salvar</button>
        </div>
      </div>
    </div>
  )
}
