import React from 'react'

export default function SaleDetailModal({ open, onClose, sale, onEdit, onView }) {
  if (!open || !sale) return null

  const isOS = sale.type === 'service_order' || (sale.status && sale.status.includes('Os Finalizada'))

  const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  
  const formatDate = (ts) => {
    if (!ts) return ''
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleString('pt-BR')
  }

  // Calculate profit (mock logic as cost isn't always available in sale items, assuming simple calculation or placeholder)
  // If we had cost in products, we could calculate. For now, I'll just show the total.
  // The image shows "Lucro: R$ 36,30". 
  // If product has cost saved, we can calculate.
  // In NewSaleModal, we are saving: id, name, price, quantity, total. We are NOT saving cost currently in the products array of the order.
  // So I cannot calculate real profit unless I fetch products again or if cost was saved.
  // I will omit profit or show 0 for now, or just not show it if not available.
  
  const totalProducts = sale.products?.length || 0

  const formatSaleNumber = (order) => {
    const prefix = isOS ? 'O.S:' : 'PV:'
    if (order.number) {
      const digits = String(order.number).replace(/\D/g, '')
      const n = parseInt(digits, 10)
      return `${prefix}${String(n).padStart(4, '0')}`
    }
    return `${prefix}${String(order.id).slice(-4)}`
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b flex items-start justify-between bg-white">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{isOS ? 'Ordem de Serviço' : 'Venda'} {formatSaleNumber(sale)}</h2>
            <div className="text-4xl font-bold text-green-600 mt-2">
              {money(sale.total || sale.valor)}
            </div>
            <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
              <span>{formatDate(sale.createdAt)}</span>
              <span>|</span>
              <span>Vendedor: {sale.attendant || 'N/A'}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
             <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
               {sale.status || 'Venda'}
             </span>
          </div>
        </div>

        {/* Actions Toolbar */}
        <div className="px-6 py-3 border-b flex flex-wrap gap-2 bg-gray-50">
          <button className="px-3 py-1.5 bg-white border rounded text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-1">
            <span>📄</span> Recibo
          </button>
          <button className="px-3 py-1.5 bg-white border rounded text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-1">
            <span>📤</span> Compartilhar
          </button>
          <button className="px-3 py-1.5 bg-white border rounded text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-1">
            <span>📝</span> Emitir NFCe
          </button>
          <button className="px-3 py-1.5 bg-white border rounded text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-1">
            <span>📋</span> Criar NFe
          </button>
          <button className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded text-sm hover:bg-red-50 flex items-center gap-1">
            <span>🗑️</span> Cancelar
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Client */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Cliente</h3>
            <div className="flex items-center gap-2 text-gray-700">
              <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">👤</span>
              <span className="font-medium">{sale.client || 'Consumidor Final'}</span>
            </div>
          </div>

          {/* Products */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Produtos ({totalProducts})</h3>
            <div className="space-y-3">
              {sale.products?.map((p, i) => (
                <div key={i} className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0">
                  <div className="flex-1">
                    <div className="text-sm text-gray-800">
                      <span className="font-medium">{p.quantity} x</span> {p.name}
                    </div>
                    {/* If we had unit price separate from total line, we could show it here. Assuming price is unit price. */}
                    <div className="text-xs text-gray-500">
                      {money(p.price)} un.
                    </div>
                  </div>
                  <div className="font-medium text-gray-900">
                    {money(p.total || (p.price * p.quantity))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 flex justify-end">
              <div className="w-48 bg-gray-50 p-3 rounded text-right">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600 font-bold">Total</span>
                  <span className="text-lg font-bold text-gray-900">{money(sale.total || sale.valor)}</span>
                </div>
                {/* Placeholder for Profit if we had it */}
                {/* <div className="text-xs text-gray-500">Lucro: R$ ...</div> */}
              </div>
            </div>
          </div>

          {/* Payments */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Pagamento</h3>
            <div className="space-y-2">
              {sale.payments?.map((pay, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span>💳</span>
                    <span>{pay.method}</span>
                  </div>
                  <span className="font-medium text-gray-900">{money(pay.amount)}</span>
                </div>
              ))}
              {(!sale.payments || sale.payments.length === 0) && (
                <div className="text-sm text-gray-500 italic">Nenhum pagamento registrado</div>
              )}
            </div>
          </div>

        </div>

        {/* Footer Buttons */}
        <div className="p-4 border-t bg-gray-50 flex justify-between">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium text-sm flex items-center gap-1"
          >
            ← Voltar
          </button>
          <div className="flex gap-2">
            {isOS && onView && (
              <button 
                onClick={() => onView(sale)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded flex items-center gap-1"
              >
                👁️ Visualizar
              </button>
            )}
            {onEdit && (
              <button 
                onClick={() => onEdit && onEdit(sale)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium text-sm rounded"
              >
                ✎ Editar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
