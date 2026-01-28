import React, { useState, useEffect } from 'react'

const OPTIONS = [
  { label: 'Hoje', key: 'today' },
  { label: 'Ontem', key: 'yesterday' },
  { label: 'Últimos 7 Dias', key: 'last7' },
  { label: 'Este Mês', key: 'thisMonth' },
  { label: 'Último Mês', key: 'lastMonth' },
  { label: 'Personalizado', key: 'custom' },
  { label: 'Limpar Filtros', key: 'clear' },
]

export default function SalesDateFilterModal({ open, onClose, onApply, currentLabel }) {
  const [selectedKey, setSelectedKey] = useState('thisMonth')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  useEffect(() => {
    if (open) {
      // Tenta encontrar a chave baseada no label atual, senão default 'thisMonth'
      const found = OPTIONS.find(o => o.label === currentLabel)
      setSelectedKey(found ? found.key : 'thisMonth')
    }
  }, [open, currentLabel])

  if (!open) return null

  const handleSelect = (key) => {
    setSelectedKey(key)
  }

  const handleApply = () => {
    const now = new Date()
    let start = null
    let end = null
    let label = ''

    switch (selectedKey) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
        label = 'Hoje'
        break
      case 'yesterday':
        const y = new Date(now)
        y.setDate(y.getDate() - 1)
        start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0)
        end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999)
        label = 'Ontem'
        break
      case 'last7':
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
        const l7 = new Date(now)
        l7.setDate(l7.getDate() - 6) 
        start = new Date(l7.getFullYear(), l7.getMonth(), l7.getDate(), 0, 0, 0, 0)
        label = 'Últimos 7 Dias'
        break
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
        label = 'Este Mês'
        break
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
        label = 'Último Mês'
        break
      case 'custom':
        if (customStart) start = new Date(customStart + 'T00:00:00')
        if (customEnd) end = new Date(customEnd + 'T23:59:59')
        label = 'Personalizado'
        break
      case 'clear':
        label = 'Todos'
        break
      default:
        break
    }

    onApply({ label, start, end })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold text-center text-gray-800 dark:text-white">Selecione um periodo</h3>
        </div>
        
        <div className="p-4 overflow-y-auto space-y-2">
          {OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => handleSelect(opt.key)}
              className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center ${
                selectedKey === opt.key
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 border border-transparent'
              }`}
            >
              {opt.label}
            </button>
          ))}

          {selectedKey === 'custom' && (
            <div className="pt-2 flex gap-2 animate-fadeIn">
              <div className="flex-1">
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">De</label>
                <input 
                  type="date" 
                  value={customStart} 
                  onChange={e=>setCustomStart(e.target.value)}
                  className="w-full border rounded px-2 py-2 text-sm outline-none focus:border-green-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Até</label>
                <input 
                  type="date" 
                  value={customEnd} 
                  onChange={e=>setCustomEnd(e.target.value)}
                  className="w-full border rounded px-2 py-2 text-sm outline-none focus:border-green-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 dark:bg-gray-700/50 dark:border-gray-700 flex gap-3">
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
