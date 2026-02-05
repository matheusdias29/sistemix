import React, { useState } from 'react'
import { updateOrder, deleteOrder } from '../services/orders'
import { updateProduct } from '../services/products'
import { recordStockMovement } from '../services/stockMovements'
import ShareSaleModal from './ShareSaleModal'

export default function SaleDetailModal({ open, onClose, sale, onEdit, onView, storeId, store, products = [], user }) {
  if (!open || !sale) return null
  const isOwner = !user?.memberId
  const perms = user?.permissions || {}
  const [shareModalOpen, setShareModalOpen] = useState(false)

  const isOS = sale.type === 'service_order' || (sale.status && (sale.status.includes('Os Finalizada') || sale.status.includes('Os Faturada')))

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
      <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b dark:border-gray-700 flex items-start justify-between bg-white dark:bg-gray-800">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">{isOS ? 'Ordem de Serviço' : 'Venda'} {formatSaleNumber(sale)}</h2>
            <div className="text-4xl font-bold text-green-600 dark:text-green-500 mt-2">
              {money(sale.total || sale.valor)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
              <span>{formatDate(sale.createdAt)}</span>
              <span>|</span>
              <span>Vendedor: {sale.attendant || 'N/A'}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
             <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full text-sm font-semibold">
               {sale.status || 'Venda'}
             </span>
          </div>
        </div>

        {/* Actions Toolbar */}
        <div className="px-6 py-3 border-b dark:border-gray-700 flex flex-wrap gap-2 bg-gray-50 dark:bg-gray-700/50">
          {(isOwner || perms.sales?.viewAll || (user?.name && sale.attendant && user.name.toLowerCase() === sale.attendant.toLowerCase())) && (
          <button className="px-3 py-1.5 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-1">
            <span>📄</span> Recibo
          </button>
          )}
          {(isOwner || perms.sales?.viewAll || (user?.name && sale.attendant && user.name.toLowerCase() === sale.attendant.toLowerCase())) && (
          <button 
            className="px-3 py-1.5 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-1"
            onClick={() => setShareModalOpen(true)}
          >
            <span>📤</span> Compartilhar
          </button>
          )}
          {(isOwner || perms.sales?.finalize) && (
          <button className="px-3 py-1.5 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-1">
            <span>📝</span> Emitir NFCe
          </button>
          )}
          {(isOwner || perms.sales?.finalize) && (
          <button className="px-3 py-1.5 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-1">
            <span>📋</span> Criar NFe
          </button>
          )}
          {(isOwner || perms.sales?.cancel) && (
          <button
            className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded text-sm hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1"
            onClick={async () => {
              try {
                if ((sale.status || '').toLowerCase() !== 'cancelada') {
                  // Restock products
                  const items = Array.isArray(sale.products) ? sale.products : []
                  let restoredCount = 0

                  for (const it of items) {
                    const qty = Math.max(0, parseFloat(it.quantity) || 0)
                    if (qty <= 0) continue

                    let prod = products.find(p => p.id === it.id)
                    
                    // Fallback 1: Composite ID Check (BaseID-VariationName)
                    if (!prod && String(it.id).includes('-')) {
                      // Try to find a product whose ID is the prefix of the item ID
                      prod = products.find(p => String(it.id).startsWith(p.id + '-'))
                    }

                    // Fallback 2: Name Matching
                    if (!prod) {
                      const pNameRaw = String(it.name || '')
                      // Split by ' - ' to separate Base and Variation (common pattern)
                      const parts = pNameRaw.split(' - ')
                      let baseName = parts.length > 1 ? parts[0] : pNameRaw
                      
                      // Clean up potential " -- 1" suffix from base name (seen in some formats)
                      baseName = baseName.replace(/ -- \d+$/, '').trim()

                      // Try exact match
                      let candidates = products.filter(p => String(p.name || '').trim() === baseName)
                      
                      // If no exact match, try checking if product name is contained in the item name
                      if (candidates.length === 0) {
                         candidates = products.filter(p => pNameRaw.startsWith(String(p.name || '').trim()))
                      }
                      
                      if (candidates.length > 0) prod = candidates[0]
                    }

                    if (prod) {
                      console.log('Restocking product:', prod.name, 'Qty:', qty)
                      
                      // Check if it's a variation
                      let isVariation = false
                      let varName = it.variationName || null

                      // Improved variation detection strategy
                      if (Array.isArray(prod.variationsData) && prod.variationsData.length > 0) {
                        // If we don't have explicit varName, try to extract it
                        if (!varName) {
                           const pName = String(it.name || '')
                           // Sort variations by length descending to match longest possible suffix first
                           const sortedVars = [...prod.variationsData].sort((a, b) => (b.name || b.label || '').length - (a.name || a.label || '').length)
                           
                           for (const v of sortedVars) {
                             const vLabel = v.name || v.label || ''
                             // Check for " - Label" or just "Label" at the end, or if the name contains the label
                             if (vLabel && (pName.endsWith(` - ${vLabel}`) || pName.includes(vLabel))) {
                               varName = vLabel
                               break
                             }
                           }
                        }
                      }

                      if (Array.isArray(prod.variationsData) && prod.variationsData.length > 0 && varName) {
                        const idx = prod.variationsData.findIndex(v => String(v?.name || v?.label || '') === varName)
                        if (idx >= 0) {
                          isVariation = true
                          const itemsVar = prod.variationsData.map(v => ({ ...v }))
                          
                          // Determine if we should restore to Shared Stock (Base) or Own Stock
                          // Logic: If the variation has 0 stock capacity (stock + stockInitial approx 0), it uses shared stock.
                          const ownVar = itemsVar[idx]
                          
                          // If it's the base variation (idx 0), we always update it.
                          // If it's a sub-variation (idx > 0) AND has no own stock capability, we update base (idx 0).
                          const shouldUseSharedStock = idx > 0 && Number(ownVar.stock || 0) === 0 && Number(ownVar.stockInitial || 0) === 0

                          if (shouldUseSharedStock) {
                             // Restore to Base Variation (Index 0)
                             const baseCur = Number(itemsVar[0].stock ?? 0)
                             itemsVar[0].stock = Math.max(0, baseCur + qty)
                          } else {
                             // Restore to Specific Variation
                             const cur = Number(itemsVar[idx].stock ?? 0)
                             itemsVar[idx].stock = Math.max(0, cur + qty)
                          }
                          
                          // Recalculate total stock based on variations
                          const total = itemsVar.reduce((s, v) => s + (Number(v.stock ?? 0)), 0)
                          
                          await updateProduct(prod.id, { variationsData: itemsVar, stock: total })
                          restoredCount++
                          
                          await recordStockMovement({
                            productId: prod.id,
                            productName: prod.name,
                            variationId: itemsVar[idx].id || null,
                            variationName: itemsVar[idx].name || itemsVar[idx].label || varName,
                            type: 'in',
                            quantity: qty,
                            reason: 'cancel',
                            referenceId: sale.id,
                            description: `Cancelamento Venda/OS ${sale.number || sale.id}`,
                            userId: null
                          })
                        }
                      }

                      // If not identified as a variation (or simple product), update main stock
                      if (!isVariation) {
                        const cur = Number(prod.stock ?? 0)
                        const next = Math.max(0, cur + qty)
                        await updateProduct(prod.id, { stock: next })
                        restoredCount++
                        
                        await recordStockMovement({
                          productId: prod.id,
                          productName: prod.name,
                          type: 'in',
                          quantity: qty,
                          reason: 'cancel',
                          referenceId: sale.id,
                          description: `Cancelamento Venda/OS ${sale.number || sale.id}`,
                          userId: null
                        })
                      }
                    } else {
                        console.warn('Product not found for restocking:', it.name, it.id)
                    }
                  }
                  
                  if (restoredCount > 0) {
                      alert(`Venda cancelada e ${restoredCount} produto(s) devolvido(s) ao estoque.`)
                  } else {
                      alert('Venda cancelada. Nenhum produto foi devolvido ao estoque (produtos não encontrados ou serviço).')
                  }
                }
                await updateOrder(sale.id, { status: 'Cancelada' })
                onClose && onClose()
              } catch (e) {
                console.error('Erro ao cancelar venda', e)
                alert('Não foi possível cancelar a venda.')
              }
            }}
          >
            <span>🗑️</span> Cancelar
          </button>
          )}
          {(isOwner || perms.sales?.delete) && (
          <button
            className="px-3 py-1.5 bg-red-600 text-white border border-red-600 rounded text-sm hover:bg-red-700 flex items-center gap-1"
            onClick={async () => {
              const s = (sale.status || '').toLowerCase()
              // Permitir excluir se estiver cancelada ou for apenas um pedido (não faturado)
              const isSafeToDelete = s === 'cancelada' || s === 'pedido'
              
              if (!isSafeToDelete) {
                alert('Para excluir o registro, primeiro cancele a venda/O.S. para garantir o estorno do estoque e financeiro.')
                return
              }

              if (window.confirm('Tem certeza que deseja excluir permanentemente este registro? Esta ação não pode ser desfeita.')) {
                try {
                  await deleteOrder(sale.id)
                  onClose && onClose()
                } catch (e) {
                  console.error('Erro ao excluir', e)
                  alert('Erro ao excluir registro.')
                }
              }
            }}
          >
             <span>❌</span> Excluir
          </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Client */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Cliente</h3>
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <span className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400">👤</span>
              <span className="font-medium">{sale.client || 'Consumidor Final'}</span>
            </div>
          </div>

          {/* Products */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Produtos ({totalProducts})</h3>
            <div className="space-y-3">
              {sale.products?.map((p, i) => (
                <div key={i} className="flex justify-between items-start py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <div className="flex-1">
                    <div className="text-sm text-gray-800 dark:text-gray-200">
                      <span className="font-medium">{p.quantity} x</span> {p.name}
                    </div>
                    {/* If we had unit price separate from total line, we could show it here. Assuming price is unit price. */}
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {money(p.price)} un.
                    </div>
                  </div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {money(p.total || (p.price * p.quantity))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 flex justify-end">
              <div className="w-48 bg-gray-50 dark:bg-gray-700/50 p-3 rounded text-right">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-bold">Total</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{money(sale.total || sale.valor)}</span>
                </div>
                {/* Placeholder for Profit if we had it */}
                {/* <div className="text-xs text-gray-500">Lucro: R$ ...</div> */}
              </div>
            </div>
          </div>

          {/* Payments */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Pagamento</h3>
            <div className="space-y-2">
              {sale.payments?.map((pay, i) => (
                <div key={i} className="flex justify-between items-center text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <span>💳</span>
                    <span>{pay.method}</span>
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white">{money(pay.amount)}</span>
                </div>
              ))}
              {(!sale.payments || sale.payments.length === 0) && (
                <div className="text-sm text-gray-500 dark:text-gray-400 italic">Nenhum pagamento registrado</div>
              )}
            </div>
          </div>

        </div>

        {/* Footer Buttons */}
        <div className="p-4 border-t bg-gray-50 dark:bg-gray-700/50 dark:border-gray-700 flex justify-between">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white font-medium text-sm flex items-center gap-1"
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
            {onEdit && (isOwner || perms.sales?.edit) && (
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

      <ShareSaleModal 
        open={shareModalOpen} 
        onClose={() => setShareModalOpen(false)} 
        sale={sale}
        store={store}
      />
    </div>
  )
}
