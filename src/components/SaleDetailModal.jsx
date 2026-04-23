import React, { useEffect, useRef, useState } from 'react'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { updateOrder, deleteOrder } from '../services/orders'
import { updateProduct, getProductById } from '../services/products'
import { recordStockMovement } from '../services/stockMovements'
import ShareSaleModal from './ShareSaleModal'
import ServiceOrderPrintModal from './ServiceOrderPrintModal'

export default function SaleDetailModal({ open, onClose, sale, onEdit, onView, storeId, store, products = [], user }) {
  if (!open || !sale) return null
  const isOwner = !user?.memberId
  const perms = user?.permissions || {}
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)

  const isOS = sale.type === 'service_order' || (sale.status && (sale.status.includes('Os Finalizada') || sale.status.includes('Os Faturada')))
  const canSeeSale = isOwner || perms.sales?.viewAll || (user?.name && sale.attendant && user.name.toLowerCase() === sale.attendant.toLowerCase())
  const canPrintOsReceipt =
    isOwner ||
    perms.cash?.view ||
    perms.cash?.open ||
    perms.cash?.close ||
    perms.serviceOrders?.view ||
    perms.serviceOrders?.create ||
    perms.serviceOrders?.edit ||
    perms.serviceOrders?.delete ||
    perms.serviceOrders?.changeStatus ||
    !!user?.isTech

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
    <div className="fixed inset-0 bg-black/50 z-[3000] flex items-center justify-center p-4">
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
          {((!isOS && canSeeSale) || (isOS && canPrintOsReceipt)) && (
            <button onClick={() => setReceiptModalOpen(true)} className="px-3 py-1.5 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-1">
              <span>📄</span> Recibo
            </button>
          )}
          {canSeeSale && (
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
          {(isOwner || perms.sales?.cancel) && (sale.status?.toLowerCase() !== 'cancelada') && (
          <button
            className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded text-sm hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1"
            onClick={async () => {
              if (!window.confirm('Tem certeza que deseja cancelar esta venda? O estoque dos produtos será devolvido.')) return
              try {
                const currentStatus = (sale.status || '').toLowerCase()
                // Somente devolve estoque se o status atual for um que reservou/descontou estoque
                // De acordo com NewSaleModal.jsx, esses são: Venda, Pedido, Cliente Final, Cliente Lojista
                const statusesThatDeductStock = ['venda', 'pedido', 'cliente final', 'cliente lojista', 'finalizado', 'pago']
                const shouldRestock = statusesThatDeductStock.includes(currentStatus)

                if (shouldRestock) {
                  // Restock products - Grouping by product/variation to avoid race conditions
                  const items = Array.isArray(sale.products) ? sale.products : []
                
                // key: productId + (variationName || '')
                const restockingMap = new Map()
                
                for (const it of items) {
                  const qty = Math.max(0, parseFloat(it.quantity) || 0)
                  if (qty <= 0) continue
                  
                  const pid = String(it.id || '')
                  const vname = String(it.variationName || '').trim() || null
                  const key = vname ? `${pid}|${vname}` : pid
                  
                  if (restockingMap.has(key)) {
                    restockingMap.get(key).quantity += qty
                  } else {
                    restockingMap.set(key, { 
                      productId: pid, 
                      variationName: vname, 
                      quantity: qty,
                      originalName: it.name 
                    })
                  }
                }

                let restoredCount = 0

                for (const [key, entry] of restockingMap.entries()) {
                    const { productId, variationName, quantity, originalName } = entry
                    
                    let prod = products.find(p => p.id === productId)
                    
                    // Fallback 1: Composite ID Check (BaseID-VariationName) if ID in sale was composite
                    if (!prod && productId.includes('-')) {
                      prod = products.find(p => productId.startsWith(p.id + '-'))
                    }

                    // Fallback 2: Get from Firestore if not in cache
                    if (!prod) {
                      let pid = productId
                      if (String(pid).includes('-')) {
                        pid = String(pid).split('-')[0]
                      }
                      try {
                        prod = await getProductById(pid)
                      } catch (err) {
                        console.error('Erro ao buscar produto do banco:', err)
                      }
                    }

                    // Fallback 3: Name Matching (using originalName from sale)
                    if (!prod) {
                      const pNameRaw = String(originalName || '')
                      const parts = pNameRaw.split(' - ')
                      let baseName = parts.length > 1 ? parts[0] : pNameRaw
                      baseName = baseName.replace(/ -- \d+$/, '').trim()

                      let candidates = products.filter(p => String(p.name || '').trim() === baseName)
                      if (candidates.length === 0) {
                         candidates = products.filter(p => pNameRaw.startsWith(String(p.name || '').trim()))
                      }
                      if (candidates.length > 0) prod = candidates[0]
                    }

                    if (prod) {
                      console.log('Restocking product:', prod.name, 'Qty:', quantity)
                      
                      let isVariationUpdated = false
                      let targetVarName = variationName

                      // If variationName was not in sale, try to extract from originalName if product has variations
                      if (!targetVarName && Array.isArray(prod.variationsData) && prod.variationsData.length > 0) {
                         const pName = String(originalName || '')
                         const sortedVars = [...prod.variationsData].sort((a, b) => (b.name || b.label || '').length - (a.name || a.label || '').length)
                         for (const v of sortedVars) {
                           const vLabel = v.name || v.label || ''
                           if (vLabel && (pName.endsWith(` - ${vLabel}`) || pName.includes(vLabel))) {
                             targetVarName = vLabel
                             break
                           }
                         }
                      }

                      // Apply restocking to variationsData if applicable
                      if (Array.isArray(prod.variationsData) && prod.variationsData.length > 0 && targetVarName) {
                        const idx = prod.variationsData.findIndex(v => String(v?.name || v?.label || '') === targetVarName)
                        if (idx >= 0) {
                          isVariationUpdated = true
                          const itemsVar = prod.variationsData.map(v => ({ ...v }))
                          const ownVar = itemsVar[idx]
                          
                          // Shared Stock Logic
                          const shouldUseSharedStock = idx > 0 && Number(ownVar.stock || 0) === 0 && Number(ownVar.stockInitial || 0) === 0

                          if (shouldUseSharedStock) {
                             itemsVar[0].stock = Math.max(0, Number(itemsVar[0].stock ?? 0) + quantity)
                          } else {
                             itemsVar[idx].stock = Math.max(0, Number(itemsVar[idx].stock ?? 0) + quantity)
                          }
                          
                          const totalStock = itemsVar.reduce((s, v) => s + (Number(v.stock ?? 0)), 0)
                          
                          await updateProduct(prod.id, { variationsData: itemsVar, stock: totalStock })
                          restoredCount++
                          
                          await recordStockMovement({
                            productId: prod.id,
                            productName: prod.name,
                            variationId: itemsVar[idx].id || null,
                            variationName: itemsVar[idx].name || itemsVar[idx].label || targetVarName,
                            type: 'in',
                            quantity: quantity,
                            reason: 'cancel',
                            referenceId: sale.id,
                            description: `Cancelamento Venda/OS ${sale.number || sale.id}`,
                            userId: user?.id || null
                          })
                        }
                      }

                      // Simple product or variation not matched
                      if (!isVariationUpdated) {
                        const cur = Number(prod.stock ?? 0)
                        const next = Math.max(0, cur + quantity)
                        await updateProduct(prod.id, { stock: next })
                        restoredCount++
                        
                        await recordStockMovement({
                          productId: prod.id,
                          productName: prod.name,
                          type: 'in',
                          quantity: quantity,
                          reason: 'cancel',
                          referenceId: sale.id,
                          description: `Cancelamento Venda/OS ${sale.number || sale.id}`,
                          userId: user?.id || null
                        })
                      }
                    } else {
                        console.warn('Product not found for restocking:', originalName, productId)
                    }
                  }
                  
                  if (restoredCount > 0) {
                      alert(`Venda cancelada e ${restoredCount} produto(s) devolvido(s) ao estoque.`)
                  } else {
                      alert('Venda cancelada. Nenhum produto foi devolvido ao estoque (produtos não encontrados ou serviço).')
                  }
                } else {
                  // Se o status era orçamento/condicional, apenas cancela sem mexer no estoque
                  alert('Venda cancelada com sucesso.')
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
              // Permitir excluir apenas se já estiver cancelada, para garantir que o estoque foi devolvido via botão Cancelar
              const isSafeToDelete = s === 'cancelada'
              
              if (!isSafeToDelete) {
                alert('Para excluir o registro, primeiro cancele a venda/O.S. clicando no botão "Cancelar" para garantir o estorno do estoque e financeiro.')
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Cliente</h3>
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <span className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400">👤</span>
                <span className="font-medium">{sale.client || 'Consumidor Final'}</span>
              </div>
            </div>

            {isOS && sale.technician && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Técnico</h3>
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <span className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 dark:text-blue-400">🛠️</span>
                  <span className="font-medium">{sale.technician}</span>
                </div>
              </div>
            )}
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
                Array.isArray(sale.plannedPayments) && sale.plannedPayments.length > 0 ? (
                  sale.plannedPayments.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm text-gray-700 dark:text-gray-300">
                      <div className="flex items-center gap-2">
                        <span>🧾</span>
                        <span>Previsto: {p.method}</span>
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">{money(p.amount)}</span>
                    </div>
                  ))
                ) : (sale.plannedPayment?.method ? (
                  <div className="flex justify-between items-center text-sm text-gray-700 dark:text-gray-300">
                    <div className="flex items-center gap-2">
                      <span>🧾</span>
                      <span>Previsto: {sale.plannedPayment.method}</span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">{money(sale.total || sale.valor)}</span>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400 italic">Nenhum pagamento registrado</div>
                ))
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
      {isOS ? (
        <ServiceOrderPrintModal open={receiptModalOpen} onClose={() => setReceiptModalOpen(false)} order={sale} store={store} />
      ) : (
        <SaleReceiptPrintModal open={receiptModalOpen} onClose={() => setReceiptModalOpen(false)} sale={sale} store={store} storeId={storeId} />
      )}
    </div>
  )
}

function SaleReceiptPrintModal({ open, onClose, sale, store, storeId }) {
  const [format, setFormat] = useState('thermal')
  const [width, setWidth] = useState('80mm')
  const contentRef = useRef(null)
  const [clientDetails, setClientDetails] = useState(null)
  const DEFAULT_WARRANTY_INFO = `TERMO DE GARANTIA DE PRODUTOS
Para celulares 1* Ano / Prosutos e Serviços 3 meses
Para defetio de fabricação Garantia Não Cobre Produto riscado,trincado,descascado manchas esternas ou internas quebrado ou danificado! Sem selo da loja.Não trocamos Produto sem caixa original. cliente ciente com os termos acima.`

  useEffect(() => {
    if (format === 'a4') setWidth('210mm')
    else setWidth((prev) => (String(prev) === '210mm' ? '80mm' : prev))
  }, [format])

  useEffect(() => {
    if (!open || !sale) return
    const sid = sale?.storeId || storeId || store?.id
    if (!sid) return

    if (sale.clientId) {
      getDoc(doc(db, 'clients', sale.clientId))
        .then(snap => {
          if (snap.exists()) setClientDetails({ id: snap.id, ...snap.data() })
        })
        .catch(() => {})
      return
    }

    const name = String(sale.client || '').trim()
    if (!name) return
    const q = query(collection(db, 'clients'), where('storeId', '==', sid), where('nameLower', '==', name.toLowerCase()))
    getDocs(q)
      .then(snap => {
        const d = snap.docs[0]
        if (d) setClientDetails({ id: d.id, ...d.data() })
      })
      .catch(() => {})
  }, [open, sale, storeId, store])

  if (!open || !sale) return null

  const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const formatDate = (ts) => {
    if (!ts) return ''
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleString('pt-BR')
  }

  const formatSaleNumber = (order) => {
    if (order.number) {
      const digits = String(order.number).replace(/\D/g, '')
      const n = parseInt(digits, 10)
      return `PV:${String(n).padStart(4, '0')}`
    }
    return `PV:${String(order.id).slice(-4)}`
  }

  const items = Array.isArray(sale.products) ? sale.products : []
  const subtotal = items.reduce((acc, p) => acc + Number(p.total ?? (Number(p.price || 0) * Number(p.quantity || 0))), 0)
  const feesApplied = Array.isArray(sale.feesApplied) ? sale.feesApplied : []
  const feesTotal = feesApplied.reduce((acc, f) => {
    if (f?.type === 'percent') return acc + (subtotal * (Number(f.value || 0) / 100))
    return acc + Number(f?.value || 0)
  }, 0)
  const discount = sale.discount || null
  const discountAmount = (() => {
    if (!discount || typeof discount !== 'object') return 0
    if (discount.type === 'percent') return subtotal * (Number(discount.value || 0) / 100)
    if (discount.type === 'fixed') return Number(discount.value || 0)
    return 0
  })()
  const total = Number(sale.total || sale.valor || (subtotal + feesTotal - discountAmount) || 0)
  const warrantyInfo = String(sale.warrantyInfo || '').trim()
    ? String(sale.warrantyInfo)
    : (String(store?.warrantyTerms || '').trim() ? String(store.warrantyTerms) : DEFAULT_WARRANTY_INFO)

  const DEFAULT_RECEIPT_CONFIG = {
    company: {
      showLogo: true,
      showName: true,
      showCnpj: true,
      showEmail: true,
      showWhatsapp: true,
      showAddress: true,
    },
    sale: {
      showTitle: true,
      showNumber: true,
      showDate: true,
      showAttendant: true,
    },
    client: {
      showSection: true,
      showName: true,
      showCode: true,
      showCpf: true,
      showCnpj: true,
      showPhone: true,
      showWhatsapp: true,
      showEmail: true,
      showCep: true,
      showAddress: true,
      showNumber: true,
      showComplement: true,
      showNeighborhood: true,
      showCity: true,
      showState: true,
      showIdentity: true,
      showMotherName: true,
      showBirthDate: true,
      showNotes: true,
      showStateRegistrationIndicator: true,
    },
    items: {
      showSection: true,
      showQty: true,
      showTotal: true,
      showUnitPrice: true,
    },
    totals: {
      showSection: true,
      showSubtotal: false,
      showFees: true,
      showDiscount: true,
      showTotal: true,
    },
    payments: {
      showSection: true,
    },
    observations: {
      showSection: true,
    },
    warranty: {
      showSection: true,
    },
  }

  const deepMerge = (base, override) => {
    if (!override || typeof override !== 'object') return base
    const out = Array.isArray(base) ? [...base] : { ...base }
    for (const k of Object.keys(override)) {
      const bv = base?.[k]
      const ov = override[k]
      if (bv && typeof bv === 'object' && !Array.isArray(bv) && ov && typeof ov === 'object' && !Array.isArray(ov)) {
        out[k] = deepMerge(bv, ov)
      } else {
        out[k] = ov
      }
    }
    return out
  }

  const receiptConfig = deepMerge(DEFAULT_RECEIPT_CONFIG, store?.receiptConfig || {})

  const showCompanyBlock = (
    (receiptConfig.company?.showLogo && !!store?.bannerUrl) ||
    (receiptConfig.company?.showName && !!(store?.name || store?.razaoSocial)) ||
    (receiptConfig.company?.showCnpj && !!store?.cnpj) ||
    (receiptConfig.company?.showEmail && !!store?.emailEmpresarial) ||
    (receiptConfig.company?.showWhatsapp && !!store?.whatsapp) ||
    (receiptConfig.company?.showAddress && !!(store?.address || store?.endereco || store?.city || store?.cidade))
  )

  const handlePrint = () => {
    const content = contentRef.current
    if (!content) return

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const docRef = iframe.contentWindow.document

    const printStyles = `
      body {
        font-family: 'Courier New', Courier, monospace;
        margin: 0;
        padding: 0;
        background: white;
        color: black;
        font-weight: bold;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .print-container {
        width: ${width};
        margin: 0 auto;
        padding: 10px;
        background: white;
        overflow-wrap: break-word;
        word-wrap: break-word;
        word-break: break-word;
      }
      .print-items-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      .print-items-col-qty { width: 4ch; }
      .print-items-col-total { width: 11ch; }
      .print-items-cell-item { overflow-wrap: anywhere; word-break: break-word; }
      .print-items-head-qty,
      .print-items-head-total,
      .print-items-cell-qty,
      .print-items-cell-total { white-space: nowrap; overflow: hidden; text-overflow: clip; }
      @media print {
        @page { size: ${format === 'a4' ? 'A4' : `${width} auto`}; margin: ${format === 'a4' ? '10mm' : '0'}; }
        body { margin: 0; }
        img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
      * { box-sizing: border-box; }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .text-left { text-align: left; }
      .font-bold { font-weight: bold; }
      .text-xs { font-size: 12px; }
      .text-sm { font-size: 14px; }
      .text-base { font-size: 16px; }
      .text-lg { font-size: 20px; }
      .text-xl { font-size: 24px; }
      .border-b { border-bottom: 1px dashed #000; }
      .border-t { border-top: 1px dashed #000; }
      .my-2 { margin-top: 8px; margin-bottom: 8px; }
      .flex { display: flex; }
      .justify-between { justify-content: space-between; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 2px 0; vertical-align: top; word-break: break-word; }
      img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
    `

    docRef.open()
    docRef.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Imprimir Recibo</title>
          <style>${printStyles}</style>
        </head>
        <body>
          <div class="print-container">
            ${content.innerHTML}
          </div>
          <script>
            var __didPrint = false;
            function __tryPrint() {
              if (__didPrint) return;
              __didPrint = true;
              try { window.focus(); } catch (e) {}
              try { window.print(); } catch (e) {}
            }
            window.onload = function() {
              setTimeout(__tryPrint, 300);
            };
            setTimeout(__tryPrint, 1500);
            window.onafterprint = function() {
              setTimeout(function() {
                try { if (window.frameElement) window.frameElement.remove(); } catch (e) {}
              }, 50);
            };
          </script>
        </body>
      </html>
    `)
    docRef.close()
    iframe.contentWindow.focus()
  }

  const containerClass = format === 'a4' ? 'font-sans text-sm' : 'font-mono text-xs'

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white w-full max-w-5xl h-[90vh] flex flex-col rounded-lg shadow-2xl overflow-hidden">
        <div className="flex flex-col md:flex-row items-center justify-between p-4 border-b gap-4 bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800">Imprimir Recibo</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-white border rounded px-2 py-1">
              <span className="text-sm text-gray-600 mr-2">Formato:</span>
              <select value={format} onChange={e => setFormat(e.target.value)} className="text-sm bg-transparent outline-none">
                <option value="thermal">Térmica</option>
                <option value="a4">A4</option>
              </select>
            </div>
            {format === 'thermal' && (
              <div className="flex items-center bg-white border rounded px-2 py-1">
                <span className="text-sm text-gray-600 mr-2">Largura:</span>
                <select value={width} onChange={e => setWidth(e.target.value)} className="text-sm bg-transparent outline-none">
                  <option value="80mm">80mm</option>
                  <option value="58mm">58mm</option>
                </select>
              </div>
            )}
            <button onClick={handlePrint} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium shadow-sm">
              Imprimir
            </button>
            <button onClick={onClose} className="px-4 py-2 bg-white border rounded hover:bg-gray-50 text-sm font-medium text-gray-700">
              Fechar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-100 p-8 flex justify-center items-start">
          <div className={`bg-white shadow-xl transition-all duration-300 origin-top ${format === 'a4' ? 'min-h-[297mm]' : 'min-h-[100mm]'}`} style={{ width }}>
            <div ref={contentRef} className={`p-4 ${containerClass} text-black`}>
              {showCompanyBlock && (
                <div className="text-center mb-4">
                  {receiptConfig.company?.showLogo && store?.bannerUrl && (
                    <div className="mb-2 flex justify-center">
                      <img src={store.bannerUrl} alt="Logo" className="max-h-20 object-contain" />
                    </div>
                  )}
                  {receiptConfig.company?.showName && (
                    <div className="font-bold uppercase text-sm">{store?.name || store?.razaoSocial || 'Nome da Loja'}</div>
                  )}
                  {receiptConfig.company?.showCnpj && store?.cnpj && <div>CNPJ: {store.cnpj}</div>}
                  {receiptConfig.company?.showEmail && store?.emailEmpresarial && <div>{store.emailEmpresarial}</div>}
                  {receiptConfig.company?.showWhatsapp && store?.whatsapp && <div>Tel: {store.whatsapp}</div>}
                  {receiptConfig.company?.showAddress && (store?.address || store?.endereco || store?.city || store?.cidade) && (
                    <div className="mt-1 text-[10px] leading-tight">
                      {(store.address || store.endereco) ? (
                        <>
                          {store.address || store.endereco}
                          {(store.number || store.numero) ? `, ${store.number || store.numero}` : ''}
                          {(store.neighborhood || store.bairro) ? `, ${store.neighborhood || store.bairro}` : ''}
                          <br />
                        </>
                      ) : null}
                      {(store.city || store.cidade) ? (store.city || store.cidade) : ''}
                      {(store.state || store.estado) ? ` - ${store.state || store.estado}` : ''}
                    </div>
                  )}
                </div>
              )}

              <div className="border-b border-black my-2"></div>

              <div className="mb-2">
                {receiptConfig.sale?.showTitle && <div className="font-bold text-center mb-1">RECIBO DE VENDA</div>}
                {(receiptConfig.sale?.showNumber || receiptConfig.sale?.showDate) && (
                  <div className="flex justify-between">
                    <span>{receiptConfig.sale?.showNumber ? (<>Nº: <strong>{formatSaleNumber(sale)}</strong></>) : null}</span>
                    <span>{receiptConfig.sale?.showDate ? formatDate(sale.createdAt) : null}</span>
                  </div>
                )}
                {receiptConfig.sale?.showAttendant && sale.attendant && <div>Vendedor: {sale.attendant}</div>}
              </div>

              <div className="border-b border-black my-2"></div>

              {receiptConfig.client?.showSection && (
                <div className="mb-2">
                  <div className="font-bold mb-1">DADOS DO CLIENTE</div>
                  {receiptConfig.client?.showName && <div>{sale.client || 'Consumidor Final'}</div>}
                  {receiptConfig.client?.showCode && clientDetails?.code && <div>Código: {clientDetails.code}</div>}
                  {receiptConfig.client?.showCpf && clientDetails?.cpf && <div>CPF: {clientDetails.cpf}</div>}
                  {receiptConfig.client?.showCnpj && clientDetails?.cnpj && <div>CNPJ: {clientDetails.cnpj}</div>}
                  {receiptConfig.client?.showPhone && clientDetails?.phone && <div>Tel: {clientDetails.phone}</div>}
                  {receiptConfig.client?.showWhatsapp && clientDetails?.whatsapp && <div>WhatsApp: {clientDetails.whatsapp}</div>}
                  {receiptConfig.client?.showEmail && clientDetails?.email && <div>E-mail: {clientDetails.email}</div>}
                  {receiptConfig.client?.showCep && clientDetails?.cep && <div>CEP: {clientDetails.cep}</div>}
                  {receiptConfig.client?.showAddress && clientDetails?.address && <div>Endereço: {clientDetails.address}</div>}
                  {receiptConfig.client?.showNumber && clientDetails?.number && <div>Número: {clientDetails.number}</div>}
                  {receiptConfig.client?.showComplement && clientDetails?.complement && <div>Complemento: {clientDetails.complement}</div>}
                  {receiptConfig.client?.showNeighborhood && clientDetails?.neighborhood && <div>Bairro: {clientDetails.neighborhood}</div>}
                  {receiptConfig.client?.showCity && clientDetails?.city && <div>Cidade: {clientDetails.city}</div>}
                  {receiptConfig.client?.showState && clientDetails?.state && <div>Estado: {clientDetails.state}</div>}
                  {receiptConfig.client?.showIdentity && clientDetails?.identity && <div>Identidade: {clientDetails.identity}</div>}
                  {receiptConfig.client?.showStateRegistrationIndicator && clientDetails?.stateRegistrationIndicator && <div>Indicador IE: {clientDetails.stateRegistrationIndicator}</div>}
                  {receiptConfig.client?.showMotherName && clientDetails?.motherName && <div>Nome da mãe: {clientDetails.motherName}</div>}
                  {receiptConfig.client?.showBirthDate && clientDetails?.birthDate && <div>Data de nascimento: {clientDetails.birthDate}</div>}
                  {receiptConfig.client?.showNotes && clientDetails?.notes && <div>Obs.: {clientDetails.notes}</div>}
                </div>
              )}

              <div className="border-b border-black my-2"></div>

              {/* Items */}
              {receiptConfig.items?.showSection && (
                <div className="mb-2">
                  <div className="font-bold mb-1">PRODUTOS / SERVIÇOS</div>
                  <table className="print-items-table w-full table-fixed" style={{ width: '100%', tableLayout: 'fixed' }}>
                    <colgroup>
                      <col />
                      {receiptConfig.items?.showQty && <col className="print-items-col-qty" style={{ width: '4ch' }} />}
                      {receiptConfig.items?.showTotal && <col className="print-items-col-total" style={{ width: '11ch' }} />}
                    </colgroup>
                    <thead>
                      <tr className="border-b border-dashed border-gray-400">
                        <th className="text-left pb-1">Item</th>
                        {receiptConfig.items?.showQty && <th className="text-right pb-1 print-items-head-qty">Qtd</th>}
                        {receiptConfig.items?.showTotal && <th className="text-right pb-1 print-items-head-total">Total</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p, i) => {
                        const colSpan =
                          1 +
                          (receiptConfig.items?.showQty ? 1 : 0) +
                          (receiptConfig.items?.showTotal ? 1 : 0)
                        const lineTotal = p.total ?? (Number(p.price || 0) * Number(p.quantity || 0))
                        return (
                          <React.Fragment key={i}>
                            <tr>
                              <td className="pr-1 pt-1 pb-0.5 print-items-cell-item" colSpan={colSpan}>
                                <div className="whitespace-pre-wrap break-words leading-tight" style={{ fontWeight: 'inherit', fontSize: 'inherit' }}>
                                  {p.name}
                                </div>
                              </td>
                            </tr>
                            <tr>
                              <td className="pr-1 pb-1 print-items-cell-item">{'\u00A0'}</td>
                              {receiptConfig.items?.showQty && (
                                <td className="text-right pb-1 align-top print-items-cell-qty">
                                  {p.quantity}
                                </td>
                              )}
                              {receiptConfig.items?.showTotal && (
                                <td className="text-right pb-1 align-top font-bold print-items-cell-total">
                                  {money(lineTotal)}
                                </td>
                              )}
                            </tr>
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="border-t border-black my-2"></div>

              {receiptConfig.observations?.showSection && sale.receiptNotes && (
                <>
                  <div className="mb-2">
                    <div className="font-bold mb-1">OBSERVAÇÕES</div>
                    <div className="whitespace-pre-wrap">{sale.receiptNotes}</div>
                  </div>
                  <div className="border-t border-black my-2"></div>
                </>
              )}

              {receiptConfig.totals?.showSection && (
                <div className="flex flex-col gap-1 text-right mb-2">
                  {receiptConfig.totals?.showFees && feesTotal > 0 && (
                    <div className="flex justify-between">
                      <span>Taxas:</span>
                      <span>+ {money(feesTotal)}</span>
                    </div>
                  )}
                  {receiptConfig.totals?.showDiscount && discountAmount > 0 && (
                    <div className="flex justify-between">
                      <span>Desconto:</span>
                      <span>- {money(discountAmount)}</span>
                    </div>
                  )}
                  {receiptConfig.totals?.showTotal && (
                    <div className="flex justify-between font-bold text-lg mt-1">
                      <span>TOTAL:</span>
                      <span>{money(total)}</span>
                    </div>
                  )}
                </div>
              )}

              {receiptConfig.payments?.showSection && ((sale.payments && sale.payments.length > 0) || (Array.isArray(sale.plannedPayments) && sale.plannedPayments.length > 0) || sale.plannedPayment?.method) && (
                <>
                  <div className="border-b border-black my-2"></div>
                  <div className="mb-2">
                    <div className="font-bold mb-1">{(sale.payments && sale.payments.length > 0) ? 'PAGAMENTOS' : 'PAGAMENTO (PREVISTO)'}</div>
                    {(sale.payments && sale.payments.length > 0) ? (
                      sale.payments.map((p, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span>{p.method}</span>
                          <span>{money(p.amount)}</span>
                        </div>
                      ))
                    ) : (Array.isArray(sale.plannedPayments) && sale.plannedPayments.length > 0) ? (
                      sale.plannedPayments.map((p, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span>{p.method}</span>
                          <span>{money(p.amount)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between text-xs">
                        <span>{sale.plannedPayment.method}</span>
                        <span>{money(total)}</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {receiptConfig.warranty?.showSection && (
                <>
                  <div className="border-b border-black my-2"></div>
                  <div className="mb-1">
                    <div className="font-bold mb-1">TERMO DE GARANTIA</div>
                    <div className="whitespace-pre-wrap">{warrantyInfo}</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
