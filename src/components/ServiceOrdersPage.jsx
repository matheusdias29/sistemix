import React, { useMemo, useState, useEffect, useRef } from 'react'
import { listenOrders, addOrder, updateOrder } from '../services/orders'
import { listenProducts } from '../services/products'
import NewProductModal from './NewProductModal'
import { listenCategories } from '../services/categories'
import { listenSuppliers } from '../services/suppliers'
import { listenClients } from '../services/clients'
import NewClientModal from './NewClientModal'
import SelectClientModal from './SelectClientModal'
import { listenSubUsers } from '../services/users'

export default function ServiceOrdersPage({ storeId, ownerId, addNewSignal }){
  const [view, setView] = useState('list') // 'list' | 'new' | 'edit'
  const [query, setQuery] = useState('')
  const [periodOpen, setPeriodOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [orders, setOrders] = useState([])
  useEffect(() => {
    const unsub = listenOrders(items => setOrders(items), storeId)
    return () => unsub && unsub()
  }, [storeId])

  // Abrir formulário Nova OS somente quando o sinal mudar (ignora montagem inicial)
  const initialAddSignal = useRef(addNewSignal)

  // Filtros simples
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if(!q) return orders
    return orders.filter(o =>
      String(o.id).includes(q) ||
      (o.client||'').toLowerCase().includes(q) ||
      (o.technician||'').toLowerCase().includes(q) ||
      (o.model||'').toLowerCase().includes(q)
    )
  }, [orders, query])

  const totalFinalizadas = useMemo(() => {
    return orders.filter(o => (o.status||'').toLowerCase().includes('finalizada')).reduce((sum, o) => sum + (o.valor||0), 0)
  }, [orders])
  const qtdFinalizadas = useMemo(() => {
    return orders.filter(o => (o.status||'').toLowerCase().includes('finalizada')).length
  }, [orders])
  const ticketMedio = useMemo(() => {
    return qtdFinalizadas > 0 ? (totalFinalizadas / qtdFinalizadas) : 0
  }, [qtdFinalizadas, totalFinalizadas])

  // Estado do formulário Nova OS
  const [client, setClient] = useState('')
  const [clientSelectOpen, setClientSelectOpen] = useState(false)
  const [newClientOpen, setNewClientOpen] = useState(false)
  const [clientsAll, setClientsAll] = useState([])
  const [technician, setTechnician] = useState('')
  const [attendant, setAttendant] = useState('')
  const [members, setMembers] = useState([])
  const [techSelectOpen, setTechSelectOpen] = useState(false)
  const [attendantSelectOpen, setAttendantSelectOpen] = useState(false)
  const [dateIn, setDateIn] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [equipment, setEquipment] = useState('')
  const [problem, setProblem] = useState('')
  const [receiptNotes, setReceiptNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [warrantyInfo, setWarrantyInfo] = useState('Garantia de produtos e serviços.\n90 dias para defeito de fabricação.\nNão cobre produto quebrado.\nNão cobre riscos na tela\nNão cobre trincos na tela.')
  const [saving, setSaving] = useState(false)
  // Status da OS
  const [status, setStatus] = useState('Iniciado')
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  // Produtos na OS e modais
  const [osProducts, setOsProducts] = useState([])
  const [addProdOpen, setAddProdOpen] = useState(false)
  const [prodSelectOpen, setProdSelectOpen] = useState(false)
  const [newProductOpen, setNewProductOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [qtyInput, setQtyInput] = useState(1)
  const [priceInput, setPriceInput] = useState('0')
  const [productsAll, setProductsAll] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  // Estados para variações
  const [varSelectOpen, setVarSelectOpen] = useState(false)
  const [selectedVariation, setSelectedVariation] = useState(null)
// Edição
const [editingOrderId, setEditingOrderId] = useState(null)
const [editingOrderNumber, setEditingOrderNumber] = useState('')

  useEffect(()=>{
    if(selectedProduct){
      let base = selectedProduct.salePrice ?? selectedProduct.priceMin ?? 0
      if(selectedVariation){
        base = selectedVariation.promoPrice ?? selectedVariation.salePrice ?? base
      }
      setPriceInput(String(base))
    }
  }, [selectedProduct, selectedVariation])

  useEffect(() => {
    const unsubP = listenProducts(items => setProductsAll(items), storeId)
    const unsubC = listenCategories(items => setCategories(items), storeId)
    const unsubS = listenSuppliers(items => setSuppliers(items), storeId)
    const unsubClients = listenClients(items => setClientsAll(items), storeId)
    let unsubMembers
    if (ownerId) {
      unsubMembers = listenSubUsers(ownerId, (list) => setMembers(list.filter(u => (u.active ?? true))))
    }
    return () => { unsubP && unsubP(); unsubC && unsubC(); unsubS && unsubS(); unsubClients && unsubClients(); unsubMembers && unsubMembers() }
  }, [storeId, ownerId])

  const totalProductsAgg = useMemo(() => {
    return osProducts.reduce((s, p) => s + ((parseFloat(p.price)||0) * (parseFloat(p.quantity)||0)), 0)
  }, [osProducts])

  const [osPayments, setOsPayments] = useState([])
  const [payMethodsOpen, setPayMethodsOpen] = useState(false)
  const [payAmountOpen, setPayAmountOpen] = useState(false)
  const [selectedPayMethod, setSelectedPayMethod] = useState(null)
  const [payAmountInput, setPayAmountInput] = useState('')
  const [payError, setPayError] = useState('')
  const [payAboveConfirmOpen, setPayAboveConfirmOpen] = useState(false)
  const [afterAboveAdjustedOpen, setAfterAboveAdjustedOpen] = useState(false)
  const [remainingInfoOpen, setRemainingInfoOpen] = useState(false)
  const [remainingSnapshot, setRemainingSnapshot] = useState(0)

  const totalPaidAgg = useMemo(() => {
    return osPayments.reduce((s, p) => s + (parseFloat(p.amount)||0), 0)
  }, [osPayments])
  const remainingToPay = useMemo(() => {
    const r = (parseFloat(totalProductsAgg)||0) - (parseFloat(totalPaidAgg)||0)
    return r > 0 ? r : 0
  }, [totalProductsAgg, totalPaidAgg])

  const techniciansList = useMemo(() => {
    return members.filter(u => (u.isTech ?? false) || /t[eé]cnico/i.test(String(u.name||'')))
  }, [members])
  const attendantsList = useMemo(() => {
    const role = (u) => String(u.role || '').toLowerCase()
    return members.filter(u => (u.isSeller ?? false) || /atendente|vendedor/i.test(String(u.name||'')) || role(u).includes('attendant') || role(u).includes('seller'))
  }, [members])

  const resetForm = () => {
    setClient(''); setTechnician(''); setAttendant(''); setDateIn(''); setExpectedDate(''); setBrand(''); setModel(''); setSerialNumber(''); setEquipment(''); setProblem(''); setReceiptNotes(''); setInternalNotes(''); setWarrantyInfo('Garantia de produtos e serviços.\n90 dias para defeito de fabricação.\nNão cobre produto quebrado.\nNão cobre riscos na tela\nNão cobre trincos na tela.')
    setOsProducts([])
    setOsPayments([])
    setEditingOrderId(null)
    setEditingOrderNumber('')
    setStatus('Iniciado')
  }

  useEffect(() => {
    // Ignora o primeiro render para não abrir automaticamente ao acessar a página
    if (initialAddSignal.current === addNewSignal) return
    resetForm()
    setView('new')
    initialAddSignal.current = addNewSignal
  }, [addNewSignal])

  const toInputDateTime = (v) => {
    if (!v) return ''
    const d = v?.seconds ? new Date(v.seconds * 1000) : new Date(v)
    const pad = (n) => String(n).padStart(2, '0')
    const yyyy = d.getFullYear()
    const mm = pad(d.getMonth() + 1)
    const dd = pad(d.getDate())
    const hh = pad(d.getHours())
    const mi = pad(d.getMinutes())
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
  }

  const openEdit = (o) => {
    setClient(o.client || '')
    setTechnician(o.technician || '')
    setAttendant(o.attendant || '')
    setDateIn(toInputDateTime(o.dateIn) || '')
    setExpectedDate(toInputDateTime(o.expectedDate) || '')
    setBrand(o.brand || '')
    setModel(o.model || '')
    setSerialNumber(o.serialNumber || '')
    setEquipment(o.equipment || '')
    setProblem(o.problem || '')
    setReceiptNotes(o.receiptNotes || '')
    setInternalNotes(o.internalNotes || '')
    setOsProducts(Array.isArray(o.products) ? o.products : [])
    setOsPayments(Array.isArray(o.payments) ? o.payments : [])
    setEditingOrderId(o.id)
    setEditingOrderNumber(o.number || o.id)
    setStatus(o.status || 'Iniciado')
    setView('edit')
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const basePayload = {
        client,
        technician,
        attendant,
        dateIn: dateIn ? new Date(dateIn) : null,
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        brand,
        model,
        serialNumber,
        equipment,
        problem,
        receiptNotes,
        internalNotes,
        services: [],
        products: osProducts,
        totalServices: 0,
        totalProducts: totalProductsAgg,
        discount: 0,
        total: totalProductsAgg,
        valor: totalProductsAgg,
        payments: osPayments,
        password: '',
        checklist: [],
        files: [],
        status,
      }
      if (editingOrderId) {
        await updateOrder(editingOrderId, basePayload)
      } else {
        await addOrder({ ...basePayload }, storeId)
      }
      resetForm()
      setView('list')
    } catch (e) {
      console.error('Erro ao salvar OS', e)
      alert('Erro ao salvar OS. Verifique o console.')
    } finally {
      setSaving(false)
    }
  }

  const openAddProduct = () => {
    setSelectedProduct(null)
    setQtyInput(1)
    setPriceInput('0')
    setAddProdOpen(true)
  }
  const removeProduct = (idx) => {
    setOsProducts(prev => prev.filter((_, i) => i !== idx))
  }

  return (
    <div>
      {view === 'list' ? (
        <>
          {/* Cabeçalho e controles */}
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="flex items-center gap-6 text-sm">
              <button className="pb-2 text-green-600 border-b-2 border-green-600 font-semibold">Ordens De Serviço</button>
              <button className="pb-2 text-gray-600">Serviços</button>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2">
                <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pesquisar..." className="flex-1 border rounded px-3 py-2 text-sm" />
                {/* Ícones ao lado direito da busca (mobile) */}
                <button type="button" onClick={()=>setPeriodOpen(v=>!v)}
                  className="h-9 w-9 border rounded flex items-center justify-center md:h-auto md:w-auto md:px-3 md:py-2 text-sm"
                  aria-label="Período"
                  title="Período">
                  <span className="md:hidden">📅</span>
                  <span className="hidden md:inline">📅 Período</span>
                </button>
                <button type="button" onClick={()=>setFiltersOpen(v=>!v)}
                  className="h-9 w-9 border rounded flex items-center justify-center md:h-auto md:w-auto md:px-3 md:py-2 text-sm"
                  aria-label="Filtros"
                  title="Filtros">
                  <span className="md:hidden">⚙️</span>
                  <span className="hidden md:inline">⚙️ Filtros</span>
                </button>
              </div>
              <div className="hidden md:block flex-1"></div>
              <button className="hidden md:inline-block px-3 py-2 border rounded text-sm">Opções</button>
              <button onClick={()=>{ resetForm(); setView('new') }} className="hidden md:inline-block px-3 py-2 rounded text-sm bg-green-600 text-white">+ Nova</button>
            </div>
          </div>

          {/* Cards de resumo */}
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded shadow">
              <div className="text-xs text-gray-500">Total</div>
              <div className="text-green-700 font-semibold">{totalFinalizadas.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <div className="text-xs text-gray-500">OS's realizadas</div>
              <div className="font-semibold">{qtdFinalizadas}</div>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <div className="text-xs text-gray-500">Ticket Médio</div>
              <div className="font-semibold">{ticketMedio.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
            </div>
          </div>

          {/* Tabela de OS */}
          <div className="mt-4 bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
            <div className="min-w-[1200px] grid grid-cols-[4rem_1fr_8rem_8rem_10rem_10rem_8rem_10rem_8rem_14rem] items-center px-4 py-3 text-xs text-gray-500 border-b gap-3">
              <div>O.S.</div>
              <div>Cliente</div>
              <div>Atendente</div>
              <div>Técnico</div>
              <div>Modelo</div>
              <div>Nº de Série</div>
              <div>Data de abertura</div>
              <div>Previsão de entrega</div>
              <div className="text-right">Valor</div>
              <div>Status</div>
            </div>
            <div className="min-w-[1200px] divide-y divide-gray-200">
              {filtered.map(o => (
                <div key={o.id} onClick={()=>openEdit(o)} className="grid grid-cols-[4rem_1fr_8rem_8rem_10rem_10rem_8rem_10rem_8rem_14rem] items-center px-4 py-3 text-sm cursor-pointer hover:bg-gray-50 gap-3">
                  <div>{o.number || o.id}</div>
                  <div className="leading-tight">
                    <div className="font-medium">{o.client}</div>
                  </div>
                  <div>{o.attendant}</div>
                  <div>{o.technician}</div>
                  <div>{o.model}</div>
                  <div>{o.serialNumber}</div>
                  <div>{o.dateIn ? new Date(o.dateIn.seconds ? o.dateIn.seconds*1000 : o.dateIn).toLocaleDateString('pt-BR') : '-'}</div>
                  <div>{o.expectedDate ? new Date(o.expectedDate.seconds ? o.expectedDate.seconds*1000 : o.expectedDate).toLocaleDateString('pt-BR') : '-'}</div>
                  <div className="text-right">{((o.total ?? o.totalProducts ?? o.valor ?? ((Array.isArray(o.products) ? o.products.reduce((s,p)=> s + ((parseFloat(p.price)||0)*(parseFloat(p.quantity)||0)), 0) : 0)))).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                  <div>
                    {(() => {
                      const s = String(o.status||'').trim()
                      const l = s.toLowerCase()
                      let cls = 'bg-gray-200 text-gray-700'
                      if (l.includes('finaliz')) cls = 'bg-green-100 text-green-700'
                      else if (l.includes('cancel')) cls = 'bg-red-100 text-red-700'
                      else if (l.includes('garantia')) cls = 'bg-purple-100 text-purple-700'
                      else if (l.includes('aguardando') || l.includes('peça')) cls = 'bg-amber-100 text-amber-700'
                      return <span className={`px-2 py-1 rounded text-xs ${cls}`}>{s || '-'}</span>
                    })()}
                  </div>
                </div>
              ))}
            </div>
            </div>
          </div>
        </>
      ) : (
        // Formulário Nova OS
        <div className="mt-2">
          <div className="flex items-center justify-between mb-3">
            <button onClick={()=>setView('list')} className="px-3 py-2 border rounded text-sm">← Voltar</button>
            <div className="flex items-center gap-2">
              <button className="px-3 py-2 border rounded text-sm">Opções</button>
              <button className="px-3 py-2 rounded text-sm bg-green-600 text-white">+ Nova</button>
            </div>
          </div>

          {/* Layout responsivo: 1 coluna no mobile, 2 colunas no desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Coluna esquerda */}
            <div className="space-y-6">
              <div className="rounded-lg bg-white p-6 shadow">
                <div className="font-semibold text-lg">Dados Gerais</div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-600">Cliente</label>
                    <input readOnly value={client} onClick={()=>setClientSelectOpen(true)} className="mt-1 w-full border rounded px-3 py-2 text-sm cursor-pointer bg-gray-50" placeholder="Selecionar cliente" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Técnico</label>
                    <input readOnly value={technician} onClick={()=>setTechSelectOpen(true)} className="mt-1 w-full border rounded px-3 py-2 text-sm cursor-pointer bg-gray-50" placeholder="Selecionar técnico" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Atendente</label>
                    <input readOnly value={attendant} onClick={()=>setAttendantSelectOpen(true)} className="mt-1 w-full border rounded px-3 py-2 text-sm cursor-pointer bg-gray-50" placeholder="Selecionar atendente" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Data Entrada</label>
                    <input type="datetime-local" value={dateIn} onChange={e=>setDateIn(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Previsão de entrega</label>
                    <input type="datetime-local" value={expectedDate} onChange={e=>setExpectedDate(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Marca</label>
                    <input value={brand} onChange={e=>setBrand(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Modelo</label>
                    <input value={model} onChange={e=>setModel(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Número de série</label>
                    <input value={serialNumber} onChange={e=>setSerialNumber(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-600">Equipamento</label>
                    <textarea value={equipment} onChange={e=>setEquipment(e.target.value)} rows={4} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Problema</label>
                    <textarea value={problem} onChange={e=>setProblem(e.target.value)} rows={4} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-600">Observações de recebimento</label>
                    <textarea value={receiptNotes} onChange={e=>setReceiptNotes(e.target.value)} rows={4} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Observações internas</label>
                    <textarea value={internalNotes} onChange={e=>setInternalNotes(e.target.value)} rows={4} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-6 shadow">
                <div className="font-semibold text-lg">Outros</div>
                <div className="mt-4 flex gap-3">
                  <button type="button" className="px-3 py-2 border rounded text-sm">Adicionar Senha</button>
                  <button type="button" className="px-3 py-2 border rounded text-sm">Adicionar Checklist</button>
                  <button type="button" className="px-3 py-2 border rounded text-sm">Adicionar Arquivo</button>
                </div>
              </div>

              <div className="rounded-lg bg-white p-6 shadow">
                <div className="font-semibold text-lg">Serviços</div>
                <div className="mt-3 text-sm text-gray-600">Nenhum serviço adicionado...</div>
                <div className="mt-3"><button type="button" className="px-3 py-2 border rounded text-sm">Adicionar Serviço</button></div>
              </div>

              <div className="rounded-lg bg-white p-6 shadow">
                <div className="font-semibold text-lg">Produtos</div>
                {osProducts.length === 0 ? (
                  <div className="mt-3 text-sm text-gray-600">Nenhum produto adicionado...</div>
                ) : (
                  <div className="mt-3">
                    {osProducts.map((p, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_6rem_8rem_2rem] items-center gap-3 py-2 border-b last:border-0 text-sm">
                        <div>
                          <div className="font-medium">{p.name}</div>
                          {p.variationName && <div className="text-xs text-gray-600">• {p.variationName}</div>}
                        </div>
                        <div className="text-right">{p.quantity}</div>
                        <div className="text-right">{(p.price * p.quantity).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                        <button type="button" onClick={()=>removeProduct(idx)} className="text-gray-500">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3"><button type="button" onClick={openAddProduct} className="px-3 py-2 border rounded text-sm">Adicionar Produto</button></div>
              </div>
            </div>

            {/* Coluna direita */}
            <div className="space-y-6">
              <div className="rounded-lg bg-white p-6 shadow">
                <div className="font-semibold text-lg">Total</div>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 border rounded">
                    <div className="text-xs text-gray-500">Total de serviços</div>
                    <div className="text-right">{(0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                  </div>
                  <div className="p-3 border rounded">
                    <div className="text-xs text-gray-500">Total de produtos</div>
                    <div className="text-right">{(totalProductsAgg).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                  </div>
                  <div className="p-3 border rounded">
                    <div className="text-xs text-gray-500">Desconto</div>
                    <div className="text-right">{(0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                  </div>
                  <div className="p-3 border rounded">
                    <div className="text-xs text-gray-500">Total da OS</div>
                    <div className="text-right">{(totalProductsAgg).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-6 shadow">
                <div className="font-semibold text-lg">Pagamento</div>
                {osPayments.length === 0 ? (
                  <div className="mt-3 text-sm text-gray-600">Nenhum pagamento adicionado...</div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {osPayments.map((p, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_8rem] items-center gap-3 text-sm">
                        <div className="leading-tight">
                          <div className="font-medium">{p.method}</div>
                          {p.change > 0 && (
                            <div className="text-xs text-gray-600">Troco: {p.change.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                          )}
                        </div>
                        <div className="text-right">{p.amount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                      </div>
                    ))}
                    <div className="grid grid-cols-[1fr_8rem] items-center gap-3 text-sm border-t pt-2 mt-2">
                      <div className="text-gray-600">Restante a pagar</div>
                      <div className="text-right font-semibold">{remainingToPay.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                    </div>
                  </div>
                )}
                <div className="mt-3"><button type="button" onClick={()=>setPayMethodsOpen(true)} className="px-3 py-2 border rounded text-sm">Editar Pagamento</button></div>
              </div>

              <div className="rounded-lg bg-white p-6 shadow">
                <div className="font-semibold text-lg">Observações</div>
                <textarea rows={3} className="mt-3 w-full border rounded px-3 py-2 text-sm" placeholder="Observações do serviço" />
                <div className="mt-6">
                  <div className="text-sm text-gray-600">Informações de garantia</div>
                  <textarea rows={6} value={warrantyInfo} onChange={e=>setWarrantyInfo(e.target.value)} className="mt-2 w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div className="mt-4">
                  <div className="text-sm text-gray-700">Status atual: <span className="inline-block px-2 py-1 rounded bg-gray-100 border text-gray-800">{status}</span></div>
                </div>
                <div className="mt-6 flex items-center justify-end gap-3">
                  <button type="button" onClick={()=>setStatusModalOpen(true)} className="px-3 py-2 border rounded text-sm">Alterar Status</button>
                  <button type="button" className="px-3 py-2 border rounded text-sm">Salvar e Imprimir</button>
                  <button disabled={saving} type="button" onClick={handleSave} className="px-3 py-2 rounded text-sm bg-green-600 text-white disabled:opacity-60">Salvar</button>
                </div>
              </div>
            </div>
          </div>

          {/* Modais */}
          {addProdOpen && (
            <AddProductModal
              open={addProdOpen}
              onClose={()=>setAddProdOpen(false)}
              product={selectedProduct}
              variation={selectedVariation}
              onOpenSelect={()=>setProdSelectOpen(true)}
              onOpenVariation={()=>{
                if(selectedProduct && selectedProduct.variations > 0 && selectedProduct.variationsData && selectedProduct.variationsData.length > 0){
                  setVarSelectOpen(true)
                }
              }}
              qty={qtyInput}
              setQty={setQtyInput}
              price={priceInput}
              setPrice={setPriceInput}
              onConfirm={()=>{
                if(!selectedProduct) return;
                const item = {
                  productId: selectedProduct.id,
                  name: selectedProduct.name,
                  variationName: selectedVariation ? selectedVariation.name : null,
                  price: parseFloat(priceInput)||0,
                  quantity: parseFloat(qtyInput)||1,
                }
                setOsProducts(prev=>[...prev, item])
                setAddProdOpen(false)
              }}
            />
          )}
          {prodSelectOpen && (
            <SelectProductModal
              open={prodSelectOpen}
              onClose={()=>setProdSelectOpen(false)}
              products={productsAll}
              onChoose={(p)=>{
                setSelectedProduct(p)
                setSelectedVariation(null)
                setProdSelectOpen(false)
                // Verificar se o produto tem variações
                if(p.variations > 0 && p.variationsData && p.variationsData.length > 0){
                  setVarSelectOpen(true)
                } else {
                  setAddProdOpen(true)
                }
              }}
              onNew={()=>{ setProdSelectOpen(false); setNewProductOpen(true) }}
            />
          )}
          {varSelectOpen && (
            <SelectVariationModal
              open={varSelectOpen}
              onClose={()=>setVarSelectOpen(false)}
              product={selectedProduct}
              onChoose={(variation)=>{
                setSelectedVariation(variation)
                setVarSelectOpen(false)
                setAddProdOpen(true)
              }}
            />
          )}
          <NewProductModal open={newProductOpen} onClose={()=>setNewProductOpen(false)} categories={categories} suppliers={suppliers} storeId={storeId} />
          {clientSelectOpen && (
            <SelectClientModal
              open={clientSelectOpen}
              onClose={()=>setClientSelectOpen(false)}
              clients={clientsAll}
              onChoose={(c)=>{ setClient(c.name||''); setClientSelectOpen(false) }}
              onNew={()=>{ setClientSelectOpen(false); setNewClientOpen(true) }}
            />
          )}
          <NewClientModal open={newClientOpen} onClose={()=>setNewClientOpen(false)} storeId={storeId} />
          {techSelectOpen && (
            <SelectClientModal
              open={techSelectOpen}
              onClose={()=>setTechSelectOpen(false)}
              clients={techniciansList}
              onChoose={(u)=>{ setTechnician(u.name||''); setTechSelectOpen(false) }}
            />
          )}
          {attendantSelectOpen && (
            <SelectClientModal
              open={attendantSelectOpen}
              onClose={()=>setAttendantSelectOpen(false)}
              clients={attendantsList}
              onChoose={(u)=>{ setAttendant(u.name||''); setAttendantSelectOpen(false) }}
            />
          )}
          {statusModalOpen && (
            <UpdateStatusModal
              open={statusModalOpen}
              onClose={()=>setStatusModalOpen(false)}
              initialDate={dateIn}
              initialStatus={status}
              internalNotes={internalNotes}
              receiptNotes={receiptNotes}
              onConfirm={(v)=>{
                setStatus(v.status)
                setDateIn(v.dateIn)
                setInternalNotes(v.internalNotes)
                setReceiptNotes(v.receiptNotes)
                setStatusModalOpen(false)
              }}
            />
          )}
          {payMethodsOpen && (
            <PaymentMethodsModal
              open={payMethodsOpen}
              onClose={()=>setPayMethodsOpen(false)}
              remaining={remainingToPay}
              payments={osPayments}
              onRemovePayment={(idx)=>setOsPayments(prev=>prev.filter((_,i)=>i!==idx))}
              onChooseMethod={(m)=>{
                setSelectedPayMethod(m)
                setPayAmountInput(String(remainingToPay))
                setPayError('')
                setPayAmountOpen(true)
              }}
              onConfirm={()=>setPayMethodsOpen(false)}
            />
          )}
          {payAmountOpen && (
            <PaymentAmountModal
              open={payAmountOpen}
              onClose={()=>setPayAmountOpen(false)}
              method={selectedPayMethod}
              remaining={remainingToPay}
              amount={payAmountInput}
              setAmount={setPayAmountInput}
              error={payError}
              setError={setPayError}
              onConfirm={()=>{
                const amt = parseFloat(payAmountInput)||0
                if(!selectedPayMethod) return
                if(selectedPayMethod.code === 'cash'){
                  const applied = Math.min(amt, remainingToPay)
                  const change = Math.max(amt - remainingToPay, 0)
                  const newRemaining = Math.max(remainingToPay - applied, 0)
                  setOsPayments(prev=>[...prev, { method: selectedPayMethod.label, methodCode: selectedPayMethod.code, amount: applied, change }])
                  setPayAmountOpen(false)
                  setRemainingSnapshot(newRemaining)
                  if(newRemaining > 0){ setRemainingInfoOpen(true) }
                } else {
                  if(amt > remainingToPay){
                    setPayAmountOpen(false)
                    setPayAboveConfirmOpen(true)
                    return
                  }
                  const newRemaining = Math.max(remainingToPay - amt, 0)
                  setOsPayments(prev=>[...prev, { method: selectedPayMethod.label, methodCode: selectedPayMethod.code, amount: amt }])
                  setPayAmountOpen(false)
                  setRemainingSnapshot(newRemaining)
                  if(newRemaining > 0){ setRemainingInfoOpen(true) }
                }
              }}
            />
          )}
          {payAboveConfirmOpen && (
            <AboveAmountConfirmModal
              open={payAboveConfirmOpen}
              amount={parseFloat(payAmountInput)||0}
              remaining={remainingToPay}
              method={selectedPayMethod}
              onCancel={()=>{ setPayAboveConfirmOpen(false); setPayAmountOpen(true) }}
              onConfirm={()=>{
                const amt = parseFloat(payAmountInput)||0
                const applied = Math.min(amt, remainingToPay)
                const newRemaining = Math.max(remainingToPay - applied, 0)
                setOsPayments(prev=>[...prev, { method: selectedPayMethod?.label, methodCode: selectedPayMethod?.code, amount: applied }])
                setPayAboveConfirmOpen(false)
                setAfterAboveAdjustedOpen(true)
                setRemainingSnapshot(newRemaining)
                if(newRemaining > 0){ setRemainingInfoOpen(true) }
              }}
            />
          )}
          {remainingInfoOpen && (
            <PaymentRemainingModal
              open={remainingInfoOpen}
              remaining={remainingSnapshot}
              onClose={()=>setRemainingInfoOpen(false)}
              onAddMore={()=>{ setRemainingInfoOpen(false); setPayMethodsOpen(true) }}
            />
          )}
          {afterAboveAdjustedOpen && (
            <AfterAboveAdjustedModal
              open={afterAboveAdjustedOpen}
              method={selectedPayMethod}
              remaining={remainingSnapshot}
              onClose={()=>setAfterAboveAdjustedOpen(false)}
            />
          )}
          {prodSelectOpen && (
            <SelectProductModal
              open={prodSelectOpen}
              onClose={()=>setProdSelectOpen(false)}
              products={productsAll}
              onChoose={(p)=>{
                setSelectedProduct(p)
                setSelectedVariation(null)
                setProdSelectOpen(false)
                // Verificar se o produto tem variações
                if(p.variations > 0 && p.variationsData && p.variationsData.length > 0){
                  setVarSelectOpen(true)
                } else {
                  setAddProdOpen(true)
                }
              }}
              onNew={()=>{ setProdSelectOpen(false); setNewProductOpen(true) }}
            />
          )}
          {varSelectOpen && (
            <SelectVariationModal
              open={varSelectOpen}
              onClose={()=>setVarSelectOpen(false)}
              product={selectedProduct}
              onChoose={(variation)=>{
                setSelectedVariation(variation)
                setVarSelectOpen(false)
                setAddProdOpen(true)
              }}
            />
          )}
          <NewProductModal open={newProductOpen} onClose={()=>setNewProductOpen(false)} categories={categories} suppliers={suppliers} storeId={storeId} />
          {clientSelectOpen && (
            <SelectClientModal
              open={clientSelectOpen}
              onClose={()=>setClientSelectOpen(false)}
              clients={clientsAll}
              onChoose={(c)=>{ setClient(c.name||''); setClientSelectOpen(false) }}
              onNew={()=>{ setClientSelectOpen(false); setNewClientOpen(true) }}
            />
          )}
          <NewClientModal open={newClientOpen} onClose={()=>setNewClientOpen(false)} storeId={storeId} />
        </div>
      )}
    </div>
  )
}

function SelectVariationModal({ open, onClose, product, onChoose }){
  const [query, setQuery] = useState('')
  if(!open || !product) return null
  
  const variations = product.variationsData || []
  const filtered = variations.filter(v => (v.name||'').toLowerCase().includes(query.trim().toLowerCase()))
  
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[680px] max-w-[95vw]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Selecionar Variação</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-4">
          <input 
            value={query} 
            onChange={e=>setQuery(e.target.value)} 
            placeholder="Pesquisar variação..." 
            className="w-full border rounded px-3 py-2 text-sm" 
          />
          <div className="mt-3 max-h-[60vh] overflow-y-auto">
            {filtered.map((variation, idx) => {
              const price = variation.promoPrice ?? variation.salePrice ?? 0
              const stock = variation.stock ?? variation.stockInitial ?? 0
              return (
                <div 
                  key={idx} 
                  className="grid grid-cols-[1fr_8rem_6rem] items-center gap-3 px-2 py-3 border-b last:border-0 text-sm cursor-pointer hover:bg-gray-50" 
                  onClick={()=>onChoose(variation)}
                >
                  <div>
                    <div className="font-medium">{variation.name}</div>
                  </div>
                  <div className="text-right">{price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                  <div className="text-right text-gray-600">Est: {stock}</div>
                </div>
              )
            })}
            {filtered.length===0 && (<div className="text-sm text-gray-600 px-2 py-3">Nenhuma variação encontrada.</div>)}
          </div>
        </div>
        <div className="p-4 border-t flex items-center justify-end">
          <button type="button" onClick={onClose} className="px-3 py-2 border rounded text-sm">Voltar</button>
        </div>
      </div>
    </div>
  )
}

function UpdateStatusModal({ open, onClose, initialDate, initialStatus, internalNotes, receiptNotes, onConfirm }){
  const [date, setDate] = useState(initialDate || '')
  const [statusSel, setStatusSel] = useState(initialStatus || 'Iniciado')
  const [internal, setInternal] = useState(internalNotes || '')
  const [receipt, setReceipt] = useState(receiptNotes || '')
  if (!open) return null

  const statuses = [
    'Iniciado',
    'Finalizado',
    'Os Finalizada e Faturada Cliente Final',
    'Cancelado',
    'Serviço Aprovado Em Procedimento Com tecnico',
    'Os Finalizada e Faturada Cliente lojista',
    'Serviço Realizado Pronto Na gaveta',
    'Serviço Não Aprovado P/cliente Devoluçao na gaveta',
    'Garantia de Peça e Serviço Cliente lojista',
    'Devolução cliente Lojista Já na gaveta',
    'Peça Para Troca e Devolução ao Fornecedor',
    'Serviço Aguardando Peça Na Gaveta',
    'Devolução Cliente Final Já na gaveta',
    'Garantia de Peça e Serviço Cliente Final',
    'Serviço Não Realizado Devolução Na gaveta',
    'Serviço em Orçamento com tecnico',
    'Os já devolvido ao Cliente final - Sem Conserto',
    'Os já devolvida ao lojista - Sem conserto',
    'Devolução já entreque ao cliente',
  ]

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[640px] max-w-[95vw]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Atualizar Status</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-gray-600">Data de Entrada</label>
            <input type="datetime-local" value={date} onChange={e=>setDate(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-600">Status</label>
            <select value={statusSel} onChange={e=>setStatusSel(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm">
              {statuses.map(s => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">Observações Internas</label>
            <textarea rows={3} value={internal} onChange={e=>setInternal(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-600">Observações para o cliente</label>
            <textarea rows={3} value={receipt} onChange={e=>setReceipt(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div className="text-xs text-gray-600">* As informações acima serão atualizadas após confirmar.</div>
        </div>
        <div className="p-4 border-t flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 border rounded text-sm">Cancelar</button>
          <button
            type="button"
            onClick={()=>onConfirm && onConfirm({
              status: statusSel,
              dateIn: date || '',
              internalNotes: internal,
              receiptNotes: receipt,
            })}
            className="px-3 py-2 rounded text-sm bg-green-600 text-white"
          >Confirmar</button>
        </div>
      </div>
    </div>
  )
}

function PaymentMethodsModal({ open, onClose, onChoose, onChooseMethod, onConfirm, remaining, payments, onRemovePayment }) {
  if (!open) return null

  const chooseHandler = onChoose || onChooseMethod

  const paymentMethods = [
    { 
      code: 'cash', 
      label: 'Dinheiro',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M7,15H9C9,16.08 10.37,17 12,17C13.63,17 15,16.08 15,15C15,13.9 13.96,13.5 11.76,12.97C9.64,12.44 7,11.78 7,9C7,7.21 8.47,5.69 10.5,5.18V3H13.5V5.18C15.53,5.69 17,7.21 17,9H15C15,7.92 13.63,7 12,7C10.37,7 9,7.92 9,9C9,10.1 10.04,10.5 12.24,11.03C14.36,11.56 17,12.22 17,15C17,16.79 15.53,18.31 13.5,18.82V21H10.5V18.82C8.47,18.31 7,16.79 7,15Z"/>
        </svg>
      )
    },
    { 
      code: 'pix', 
      label: 'PIX Lojista',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8Z"/>
        </svg>
      )
    },
    { 
      code: 'debit_card', 
      label: 'Cartão De Débito',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.11,4 20,4M20,18H4V12H20V18M20,8H4V6H20V8Z"/>
        </svg>
      )
    },
    { 
      code: 'debit_card_lojista', 
      label: 'Cartão De Débito Lojista',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.11,4 20,4M20,18H4V12H20V18M20,8H4V6H20V8Z"/>
        </svg>
      )
    },
    { 
      code: 'credit_card', 
      label: 'Cartão De Crédito',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.11,4 20,4M20,18H4V12H20V18M20,8H4V6H20V8M7,15H9V17H7V15M11,15H17V17H11V15Z"/>
        </svg>
      )
    },
    { 
      code: 'credit_card_lojista', 
      label: 'Cartão De Crédito Lojista',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.11,4 20,4M20,18H4V12H20V18M20,8H4V6H20V8M7,15H9V17H7V15M11,15H17V17H11V15Z"/>
        </svg>
      )
    },
    { 
      code: 'cheque', 
      label: 'Cheque',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M21,5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5M19,19H5V5H19V19M17,17H7V15H17V17M17,13H7V11H17V13M17,9H7V7H17V9Z"/>
        </svg>
      )
    },
    { 
      code: 'conta', 
      label: 'Conta',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,19H5V5H19V19M17,12H7V10H17V12M15,16H7V14H15V16M17,8H7V6H17V8Z"/>
        </svg>
      )
    },
    { 
      code: 'troca_pecas', 
      label: 'TROCA DE PEÇAS - SH',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
        </svg>
      )
    },
    { 
      code: 'vale_funcionario', 
      label: 'Vale Funcionário',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
        </svg>
      )
    },
    { 
      code: 'garantia_conserto', 
      label: 'GARANTIA DE CONSERTO - GRATUITO',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11.5H16.3V16H7.7V11.5H9.2V10C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.5,8.7 10.5,10V11.5H13.5V10C13.5,8.7 12.8,8.2 12,8.2Z"/>
        </svg>
      )
    },
    { 
      code: 'garantia_produto', 
      label: 'GARANTIA DE PRODUTO ESPECÍFICO',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M10,17L6,13L7.41,11.59L10,14.17L16.59,7.58L18,9L10,17Z"/>
        </svg>
      )
    },
    { 
      code: 'crediario', 
      label: 'Crediário',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,19H5V5H19V19M17,12H7V10H17V12M15,16H7V14H15V16M17,8H7V6H17V8Z"/>
        </svg>
      )
    }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[600px] max-w-[95vw] md:max-w-[80vw] max-h-[90vh] md:max-h-[80vh] overflow-y-auto md:overflow-hidden">
        <div className="p-4 border-b">
          <div className="text-center">
            <div className="text-sm text-gray-600">Restante a pagar:</div>
            <div className="text-3xl font-bold">R$ {Number(remaining||0).toFixed(2)}</div>
          </div>
          {payments && payments.length > 0 && (
            <div className="mt-3">
              {payments.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between py-2">
                  <div className="flex items-center">
                    <div className="mr-2">{(paymentMethods.find(m=>m.code===p.methodCode)||{}).icon}</div>
                    <span className="text-gray-700">{p.method}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="mr-3 font-medium">{p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    {onRemovePayment && (
                      <button type="button" onClick={() => onRemovePayment(idx)} className="text-gray-500 hover:text-red-600">✕</button>
                    )}
                  </div>
                </div>
              ))}
              <div className="border-t"></div>
            </div>
          )}
          <h2 className="text-sm font-medium mt-2 text-center">Selecionar forma de pagamento:</h2>
        </div>
        <div className="p-4 max-h-[60vh] md:max-h-96 overflow-y-auto">
          <div className="grid grid-cols-3 gap-2">
            {paymentMethods.map((method) => (
              <button
                key={method.code}
                onClick={() => chooseHandler && chooseHandler(method)}
                className="flex flex-col items-center p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 hover:border-green-300 transition-colors min-h-[80px]"
              >
                <div className="mb-1">
                  {method.icon}
                </div>
                <div className="text-xs font-medium text-center text-green-800 leading-tight">{method.label}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 border-t flex items-center justify-end space-x-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50">
            ✕ Cancelar
          </button>
          <button type="button" onClick={onConfirm} className="px-4 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600">
            ✓ Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

function PaymentAmountModal({ open, onClose, method, remaining, amount, setAmount, error, setError, onConfirm }) {
  if (!open) return null

  const handleAmountChange = (e) => {
    const value = e.target.value
    setAmount(value)
    setError('')
  }

  const handleConfirm = () => {
    const amt = parseFloat(amount) || 0
    if (amt <= 0) {
      setError('Valor deve ser maior que zero')
      return
    }
    onConfirm()
  }

  const currentAmount = parseFloat(amount) || 0
  const willHaveChange = method?.code === 'cash' && currentAmount > remaining
  const changeAmount = willHaveChange ? currentAmount - remaining : 0
  const appliedAmount = method?.code === 'cash' ? Math.min(currentAmount, remaining) : Math.min(currentAmount, remaining)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-96 max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Valor do pagamento</h2>
          <div className="text-center mt-1 font-medium">
            {method?.label}
          </div>
        </div>
        <div className="p-4">
          <div className="mb-4">
            <div className="flex items-center space-x-3">
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0,00"
                className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                autoFocus
              />
              <div className="px-3 py-2 border rounded-lg text-sm">
                <div className="text-gray-500">Valor</div>
                <div className="font-semibold">R$ {currentAmount.toFixed(2)}</div>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>

          <div className="text-sm text-gray-600">Restante a pagar: R$ {remaining.toFixed(2)}</div>

          {currentAmount > 0 && (
            <div className="space-y-3 mt-3">
              {method?.code === 'cash' && willHaveChange && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    💰 Troco de R$ {changeAmount.toFixed(2)} será registrado
                  </p>
                </div>
              )}

              {method?.code !== 'cash' && currentAmount > remaining && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Valor acima do restante. Será aplicado apenas R$ {remaining.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="p-4 border-t flex items-center justify-end space-x-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={handleConfirm} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">Confirmar</button>
        </div>
      </div>
    </div>
  )
}

function AboveAmountConfirmModal({ open, amount, remaining, method, onCancel, onConfirm }) {
  if (!open) return null

  const excessAmount = amount - remaining

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-96 max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center">
            <svg className="w-5 h-5 text-yellow-500 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12,2L13.09,8.26L22,9L13.09,9.74L12,16L10.91,9.74L2,9L10.91,8.26L12,2Z"/>
            </svg>
            Valor Acima do Restante
          </h2>
        </div>
        <div className="p-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Valor informado:</span>
              <span className="font-bold text-lg">R$ {amount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Valor restante:</span>
              <span className="font-medium">R$ {remaining.toFixed(2)}</span>
            </div>
            <div className="border-t border-yellow-300 pt-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Excesso:</span>
                <span className="font-medium text-yellow-700">R$ {excessAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center mb-4">
            {method?.icon && <div className="mr-2">{method.icon}</div>}
            <div>
              <p className="font-medium">Método: {method?.label}</p>
              <p className="text-sm text-gray-600">
                Será aplicado apenas R$ {remaining.toFixed(2)} para este método
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              💡 O valor será ajustado automaticamente para não exceder o restante da compra.
            </p>
          </div>
        </div>
        <div className="p-4 border-t flex items-center justify-end space-x-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
            Voltar e Corrigir
          </button>
          <button type="button" onClick={onConfirm} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">
            Aplicar R$ {remaining.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  )
}

function PaymentRemainingModal({ open, remaining, onClose, onAddMore }) {
  if (!open) return null

  const percentagePaid = remaining > 0 ? ((100 - (remaining / (remaining + 100)) * 100)) : 100

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-96 max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center">
            <svg className="w-5 h-5 text-orange-500 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,17A1.5,1.5 0 0,1 10.5,15.5A1.5,1.5 0 0,1 12,14A1.5,1.5 0 0,1 13.5,15.5A1.5,1.5 0 0,1 12,17M12,10A1,1 0 0,1 13,11V13A1,1 0 0,1 11,13V11A1,1 0 0,1 12,10Z"/>
            </svg>
            Pagamento Parcial
          </h2>
        </div>
        <div className="p-4">
          <div className="text-center mb-4">
            <div className="text-3xl font-bold text-orange-600 mb-2">
              R$ {remaining.toFixed(2)}
            </div>
            <p className="text-gray-600">ainda resta para completar o pagamento</p>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Status do pagamento:</span>
              <span className="font-medium text-orange-600">Parcial</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-orange-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${Math.max(percentagePaid, 10)}%` }}
              ></div>
            </div>
          </div>

          <p className="text-center text-gray-600 mb-4">
            Você pode finalizar com pagamento parcial ou adicionar outro método de pagamento.
          </p>
        </div>
        <div className="p-4 border-t flex items-center justify-end space-x-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
            Finalizar Parcial
          </button>
          <button type="button" onClick={onAddMore} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">
            + Adicionar Pagamento
          </button>
        </div>
      </div>
    </div>
  )
}

function AfterAboveAdjustedModal({ open, method, remaining, onClose }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-96 max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center">
            <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
            </svg>
            Pagamento Ajustado com Sucesso
          </h2>
        </div>
        <div className="p-4">
          <div className="flex items-center mb-4">
            {method?.icon && <div className="mr-2">{method.icon}</div>}
            <div>
              <p className="font-medium">Método: {method?.label}</p>
              <p className="text-sm text-gray-600">
                Pagamento registrado com sucesso
              </p>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-green-800">
              ✅ O pagamento foi ajustado automaticamente para não exceder o valor restante da compra.
            </p>
          </div>

          {remaining > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Ainda resta:</span>
                <span className="font-bold text-lg text-orange-600">R$ {remaining.toFixed(2)}</span>
              </div>
              <p className="text-sm text-orange-700 mt-1">
                Você pode adicionar mais formas de pagamento para completar.
              </p>
            </div>
          )}
        </div>
        <div className="p-4 border-t flex items-center justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600">
            Continuar
          </button>
        </div>
      </div>
    </div>
  )
}

function AddProductModal({ open, onClose, product, variation, onOpenSelect, onOpenVariation, qty, setQty, price, setPrice, onConfirm }){
  if(!open) return null
  
  const hasVariations = product && product.variations > 0 && product.variationsData && product.variationsData.length > 0
  
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[640px] max-w-[95vw]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Adicionar Produto</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-gray-600">Produto</label>
            <button type="button" onClick={onOpenSelect} className="mt-1 w-full border rounded px-3 py-2 text-sm text-left flex items-center justify-between">
              <span>{product ? product.name : 'Selecionar produto'}</span>
              <span>›</span>
            </button>
          </div>
          {hasVariations && (
            <div>
              <label className="text-xs text-gray-600">Variação</label>
              <button 
                type="button" 
                onClick={onOpenVariation} 
                className="mt-1 w-full border rounded px-3 py-2 text-sm text-left flex items-center justify-between"
              >
                <span>{variation ? variation.name : 'Selecionar variação'}</span>
                <span>›</span>
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-600">Quantidade</label>
              <input type="number" min="1" step="1" value={qty} onChange={e=>setQty(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-600">Preço</label>
              <input type="number" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
        <div className="p-4 border-t flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 border rounded text-sm">Cancelar</button>
          <button type="button" onClick={onConfirm} className="px-3 py-2 rounded text-sm bg-green-600 text-white">Confirmar</button>
        </div>
      </div>
    </div>
  )
}

function SelectProductModal({ open, onClose, products, onChoose, onNew }){
  const [query, setQuery] = useState('')
  if(!open) return null
  const filtered = (products||[]).filter(p => (p.name||'').toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[680px] max-w-[95vw]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Selecionar Produto</h3>
          <button onClick={onNew} className="px-3 py-1 rounded text-xs bg-green-600 text-white">+ Novo</button>
        </div>
        <div className="p-4">
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pesquisar..." className="w-full border rounded px-3 py-2 text-sm" />
          <div className="mt-3 max-h-[60vh] overflow-y-auto">
            {filtered.map(p => (
              <div key={p.id} className="grid grid-cols-[1fr_8rem] items-center gap-3 px-2 py-3 border-b last:border-0 text-sm cursor-pointer" onClick={()=>onChoose(p)}>
                <div>
                  <div className="font-medium">{p.name}</div>
                </div>
                <div className="text-right">{(p.priceMin ?? p.salePrice ?? 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
              </div>
            ))}
            {filtered.length===0 && (<div className="text-sm text-gray-600 px-2 py-3">Nenhum produto encontrado.</div>)}
          </div>
        </div>
        <div className="p-4 border-t flex items-center justify-end">
          <button type="button" onClick={onClose} className="px-3 py-2 border rounded text-sm">Voltar</button>
        </div>
      </div>
    </div>
  )
}
