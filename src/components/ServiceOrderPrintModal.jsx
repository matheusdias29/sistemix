import React, { useState, useRef, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'

export default function ServiceOrderPrintModal({ open, onClose, order, store }) {
  const [format, setFormat] = useState('thermal') // 'thermal' | 'a4'
  const [width, setWidth] = useState('80mm') // '58mm' | '80mm'
  const contentRef = useRef(null)
  const [clientDetails, setClientDetails] = useState(null)

  const DEFAULT_PRINT_CONFIG = {
    company: {
      showLogo: true,
      showName: true,
      showCnpj: true,
      showEmail: true,
      showWhatsapp: true,
      showAddress: true,
    },
    order: {
      showTitle: true,
      showNumber: true,
      showDate: true,
      showAttendant: true,
      showTechnician: true,
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
      showStateRegistrationIndicator: true,
      showMotherName: true,
      showBirthDate: true,
      showNotes: true,
    },
    device: {
      showSection: true,
      showEquipment: true,
      showBrand: true,
      showModel: true,
      showSerial: true,
      showImei1: true,
      showImei2: true,
      showPassword: true,
      showProblem: true,
    },
    checklist: {
      showSection: true,
    },
    items: {
      showSection: true,
      showQty: true,
      showTotal: true,
      showUnitPrice: true,
      showProducts: true,
      showServices: true,
    },
    observations: {
      showSection: true,
    },
    totals: {
      showSection: true,
      showDiscount: true,
      showAddition: true,
      showTotal: true,
    },
    payments: {
      showSection: true,
    },
    signatures: {
      showClient: true,
      showTechnician: true,
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

  const printConfig = deepMerge(DEFAULT_PRINT_CONFIG, store?.serviceOrderPrintConfig || {})

  // Auto-select width based on format
  useEffect(() => {
    if (format === 'a4') setWidth('210mm')
    else setWidth('80mm')
  }, [format])

  // Fetch client details to enrich print (phone, whatsapp, cpf, code)
  useEffect(() => {
    const name = String(order?.client || '').trim()
    const sid = order?.storeId || store?.id
    if (!open || !name || !sid) return
    const nameLower = name.toLowerCase()
    const colRef = collection(db, 'clients')
    const q = query(colRef, where('storeId', '==', sid), where('nameLower', '==', nameLower))
    getDocs(q)
      .then(snap => {
        const doc = snap.docs[0]
        if (doc) setClientDetails({ id: doc.id, ...doc.data() })
      })
      .catch(() => {})
  }, [open, order, store])

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
        @page { margin: 0; }
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

  const clientCode = order.clientCode || clientDetails?.code
  const clientCpf = order.clientCpf || clientDetails?.cpf
  const clientCnpj = order.clientCnpj || clientDetails?.cnpj
  const clientPhone = order.clientPhone || clientDetails?.phone
  const clientWhatsapp = order.clientWhatsapp || clientDetails?.whatsapp
  const clientEmail = order.clientEmail || clientDetails?.email
  const clientCep = order.clientCep || clientDetails?.cep
  const clientStreet = order.clientAddressStreet || clientDetails?.address || clientDetails?.endereco
  const clientNumber = order.clientAddressNumber || clientDetails?.number || clientDetails?.numero
  const clientComplement = order.clientAddressComplement || clientDetails?.complement || clientDetails?.complemento
  const clientNeighborhood = order.clientAddressNeighborhood || clientDetails?.neighborhood || clientDetails?.bairro
  const clientCity = order.clientAddressCity || clientDetails?.city || clientDetails?.cidade
  const clientState = order.clientAddressState || clientDetails?.state || clientDetails?.estado
  const clientIdentity = order.clientIdentity || clientDetails?.identity || clientDetails?.rg
  const clientStateRegistrationIndicator = order.clientStateRegistrationIndicator || clientDetails?.stateRegistrationIndicator
  const clientMotherName = order.clientMotherName || clientDetails?.motherName
  const clientBirthDate = order.clientBirthDate || clientDetails?.birthDate
  const clientNotes = order.clientNotes || clientDetails?.notes
  const clientAddressLine = (() => {
    if (!printConfig.client.showAddress) return ''
    if (order.clientAddress) return order.clientAddress
    const parts = []
    if (clientStreet) parts.push(clientStreet)
    if (printConfig.client.showNumber && clientNumber) parts.push(clientNumber)
    if (printConfig.client.showComplement && clientComplement) parts.push(clientComplement)
    if (printConfig.client.showNeighborhood && clientNeighborhood) parts.push(clientNeighborhood)
    const cityState = [
      printConfig.client.showCity ? clientCity : null,
      printConfig.client.showState ? clientState : null,
    ].filter(v => String(v || '').trim()).join(' - ')
    if (cityState) parts.push(cityState)
    return parts.filter(v => String(v || '').trim()).join(', ')
  })()

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
                {printConfig.company.showLogo && store?.bannerUrl && (
                  <div className="mb-2 flex justify-center">
                    <img src={store.bannerUrl} alt="Logo" className="max-h-20 object-contain" />
                  </div>
                )}
                {printConfig.company.showName && (
                  <div className="font-bold uppercase text-sm">{store?.name || store?.razaoSocial || 'Nome da Loja'}</div>
                )}
                {printConfig.company.showCnpj && store?.cnpj && <div>CNPJ: {store.cnpj}</div>}
                {printConfig.company.showEmail && store?.emailEmpresarial && <div>{store.emailEmpresarial}</div>}
                {printConfig.company.showWhatsapp && store?.whatsapp && <div>Tel: {store.whatsapp}</div>}
                {printConfig.company.showAddress && (store?.address || store?.endereco) && (
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
                {printConfig.order.showTitle && <div className="font-bold text-center mb-1">ORDEM DE SERVIÇO</div>}
                {(printConfig.order.showNumber || printConfig.order.showDate) && (
                  <div className="flex justify-between">
                    {printConfig.order.showNumber && <span>Nº: <strong>{order.number || order.id?.slice(-6)}</strong></span>}
                    {printConfig.order.showDate && <span>{formatDate(order.createdAt)}</span>}
                  </div>
                )}
                {printConfig.order.showAttendant && order.attendant && <div>Atendente: {order.attendant}</div>}
                {printConfig.order.showTechnician && order.technician && <div>Técnico: {order.technician}</div>}
              </div>

              <div className="border-b border-black my-2"></div>

              {/* Client Info */}
              {printConfig.client.showSection && (
                <div className="mb-2">
                  <div className="font-bold mb-1">DADOS DO CLIENTE</div>
                  {printConfig.client.showName && <div>{order.client || 'Cliente não informado'}</div>}
                  {printConfig.client.showCode && clientCode && <div>Código: {clientCode}</div>}
                  {printConfig.client.showCpf && clientCpf && <div>CPF: {clientCpf}</div>}
                  {printConfig.client.showCnpj && clientCnpj && <div>CNPJ: {clientCnpj}</div>}
                  {printConfig.client.showEmail && clientEmail && <div>Email: {clientEmail}</div>}
                  {printConfig.client.showCep && clientCep && <div>CEP: {clientCep}</div>}
                  {clientAddressLine && <div className="text-[10px]">{clientAddressLine}</div>}
                  {printConfig.client.showPhone && clientPhone && <div>Tel: {clientPhone}</div>}
                  {printConfig.client.showWhatsapp && clientWhatsapp && <div>WhatsApp: {clientWhatsapp}</div>}
                  {printConfig.client.showIdentity && clientIdentity && <div>Identidade: {clientIdentity}</div>}
                  {printConfig.client.showStateRegistrationIndicator && clientStateRegistrationIndicator && (
                    <div>Indicador IE: {clientStateRegistrationIndicator}</div>
                  )}
                  {printConfig.client.showMotherName && clientMotherName && <div>Nome da mãe: {clientMotherName}</div>}
                  {printConfig.client.showBirthDate && clientBirthDate && <div>Nascimento: {String(clientBirthDate)}</div>}
                  {printConfig.client.showNotes && clientNotes && <div className="text-[10px] whitespace-pre-wrap">Obs: {clientNotes}</div>}
                </div>
              )}

              <div className="border-b border-black my-2"></div>

              {/* Device Info */}
              {printConfig.device.showSection && (
                <div className="mb-2">
                  <div className="font-bold mb-1">DADOS DO APARELHO</div>
                  {printConfig.device.showEquipment && order.equipment && <div>Aparelho: {order.equipment}</div>}
                  {printConfig.device.showBrand && order.brand && <div>Marca: {order.brand}</div>}
                  {printConfig.device.showModel && order.model && <div>Modelo: {order.model}</div>}
                  {printConfig.device.showSerial && order.serialNumber && <div style={{ wordBreak: 'break-all' }}>Serial: {order.serialNumber}</div>}
                  {printConfig.device.showImei1 && order.imei1 && <div style={{ wordBreak: 'break-all' }}>IMEI 1: {order.imei1}</div>}
                  {printConfig.device.showImei2 && order.imei2 && <div style={{ wordBreak: 'break-all' }}>IMEI 2: {order.imei2}</div>}
                  {printConfig.device.showPassword && order.password && (
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
                  {printConfig.device.showProblem && order.problem && (
                    <div className="mt-1">
                      <span className="font-semibold">Defeito:</span>
                      <div className="whitespace-pre-wrap">{order.problem}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Checklist */}
              {printConfig.checklist.showSection && order.checklist && order.checklist.questions && order.checklist.questions.length > 0 && (
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
              {printConfig.items.showSection && (
                <div className="mb-2">
                  <div className="font-bold mb-1">PRODUTOS / SERVIÇOS</div>
                  <table className="print-items-table text-base">
                    <colgroup>
                      <col />
                      {printConfig.items.showQty && <col className="print-items-col-qty" />}
                      {printConfig.items.showTotal && <col className="print-items-col-total" />}
                    </colgroup>
                    <thead>
                      <tr className="border-b border-dashed border-gray-400">
                        <th className="text-left pb-1">Item</th>
                        {printConfig.items.showQty && <th className="text-right pb-1 print-items-head-qty">Qtd</th>}
                        {printConfig.items.showTotal && <th className="text-right pb-1 print-items-head-total">Total</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {printConfig.items.showProducts && (order.products || []).map((p, i) => (
                        <tr key={`p-${i}`}>
                          <td className="pr-1 py-1 print-items-cell-item">
                            <div className="font-bold">{p.name}</div>
                          </td>
                          {printConfig.items.showQty && <td className="text-right py-1 align-top print-items-cell-qty">{p.quantity}</td>}
                          {printConfig.items.showTotal && <td className="text-right py-1 align-top font-bold print-items-cell-total">{formatMoney(p.price * p.quantity)}</td>}
                        </tr>
                      ))}
                      {printConfig.items.showServices && (order.services || []).map((s, i) => (
                        <tr key={`s-${i}`}>
                          <td className="pr-1 py-1 print-items-cell-item">
                            <div className="font-bold">{s.name}</div>
                          </td>
                          {printConfig.items.showQty && <td className="text-right py-1 align-top print-items-cell-qty">{s.quantity || 1}</td>}
                          {printConfig.items.showTotal && <td className="text-right py-1 align-top font-bold print-items-cell-total">{formatMoney(s.price * (s.quantity || 1))}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="border-t border-black my-2"></div>

              {printConfig.observations.showSection && order.receiptNotes && (
                <>
                  <div className="mb-2">
                    <div className="font-bold mb-1">OBSERVAÇÕES</div>
                    <div className="whitespace-pre-wrap">{order.receiptNotes}</div>
                  </div>
                  <div className="border-t border-black my-2"></div>
                </>
              )}

              {/* Totals */}
              {printConfig.totals.showSection && (
                <div className="flex flex-col gap-1 text-right mb-2">
                  {printConfig.totals.showDiscount && discount > 0 && (
                    <div className="flex justify-between">
                      <span>Desconto:</span>
                      <span>- {formatMoney(discount)}</span>
                    </div>
                  )}
                  {printConfig.totals.showAddition && addition > 0 && (
                    <div className="flex justify-between">
                      <span>Acréscimo:</span>
                      <span>+ {formatMoney(addition)}</span>
                    </div>
                  )}
                  {printConfig.totals.showTotal && (
                    <div className="flex justify-between font-bold text-xl mt-1">
                      <span>TOTAL:</span>
                      <span>{formatMoney(total)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Payments */}
              {printConfig.payments.showSection && (order.payments && order.payments.length > 0) && (
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
                {printConfig.signatures.showClient && (
                  <div className="mb-4 pt-4">
                    <div className="border-t border-black w-3/4 mx-auto mb-1"></div>
                    <div className="text-xs">Assinatura do Cliente</div>
                  </div>
                )}

                {printConfig.signatures.showTechnician && (
                  <div className="mb-4 pt-4">
                    <div className="border-t border-black w-3/4 mx-auto mb-1"></div>
                    <div className="text-xs">Assinatura do Técnico</div>
                  </div>
                )}
                
                {printConfig.warranty.showSection && (store?.serviceOrderSettings?.warrantyText || order.warrantyInfo || order.warrantyText) && (
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
