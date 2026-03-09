import React, { useState, useRef, useEffect } from 'react'

export default function ServiceOrderPrintModal({ open, onClose, order, store }) {
  const [format, setFormat] = useState('thermal') // 'thermal' | 'a4'
  const [width, setWidth] = useState('80mm') // '58mm' | '80mm'
  const contentRef = useRef(null)

  // Auto-select width based on format
  useEffect(() => {
    if (format === 'a4') setWidth('210mm')
    else setWidth('80mm')
  }, [format])

  if (!open || !order) return null

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

    const doc = iframe.contentWindow.document
    
    // Collect styles
    let styles = ''
    document.querySelectorAll('style').forEach(s => styles += s.innerHTML)
    
    // Basic print styles
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
      .text-base { font-size: 12px; }
      .text-lg { font-size: 14px; }
      .border-b { border-bottom: 1px dashed #000; }
      .border-t { border-top: 1px dashed #000; }
      .my-2 { margin-top: 8px; margin-bottom: 8px; }
      .my-8 { margin-top: 32px; margin-bottom: 32px; }
      .py-1 { padding-top: 4px; padding-bottom: 4px; }
      .pt-4 { padding-top: 16px; }
      .pt-8 { padding-top: 32px; }
      .pb-4 { padding-bottom: 16px; }
      .pb-8 { padding-bottom: 32px; }
      .mb-1 { margin-bottom: 4px; }
      .mb-4 { margin-bottom: 16px; }
      .mb-8 { margin-bottom: 32px; }
      .mb-12 { margin-bottom: 48px; }
      .flex { display: flex; }
      .justify-between { justify-content: space-between; }
      .items-center { align-items: center; }
      .w-full { width: 100%; }
      img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 2px 0; vertical-align: top; word-break: break-word; }
      .no-print { display: none; }
    `

    doc.open()
    doc.write(`
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
            // Wait for images to load before printing
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
            // Fallback if onload doesn't fire (e.g. cached or no images)
            setTimeout(function() {
              if (document.readyState === 'complete') {
                 window.print();
              }
            }, 2000);
          </script>
        </body>
      </html>
    `)
    doc.close()

    // No need to call print from here anymore, the script inside iframe will handle it
    // But we focus it just in case
    iframe.contentWindow.focus()
  }

  // Format Helpers
  const formatDate = (d) => {
    if (!d) return ''
    if (d.seconds) d = new Date(d.seconds * 1000)
    if (typeof d === 'string') d = new Date(d)
    return d.toLocaleString('pt-BR')
  }

  const formatMoney = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // Derived Data
  const totalProducts = (order.products || []).reduce((acc, p) => acc + (p.price * p.quantity), 0)
  const totalServices = (order.services || []).reduce((acc, s) => acc + (s.price * (s.quantity || 1)), 0)
  const subtotal = totalProducts + totalServices
  const discount = Number(order.discount || 0)
  const addition = Number(order.addition || 0)
  const total = subtotal - discount + addition

  const isThermal = format === 'thermal'
  const containerClass = isThermal ? 'font-mono text-xs' : 'font-sans text-sm'

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white w-full max-w-5xl h-[90vh] flex flex-col rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between p-4 border-b gap-4 bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800">Imprimir Recibo</h2>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-white border rounded px-2 py-1">
                <span className="text-sm text-gray-600 mr-2">Formato:</span>
                <button 
                  onClick={() => setFormat('thermal')}
                  className={`px-3 py-1 rounded text-sm transition ${format === 'thermal' ? 'bg-green-100 text-green-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  Térmica
                </button>
                <button 
                  onClick={() => setFormat('a4')}
                  className={`px-3 py-1 rounded text-sm transition ${format === 'a4' ? 'bg-green-100 text-green-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  A4
                </button>
              </div>

              <button 
                onClick={handlePrint} 
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium shadow-sm transition"
              >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Imprimir
            </button>
            
            <button 
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-auto bg-gray-100 p-8 flex justify-center items-start">
          <div 
            className={`bg-white shadow-xl transition-all duration-300 origin-top ${format === 'a4' ? 'min-h-[297mm]' : 'min-h-[100mm]'}`}
            style={{ width: width }}
          >
            <div ref={contentRef} className={`p-4 ${containerClass} text-black`}>
              {/* Logo / Header */}
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

              {/* Order Info */}
              <div className="mb-2">
                <div className="font-bold text-center mb-1">ORDEM DE SERVIÇO</div>
                <div className="flex justify-between">
                  <span>Nº: <strong>{order.number || order.id?.slice(-6)}</strong></span>
                  <span>{formatDate(order.createdAt)}</span>
                </div>
                {order.attendant && <div>Atendente: {order.attendant}</div>}
                {order.technician && <div>Técnico: {order.technician}</div>}
              </div>

              <div className="border-b border-black my-2"></div>

              {/* Client Info */}
              <div className="mb-2">
                <div className="font-bold mb-1">DADOS DO CLIENTE</div>
                <div>{order.client || 'Cliente não informado'}</div>
                {order.clientCpf && <div>CPF: {order.clientCpf}</div>}
                {order.clientAddress && <div className="text-[10px]">{order.clientAddress}</div>}
                {order.clientPhone && <div>Tel: {order.clientPhone}</div>}
              </div>

              <div className="border-b border-black my-2"></div>

              {/* Device Info */}
              <div className="mb-2">
                <div className="font-bold mb-1">DADOS DO APARELHO</div>
                {order.equipment && <div>Aparelho: {order.equipment}</div>}
                {order.brand && <div>Marca: {order.brand}</div>}
                {order.model && <div>Modelo: {order.model}</div>}
                {order.serialNumber && <div style={{ wordBreak: 'break-all' }}>Serial: {order.serialNumber}</div>}
                {order.imei1 && <div style={{ wordBreak: 'break-all' }}>IMEI 1: {order.imei1}</div>}
                {order.imei2 && <div style={{ wordBreak: 'break-all' }}>IMEI 2: {order.imei2}</div>}
                {order.password && (
                  <div className="mt-1">
                    <span className="font-semibold">Senha: </span>
                    {order.password.type === 'pattern' ? (
                      <div className="my-2" style={{ width: '100px' }}>
                        <PatternLock pattern={order.password.pattern || []} />
                      </div>
                    ) : (
                      <span>
                        {order.password.type === 'pattern' 
                          ? `Padrão: ${(order.password.pattern || []).join('-')}`
                          : (order.password.value || order.password.pin || '')}
                      </span>
                    )}
                  </div>
                )}
                {order.problem && (
                  <div className="mt-1">
                    <span className="font-semibold">Defeito:</span>
                    <div className="whitespace-pre-wrap">{order.problem}</div>
                  </div>
                )}
              </div>

              {/* Checklist */}
              {order.checklist && order.checklist.questions && order.checklist.questions.length > 0 && (
                <>
                  <div className="border-b border-black my-2"></div>
                  <div className="mb-2">
                    <div className="font-bold mb-1">CHECKLIST</div>
                    <div className="flex flex-wrap text-xs">
                      {order.checklist.questions.map((q, i) => (
                        <div key={i} className="w-1/2 pr-1 mb-1 flex items-start">
                          <span className="mr-1">{q.checked ? '[X]' : '[ ]'}</span>
                          <span>{q.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="border-b border-black my-2"></div>

              {/* Items */}
              <div className="mb-2">
                <div className="font-bold mb-1">PRODUTOS / SERVIÇOS</div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-dashed border-gray-400">
                      <th className="text-left pb-1">Item</th>
                      <th className="text-right pb-1 w-12">Qtd</th>
                      <th className="text-right pb-1 w-16">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(order.products || []).map((p, i) => (
                      <tr key={`p-${i}`}>
                        <td className="pr-1 py-1">
                          <div>{p.name}</div>
                          {p.price > 0 && <div className="text-[9px] text-gray-500">{formatMoney(p.price)} un</div>}
                        </td>
                        <td className="text-right py-1 align-top">{p.quantity}</td>
                        <td className="text-right py-1 align-top">{formatMoney(p.price * p.quantity)}</td>
                      </tr>
                    ))}
                    {(order.services || []).map((s, i) => (
                      <tr key={`s-${i}`}>
                        <td className="pr-1 py-1">
                          <div>{s.name}</div>
                          {s.price > 0 && <div className="text-[9px] text-gray-500">{formatMoney(s.price)}</div>}
                        </td>
                        <td className="text-right py-1 align-top">{s.quantity || 1}</td>
                        <td className="text-right py-1 align-top">{formatMoney(s.price * (s.quantity || 1))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-black my-2"></div>

              {order.receiptNotes && (
                <>
                  <div className="mb-2">
                    <div className="font-bold mb-1">OBSERVAÇÕES</div>
                    <div className="whitespace-pre-wrap">{order.receiptNotes}</div>
                  </div>
                  <div className="border-t border-black my-2"></div>
                </>
              )}

              {/* Totals */}
              <div className="flex flex-col gap-1 text-right mb-2">
                {discount > 0 && (
                   <div className="flex justify-between">
                     <span>Desconto:</span>
                     <span>- {formatMoney(discount)}</span>
                   </div>
                )}
                {addition > 0 && (
                   <div className="flex justify-between">
                     <span>Acréscimo:</span>
                     <span>+ {formatMoney(addition)}</span>
                   </div>
                )}
                <div className="flex justify-between font-bold text-sm mt-1">
                  <span>TOTAL:</span>
                  <span>{formatMoney(total)}</span>
                </div>
              </div>

              {/* Payments */}
              {(order.payments && order.payments.length > 0) && (
                <>
                  <div className="border-b border-black my-2"></div>
                  <div className="mb-2">
                    <div className="font-bold mb-1">PAGAMENTOS</div>
                    {order.payments.map((p, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span>{p.method}</span>
                        <span>{formatMoney(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="mt-8 border-t border-black pt-2 text-center">
                <div className="mb-12 pt-8">
                  <div className="border-t border-black w-3/4 mx-auto mb-1"></div>
                  <div className="text-xs">Assinatura do Cliente</div>
                </div>

                <div className="mb-8 pt-8">
                  <div className="border-t border-black w-3/4 mx-auto mb-1"></div>
                  <div className="text-xs">Assinatura do Técnico</div>
                </div>
                
                {(store?.serviceOrderSettings?.warrantyText || order.warrantyInfo || order.warrantyText) && (
                  <div className="text-[8px] text-justify leading-tight mt-8 pt-4 border-t border-black">
                    <strong>TERMO DE GARANTIA:</strong> {store?.serviceOrderSettings?.warrantyText || order.warrantyInfo || order.warrantyText || 'Garantia de 90 dias para serviços e peças.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PatternLock({ pattern }) {
  if (!pattern || pattern.length === 0) return null

  // Grid coordinates (3x3)
  // 1 2 3
  // 4 5 6
  // 7 8 9
  const points = {
    1: { x: 20, y: 20 },
    2: { x: 50, y: 20 },
    3: { x: 80, y: 20 },
    4: { x: 20, y: 50 },
    5: { x: 50, y: 50 },
    6: { x: 80, y: 50 },
    7: { x: 20, y: 80 },
    8: { x: 50, y: 80 },
    9: { x: 80, y: 80 }
  }

  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="border border-gray-400 rounded">
      {/* Lines connecting the pattern */}
      {pattern.map((p, i) => {
        if (i === pattern.length - 1) return null
        const start = points[p]
        const end = points[pattern[i + 1]]
        if (!start || !end) return null
        return (
          <line
            key={`line-${i}`}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke="#16a34a"
            strokeWidth="4"
            strokeLinecap="round"
          />
        )
      })}

      {/* Points */}
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((id) => {
        const p = points[id]
        const index = pattern.indexOf(id)
        const isSelected = index !== -1
        
        return (
          <g key={id}>
            <circle
              cx={p.x}
              cy={p.y}
              r="10"
              fill={isSelected ? '#16a34a' : '#e5e7eb'}
            />
            {isSelected && (
              <text
                x={p.x}
                y={p.y}
                dy="4"
                textAnchor="middle"
                fill="white"
                fontSize="12"
                fontWeight="bold"
                fontFamily="Arial, sans-serif"
              >
                {index + 1}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
