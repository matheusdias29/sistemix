import React, { useState, useEffect } from 'react'
import { listenStockMovements } from '../services/stockMovements'

export default function StockMovementsModal({ open, onClose, product }) {
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open || !product?.id) return
    
    setLoading(true)
    const unsub = listenStockMovements(product.id, (items) => {
      setMovements(items)
      setLoading(false)
    })
    
    return () => unsub && unsub()
  }, [open, product])

  if (!open || !product) return null

  const formatDate = (ts) => {
    if (!ts) return '-'
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleString('pt-BR')
  }

  const getReasonLabel = (r) => {
    const map = {
      'sale': 'Venda',
      'manual_adjust': 'Ajuste Manual',
      'purchase': 'Compra',
      'correction': 'Correção',
      'service_order': 'Ordem de Serviço',
      'cancel': 'Cancelamento/Estorno'
    }
    return map[r] || r
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-[95vw] max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Movimentações de Estoque</h3>
            <div className="text-sm text-gray-500">{product.name}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <span className="text-2xl">&times;</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : movements.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Nenhuma movimentação registrada.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b sticky top-0">
                <tr>
                  <th className="px-6 py-3">Data</th>
                  <th className="px-6 py-3">Tipo</th>
                  <th className="px-6 py-3">Qtd</th>
                  <th className="px-6 py-3">Motivo</th>
                  <th className="px-6 py-3">Precificação</th>
                  <th className="px-6 py-3">Usuário</th>
                  <th className="px-6 py-3">Obs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {movements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 whitespace-nowrap text-gray-500">
                      {formatDate(mov.createdAt || mov.date)}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        mov.type === 'in' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {mov.type === 'in' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-medium">
                      {mov.quantity}
                    </td>
                    <td className="px-6 py-3 text-gray-700">
                      {getReasonLabel(mov.reason)}
                    </td>
                    <td className="px-6 py-3 text-gray-500">
                      {mov.variationName || '-'}
                    </td>
                    <td className="px-6 py-3 text-gray-500">
                      {mov.userName || '-'}
                    </td>
                    <td className="px-6 py-3 text-gray-500 max-w-xs truncate" title={mov.description}>
                      {mov.description || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
