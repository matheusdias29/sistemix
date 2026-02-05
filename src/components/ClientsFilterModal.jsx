import React, { useState, useEffect } from 'react'

export default function ClientsFilterModal({ open, onClose, onApply, initialFilters }) {
  const [status, setStatus] = useState(null) // null, 'active', 'inactive'
  const [credit, setCredit] = useState(null) // null, 'allowed', 'denied'
  const [birthday, setBirthday] = useState(false)

  useEffect(() => {
    if (open) {
      setStatus(initialFilters?.status || null)
      setCredit(initialFilters?.credit || null)
      setBirthday(initialFilters?.birthday || false)
    }
  }, [open, initialFilters])

  if (!open) return null

  const handleApply = () => {
    onApply({ status, credit, birthday })
    onClose()
  }

  const handleClear = () => {
      setStatus(null)
      setCredit(null)
      setBirthday(false)
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[80]">
      <div className="bg-white rounded-lg shadow-lg w-[400px] max-w-[95vw] p-5">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Filtrar</h3>

        <div className="space-y-4">
          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setStatus(status === 'active' ? null : 'active')}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  status === 'active'
                    ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                ✓ Ativo
              </button>
              <button
                onClick={() => setStatus(status === 'inactive' ? null : 'inactive')}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  status === 'inactive'
                    ? 'bg-gray-300 text-gray-800 ring-1 ring-gray-400'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Inativo
              </button>
            </div>
          </div>

          {/* Crédito */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Crédito</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCredit(credit === 'allowed' ? null : 'allowed')}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  credit === 'allowed'
                    ? 'bg-gray-200 text-gray-800 ring-1 ring-gray-400 font-medium'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Permite crediário
              </button>
              <button
                onClick={() => setCredit(credit === 'denied' ? null : 'denied')}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  credit === 'denied'
                    ? 'bg-gray-200 text-gray-800 ring-1 ring-gray-400 font-medium'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Não permite
              </button>
            </div>
          </div>

          {/* Outros */}
          <div>
            <button
                onClick={() => setBirthday(!birthday)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  birthday
                    ? 'bg-gray-200 text-gray-800 ring-1 ring-gray-400 font-medium'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Aniversariantes do mês
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
            ✕ Cancelar
          </button>
          <button
            onClick={handleApply}
            className="px-6 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600 font-medium"
          >
            Filtrar
          </button>
        </div>
      </div>
    </div>
  )
}
