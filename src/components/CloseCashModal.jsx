import React, { useState, useEffect } from 'react'

export default function CloseCashModal({ open, onClose, onConfirm, financials }) {
  const [values, setValues] = useState({}) // { [method]: number }
  const [observations, setObservations] = useState('')

  // Init/Reset state when modal opens
  useEffect(() => {
    if (open) {
      setValues({})
      setObservations('')
    }
  }, [open])

  if (!open) return null

  const methods = Object.keys(financials.methods || {})
  
  // Calculate totals
  const totalRegistered = methods.reduce((acc, m) => acc + (financials.methods[m] || 0), 0)
  const totalInformado = methods.reduce((acc, m) => acc + (values[m] !== undefined ? values[m] : 0), 0)
  const totalDiff = totalInformado - totalRegistered

  const handleAutoFill = () => {
    const newValues = {}
    methods.forEach(m => {
      newValues[m] = financials.methods[m] || 0
    })
    setValues(newValues)
  }

  const handleSave = () => {
    // Validate if necessary? For now just confirm even with diffs
    const closingData = {
      registered: financials.methods,
      informed: values,
      difference: methods.reduce((acc, m) => {
        const reg = financials.methods[m] || 0
        const inf = values[m] !== undefined ? values[m] : 0
        acc[m] = inf - reg
        return acc
      }, {}),
      observations,
      totalRegistered,
      totalInformado
    }
    onConfirm(closingData)
  }

  const formatMoney = (v) => Number(v||0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Fechamento de caixa</h2>
          <p className="text-sm text-gray-600 mt-1">Informe os valores por meio de pagamento:</p>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="border rounded-lg overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                <tr>
                  <th className="py-3 px-4 text-left">Meio de pagamento</th>
                  <th className="py-3 px-4 text-right">Valor registrado</th>
                  <th className="py-3 px-4 text-right bg-gray-100">Valor informado</th>
                  <th className="py-3 px-4 text-right">Diferença</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {methods.map(method => {
                  const registered = financials.methods[method] || 0
                  const informed = values[method]
                  const hasInformed = informed !== undefined
                  const diff = (informed || 0) - registered
                  
                  return (
                    <tr key={method}>
                      <td className="py-3 px-4 text-gray-800">{method}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{formatMoney(registered)}</td>
                      <td className="py-3 px-4 text-right bg-gray-50">
                        <input
                          type="number"
                          step="0.01"
                          className="w-24 text-right border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-green-500 outline-none"
                          placeholder="0,00"
                          value={hasInformed ? informed : ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : parseFloat(e.target.value)
                            setValues(prev => ({ ...prev, [method]: val }))
                          }}
                        />
                      </td>
                      <td className={`py-3 px-4 text-right font-medium ${diff < 0 ? 'text-red-600' : diff > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatMoney(diff)}
                      </td>
                    </tr>
                  )
                })}
                
                {/* Total Row */}
                <tr className="bg-gray-50 font-semibold">
                  <td className="py-3 px-4 text-gray-800">Total</td>
                  <td className="py-3 px-4 text-right text-gray-800">{formatMoney(totalRegistered)}</td>
                  <td className="py-3 px-4 text-right text-gray-800">{/* Sum of inputs if needed, or empty */}</td>
                  <td className="py-3 px-4 text-right"></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mb-6">
            <button 
              onClick={handleAutoFill}
              className="text-xs font-medium text-gray-500 hover:text-green-600 transition-colors"
            >
              Preencher Automaticamente
            </button>
          </div>

          <div>
            <textarea
              className="w-full border rounded-lg p-3 text-sm focus:ring-1 focus:ring-green-500 outline-none bg-gray-50"
              rows={3}
              placeholder="Observações"
              value={observations}
              onChange={e => setObservations(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium"
          >
            × Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded text-sm font-medium shadow-sm transition-colors"
          >
            ✓ Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
