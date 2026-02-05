import React, { useState, useEffect } from 'react'
import { updateStore } from '../services/stores'

export default function CommissionsSettingsModal({ store, onClose }) {
  const [salesAttendantPercent, setSalesAttendantPercent] = useState('')
  const [osTechnicianPercent, setOsTechnicianPercent] = useState('')
  const [osAttendantPercent, setOsAttendantPercent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (store?.commissionsSettings) {
      setSalesAttendantPercent(store.commissionsSettings.salesAttendantPercent ?? '')
      setOsTechnicianPercent(store.commissionsSettings.osTechnicianPercent ?? '')
      setOsAttendantPercent(store.commissionsSettings.osAttendantPercent ?? '')
    }
  }, [store])

  const handleSave = async () => {
    setSaving(true)
    try {
      const settings = {
        salesAttendantPercent: Number(salesAttendantPercent) || 0,
        osTechnicianPercent: Number(osTechnicianPercent) || 0,
        osAttendantPercent: Number(osAttendantPercent) || 0
      }
      
      await updateStore(store.id, {
        commissionsSettings: settings
      })
      
      onClose()
    } catch (error) {
      console.error(error)
      alert('Erro ao salvar configurações de comissão')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-[95vw] max-w-[500px] overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-semibold text-lg text-gray-800">Configuração de Comissões</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-700 border-b pb-2">Vendas de Produtos</h4>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Comissão do Atendente (%)</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={salesAttendantPercent}
                  onChange={e => setSalesAttendantPercent(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all pl-3 pr-8"
                  placeholder="0.0"
                />
                <span className="absolute right-3 top-2 text-gray-400 text-sm">%</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Porcentagem aplicada sobre o valor total dos produtos vendidos.</p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-700 border-b pb-2">Ordens de Serviço (O.S.)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Comissão do Técnico (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={osTechnicianPercent}
                    onChange={e => setOsTechnicianPercent(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all pl-3 pr-8"
                    placeholder="0.0"
                  />
                  <span className="absolute right-3 top-2 text-gray-400 text-sm">%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Comissão do Atendente (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={osAttendantPercent}
                    onChange={e => setOsAttendantPercent(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all pl-3 pr-8"
                    placeholder="0.0"
                  />
                  <span className="absolute right-3 top-2 text-gray-400 text-sm">%</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400">Porcentagem aplicada sobre o valor dos serviços na O.S.</p>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={saving}
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </div>
    </div>
  )
}
