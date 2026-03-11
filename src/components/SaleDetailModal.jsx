import React, { useEffect, useRef, useState } from 'react'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { updateOrder, deleteOrder } from '../services/orders'
import { updateProduct } from '../services/products'
import { recordStockMovement } from '../services/stockMovements'
import ShareSaleModal from './ShareSaleModal'

export default function SaleDetailModal({ open, onClose, sale, onEdit, onView, storeId, store, products = [], user }) {
  if (!open || !sale) return null
  const isOwner = !user?.memberId
  const perms = user?.permissions || {}
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)

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
          {!isOS && (isOwner || perms.sales?.viewAll || (user?.name && sale.attendant && user.name.toLowerCase() === sale.attendant.toLowerCase())) && (
          <button onClick={() => setReceiptModalOpen(true)} className="px-3 py-1.5 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-1">
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
      <SaleReceiptPrintModal open={receiptModalOpen} onClose={() => setReceiptModalOpen(false)} sale={sale} store={store} storeId={storeId} />
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
    else setWidth('80mm')
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
      @media print {
        @page { margin: 0; }
        body { margin: 0; }
        img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
      * { box-sizing: border-box; }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .text-left { text-align: left; }
      .font-bold { font-weight: bold; }
      .text-xs { font-size: 8px; }
      .text-sm { font-size: 10px; }
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
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
            setTimeout(function() {
              if (document.readyState === 'complete') {
                window.print();
              }
            }, 2000);
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
              <div className="text-center mb-4">
                {store?.bannerUrl && (
                  <div className="mb-2 flex justify-center">
                    <img src={store.bannerUrl} alt="Logo" className="max-h-20 object-contain" />
                  </div>
                )}
                <div className="font-bold uppercase text-sm">{store?.name || store?.razaoSocial || 'Nome da Loja'}</div>
                {store?.cnpj && <div>CNPJ: {store.cnpj}</div>}
                {store?.emailEmpresarial && <div>{store.emailEmpresarial}</div>}
                {store?.whatsapp && <div>Tel: {store.whatsapp}</div>}
                {(store?.address || store?.endereco) && (
                  <div className="mt-1 text-[10px] leading-tight">
                    {store.address || store.endereco}, {store.number || store.numero}
                    {store.neighborhood || store.bairro ? `, ${store.neighborhood || store.bairro}` : ''}
                    <br />
                    {store.city || store.cidade} - {store.state || store.estado}
                  </div>
                )}
              </div>

              <div className="border-b border-black my-2"></div>

              <div className="mb-2">
                <div className="font-bold text-center mb-1">RECIBO DE VENDA</div>
                <div className="flex justify-between">
                  <span>Nº: <strong>{formatSaleNumber(sale)}</strong></span>
                  <span>{formatDate(sale.createdAt)}</span>
                </div>
                {sale.attendant && <div>Vendedor: {sale.attendant}</div>}
              </div>

              <div className="border-b border-black my-2"></div>

              <div className="mb-2">
                <div className="font-bold mb-1">DADOS DO CLIENTE</div>
                <div>{sale.client || 'Consumidor Final'}</div>
                {(clientDetails?.code) && <div>Código: {clientDetails.code}</div>}
                {(clientDetails?.cpf) && <div>CPF: {clientDetails.cpf}</div>}
                {(clientDetails?.phone) && <div>Tel: {clientDetails.phone}</div>}
                {(clientDetails?.whatsapp) && <div>WhatsApp: {clientDetails.whatsapp}</div>}
              </div>

              <div className="border-b border-black my-2"></div>

              <div className="mb-2">
                <div className="font-bold mb-1">PRODUTOS</div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-dashed border-gray-400">
                      <th className="text-left pb-1">Item</th>
                      <th className="text-right pb-1 w-12">Qtd</th>
                      <th className="text-right pb-1 w-16">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p, i) => (
                      <tr key={i}>
                        <td className="pr-1 py-1">
                          <div>{p.name}</div>
                          {Number(p.price || 0) > 0 && <div className="text-[9px] text-gray-500">{money(p.price)} un</div>}
                        </td>
                        <td className="text-right py-1 align-top">{p.quantity}</td>
                        <td className="text-right py-1 align-top">{money(p.total ?? (Number(p.price || 0) * Number(p.quantity || 0)))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-black my-2"></div>

              {sale.receiptNotes && (
                <>
                  <div className="mb-2">
                    <div className="font-bold mb-1">OBSERVAÇÕES</div>
                    <div className="whitespace-pre-wrap">{sale.receiptNotes}</div>
                  </div>
                  <div className="border-t border-black my-2"></div>
                </>
              )}

              <div className="flex flex-col gap-1 text-right mb-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{money(subtotal)}</span>
                </div>
                {feesTotal > 0 && (
                  <div className="flex justify-between">
                    <span>Taxas:</span>
                    <span>+ {money(feesTotal)}</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Desconto:</span>
                    <span>- {money(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm mt-1">
                  <span>TOTAL:</span>
                  <span>{money(total)}</span>
                </div>
              </div>

              {(sale.payments && sale.payments.length > 0) && (
                <>
                  <div className="border-b border-black my-2"></div>
                  <div className="mb-2">
                    <div className="font-bold mb-1">PAGAMENTOS</div>
                    {sale.payments.map((p, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span>{p.method}</span>
                        <span>{money(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="border-b border-black my-2"></div>
              <div className="mb-1">
                <div className="font-bold mb-1">TERMO DE GARANTIA</div>
                <div className="whitespace-pre-wrap">{warrantyInfo}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
