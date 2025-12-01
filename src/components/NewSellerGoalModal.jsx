import React, { useMemo, useState } from 'react'
import { addGoal } from '../services/goals'

export default function NewSellerGoalModal({ open, onClose, storeId, sellers = [] }){
  const [sellerId, setSellerId] = useState('')
  const [monthYear, setMonthYear] = useState('')
  const [target, setTarget] = useState('R$ 0,00')
  const [saving, setSaving] = useState(false)

  const sellerOptions = useMemo(() => sellers.map(s => ({ id: s.id, name: s.name || '-' })), [sellers])

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
    const mmYY = monthYear.trim()
    if (!storeId || !sellerId || !mmYY || !/^(0?[1-9]|1[0-2])\/(\d{4})$/.test(mmYY)) return
    const tgt = Number(String(target).replace(/[^0-9.,]/g,'').replace('.', '').replace(',', '.'))
    const sellerName = sellerOptions.find(s => s.id===sellerId)?.name || ''
    setSaving(true)
    try {
      await addGoal({ monthYear: mmYY, target: tgt, includeSale: true, includeServiceOrder: false, sellerId, sellerName }, storeId)
      onClose && onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-[95vw] max-w-[560px]">
        <div className="px-4 py-3 border-b">
          <h3 className="text-base font-medium">Definir Meta</h3>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-gray-600">Vendedor</label>
            <div className="mt-1">
              <select value={sellerId} onChange={e=>setSellerId(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
                <option value="">Selecione...</option>
                {sellerOptions.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
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
        </div>
        <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
          <button className="px-3 py-2 text-sm rounded border" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="px-3 py-2 text-sm rounded bg-green-600 text-white" onClick={handleConfirm} disabled={saving}>Confirmar</button>
        </div>
      </div>
    </div>
  )
}

