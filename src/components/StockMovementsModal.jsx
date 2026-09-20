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

  const getReasonLabel = (mov) => {
    const r = String(mov.reason || '').toLowerCase()
    const ref = String(mov.referenceNumber || '').trim()
    const desc = String(mov.description || '').trim()

    const normalizeNum = (s) => String(s || '').replace(/\D/g, '')
    const pad = (n) => String(n || '0').padStart(4, '0')

    // ================================================================
    // 1) PRIORIDADE ALTA: Detectar explicitamente se refere a OS ou PV
    //    (olha referenceNumber E description, em qualquer reason)
    // ================================================================
    const osMatch = ref.match(/(OS|O\.S|o\.s|ordem)[^\d]*(\d+)/i)
    const pvMatch = ref.match(/(PV|P\.V|pv|venda)[^\d]*(\d+)/i)
    const osDescMatch = /(OS|O\.S|Ordem de Serviço|Ordem de Servico|Ordem)/i.test(desc)
    const pvDescMatch = /(PV|P\.V|Venda|Pedido de Venda)/i.test(desc)

    const digits = normalizeNum(ref)

    const isOS = !!(osMatch || osDescMatch)
    const isPV = !!(pvMatch || pvDescMatch)

    // CASO ESPECIAL: reason === 'cancel' (estorno) → decidir OS vs PV antes
    if (r === 'cancel') {
      // Prioriza o que foi explicitamente detectado
      if (isOS && !isPV) {
        const n = pad(osMatch ? osMatch[2] : digits)
        return `Cancelamento/Estorno O.S.${n}`
      }
      if (isPV && !isOS) {
        const n = pad(pvMatch ? pvMatch[2] : digits)
        return `Cancelamento/Estorno P.V.${n}`
      }
      // Ambos detectados ou nenhum → usa conteúdo de referenceNumber primeiro
      if (ref) {
        const lref = ref.toLowerCase()
        if (lref.includes('os') || lref.includes('o.s') || lref.includes('ordem')) {
          return `Cancelamento/Estorno O.S.${pad(osMatch ? osMatch[2] : digits)}`
        }
        if (lref.includes('pv') || lref.includes('p.v') || lref.includes('venda')) {
          return `Cancelamento/Estorno P.V.${pad(pvMatch ? pvMatch[2] : digits)}`
        }
      }
      // Nada detectado → usar description ou fallback genérico
      if (digits) {
        if (isOS) return `Cancelamento/Estorno O.S.${pad(digits)}`
        if (isPV) return `Cancelamento/Estorno P.V.${pad(digits)}`
        return `Cancelamento/Estorno ${pad(digits)}`
      }
      return desc ? desc.slice(0, 40) : 'Cancelamento/Estorno'
    }

    // ================================================================
    // 2) Demais reasons (sale / service_order / adjustment etc)
    // ================================================================
    if (ref || isOS || isPV) {
      if (isOS) {
        const n = pad(osMatch ? osMatch[2] : digits)
        return `O.S.${n}`
      }
      if (isPV || r === 'sale' || (r === 'adjustment' && /PV|venda/i.test(desc))) {
        const n = pad(pvMatch ? pvMatch[2] : digits)
        return `P.V.${n}`
      }
    }

    const map = {
      'sale': 'Venda',
      'manual_adjust': 'Ajuste Manual',
      'purchase': 'Compra',
      'correction': 'Correção',
      'service_order': 'Ordem de Serviço',
      'cancel': 'Cancelamento/Estorno'
    }

    if (r === 'adjustment') {
      if (desc) return desc.slice(0, 40)
      return 'Ajuste do Sistema'
    }

    return map[r] || (ref && (digits || ref)) || r || '-'
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
                    <td className="px-6 py-3 text-gray-700 font-medium">
                      {getReasonLabel(mov)}
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
