import React, { useMemo, useState, useEffect, useRef } from 'react'
import { listenOrders, addOrder, updateOrder } from '../services/orders'
import { recordStockMovement } from '../services/stockMovements'
import { listenProducts, updateProduct } from '../services/products'
import NewProductModal from './NewProductModal'
import { listenCategories } from '../services/categories'
import { listenSuppliers } from '../services/suppliers'
import { listenClients } from '../services/clients'
import NewClientModal from './NewClientModal'
import SelectClientModal from './SelectClientModal'
import SelectVariationModal from './SelectVariationModal'
import { PaymentMethodsModal, PaymentAmountModal, AboveAmountConfirmModal, PaymentRemainingModal, AfterAboveAdjustedModal } from './PaymentModals'
import { listenSubUsers } from '../services/users'
import SalesDateFilterModal from './SalesDateFilterModal'
import SelectColumnsModal from './SelectColumnsModal'
import { listenCurrentCash, addCashTransaction, removeCashTransactionsByOrder } from '../services/cash'
import { listenStore } from '../services/stores'
import { listenServices, addService, updateService } from '../services/services'
import ChooseFinalStatusModal from './ChooseFinalStatusModal'
import ShareOrderModal from './ShareOrderModal'
import ServiceOrderSettingsModal from './ServiceOrderSettingsModal'
import SelectChecklistModal from './SelectChecklistModal'
import ChecklistQuestionsModal from './ChecklistQuestionsModal'

const hexToRgba = (hex, alpha = 1) => {
  let c;
  if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
    c= hex.substring(1).split('');
    if(c.length== 3){
      c= [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c= '0x'+c.join('');
    return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
  }
  return hex;
}

const darkenColor = (hex, percent) => {
  let r = 0, g = 0, b = 0;
  if (!hex) return '#000000';
  if (hex.length === 4) {
    r = parseInt("0x" + hex[1] + hex[1]);
    g = parseInt("0x" + hex[2] + hex[2]);
    b = parseInt("0x" + hex[3] + hex[3]);
  } else if (hex.length === 7) {
    r = parseInt("0x" + hex[1] + hex[2]);
    g = parseInt("0x" + hex[3] + hex[4]);
    b = parseInt("0x" + hex[5] + hex[6]);
  } else {
    return hex;
  }
  r = Math.floor(r * (100 - percent) / 100);
  g = Math.floor(g * (100 - percent) / 100);
  b = Math.floor(b * (100 - percent) / 100);
  return "rgb(" + r + "," + g + "," + b + ")";
}

const DEFAULT_WARRANTY = `Garantia de produtos e serviços. 
90 dias para defeito de fabricação. 
Não cobre aparelho ou produto com sinais de humidade. 
Não cobre produto quebrado . 
Não cobre riscos na tela. 
Não cobre trincos na tela. 
Não cobre manchas ,listras trincos internos 
Ou externos na peça . 
Não cobre selo ou lacre rompido. 
Fica ciente que cliente em caso de defetio 
deve Retornar A empresa,No prazo estabelecido. 
Em caso de insatisfação cliente tem 7 dias 
Para pedir estorno... E a empresa não tem responsabilidade 
de colocar a peça velha no lugar, pois sao descartadas diariamente. 
Visando e focanda na qualidade! 
todos os produto são testados na loja antes da saída para o cliente da loja e testado junto ao cliente. 
Sendo assim cliente ciente e de acordo 
Com todos os termos acima, citado.`

const DEFAULT_STATUSES = [
  'Iniciado',
  'Finalizado',
  'Os Faturada Cliente Final',
  'Cancelado',
  'Serviço Aprovado Em Procedimento Com Tecnico',
  'Os Faturada Cliente lojista',
  'Serviço Realizado Pronto Na Gaveta',
  'Serviço Não Aprovado P/cliente Devoluçao Na Gaveta',
  'Garantia De Peça E Serviço Cliente lojista',
  'Devolução Cliente Lojista Já Na Gaveta',
  'Peça Para Troca E Devolução Ao Fornecedor',
  'Serviço Aguardando Peça Na Gaveta',
  'Devolução Cliente Final Já Na Gaveta',
  'Garantia De Peça E Serviço Cliente Final',
  'Serviço Não Realizado Devolução Na Gaveta',
  'Serviço Em Orçamento Com Tecnico',
  'Os Já Devolvida Ao Lojista - Sem Conserto',
  'Os Já Devolvido Ao Cliente Final - Sem Conserto',
  'Devolução Já Entregue Ao Cliente',
  'APARELHO LIBERADO AGUARDANDO PAGAMENTO'
]

export default function ServiceOrdersPage({ storeId, store, ownerId, user, addNewSignal, viewParams, setViewParams }){
  const [currentStore, setCurrentStore] = useState(store)
  const activeStore = currentStore || store

  const availableStatuses = useMemo(() => {
    if (activeStore?.serviceOrderSettings?.statuses?.length > 0) {
      return activeStore.serviceOrderSettings.statuses
        .filter(s => s.active !== false)
        .map(s => s.name)
    }
    return DEFAULT_STATUSES
  }, [activeStore])

  const statusColorMap = useMemo(() => {
    const map = {}
    if (activeStore?.serviceOrderSettings?.statuses?.length > 0) {
      activeStore.serviceOrderSettings.statuses.forEach(st => {
        if (st.color) map[st.name] = st.color
      })
    }
    return map
  }, [activeStore])

  useEffect(() => {
    if(storeId) {
      return listenStore(storeId, (s) => setCurrentStore(s))
    }
  }, [storeId])

  const [view, setView] = useState('list') // 'list' | 'new' | 'edit'
  const [listTab, setListTab] = useState('os') // 'os' | 'services'
  const [query, setQuery] = useState('')
  const [periodOpen, setPeriodOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [dateFilterOpen, setDateFilterOpen] = useState(false)
  const [filterClient, setFilterClient] = useState('')
  const [filterTechnician, setFilterTechnician] = useState('')
  const [filterAttendant, setFilterAttendant] = useState('')
  const [filterStatuses, setFilterStatuses] = useState([])
  const [filterClientSelectOpen, setFilterClientSelectOpen] = useState(false)
  const [filterTechSelectOpen, setFilterTechSelectOpen] = useState(false)
  const [filterAttendantSelectOpen, setFilterAttendantSelectOpen] = useState(false)

  // Alert Modal State
  const [alertModalOpen, setAlertModalOpen] = useState(false)
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')

  const showAlert = (msg) => {
    setAlertMessage(msg)
    setAlertModalOpen(true)
  }

  const [dateRange, setDateRange] = useState(() => {
    const now = new Date()
    return {
      label: 'Este Mês',
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    }
  })

  const [orders, setOrders] = useState([])
  useEffect(() => {
    const unsub = listenOrders(items => setOrders(items), storeId)
    return () => unsub && unsub()
  }, [storeId])

  // Abrir formulário Nova OS somente quando o sinal mudar (ignora montagem inicial)
  const initialAddSignal = useRef(addNewSignal)

  const toDate = (ts) => ts?.toDate?.() ? ts.toDate() : (ts ? new Date(ts) : null)
  const filtered = useMemo(() => {
    const normalize = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    const onlyOS = orders.filter(o => {
      if (o.type === 'sale') return false
      if (!o.type) {
         const s = (o.status || '').toLowerCase()
         if (['venda', 'pedido', 'condicional', 'orçamento', 'pago'].some(st => s === st)) return false
      }
      return true
    })
    const q = query.trim().toLowerCase()
    let base = onlyOS
    if (dateRange.start || dateRange.end) {
      base = base.filter(o => {
        const d = toDate(o.dateIn ?? o.createdAt)
        if (!d) return false
        if (dateRange.start && d < dateRange.start) return false
        if (dateRange.end && d > dateRange.end) return false
        return true
      })
    }
    if (filterClient) {
      const sel = normalize(filterClient)
      base = base.filter(o => normalize(o.client).includes(sel))
    }
    if (filterTechnician) {
      const sel = normalize(filterTechnician)
      base = base.filter(o => normalize(o.technician).includes(sel))
    }
    if (filterAttendant) {
      const sel = normalize(filterAttendant)
      base = base.filter(o => normalize(o.attendant).includes(sel))
    }
    if (Array.isArray(filterStatuses) && filterStatuses.length > 0) {
      const sels = filterStatuses.map(s => normalize(s))
      base = base.filter(o => {
        const os = normalize(o.status)
        return sels.some(s => os.includes(s))
      })
    }
    if(!q) return base
    return base.filter(o => {
      const idstr = String(o.id || '').toLowerCase()
      const client = String(o.client || '').toLowerCase()
      const tech = String(o.technician || '').toLowerCase()
      const model = String(o.model || '').toLowerCase()
      const numDigits = String(o.number || '').replace(/\D/g, '')
      const qDigits = q.replace(/\D/g, '')
      const formattedNum = (() => {
        if (numDigits) {
          const n = parseInt(numDigits, 10)
          return `o.s:${String(n).padStart(4, '0')}`
        }
        const tail = String(o.id || '').slice(-4)
        return `o.s:${tail}`
      })().toLowerCase()
      return (
        idstr.includes(q) ||
        client.includes(q) ||
        tech.includes(q) ||
        model.includes(q) ||
        formattedNum.includes(q) ||
        (qDigits ? numDigits.includes(qDigits) : false)
      )
    })
  }, [orders, query, dateRange, filterClient, filterTechnician, filterAttendant, filterStatuses])

  const totalFinalizadas = useMemo(() => {
    return orders.filter(o => (o.status||'').toLowerCase().includes('finalizada')).reduce((sum, o) => sum + (o.valor||0), 0)
  }, [orders])
  const qtdFinalizadas = useMemo(() => {
    return orders.filter(o => (o.status||'').toLowerCase().includes('finalizada')).length
  }, [orders])
  const ticketMedio = useMemo(() => {
    return qtdFinalizadas > 0 ? (totalFinalizadas / qtdFinalizadas) : 0
  }, [qtdFinalizadas, totalFinalizadas])

  

  const osDefaultColumns = [
    { id: 'number', label: 'O.S.', width: '0.5fr', visible: true, align: 'left' },
    { id: 'client', label: 'Cliente', width: '2.5fr', visible: true, align: 'left' },
    { id: 'attendant', label: 'Atendente', width: '1fr', visible: true, align: 'left' },
    { id: 'technician', label: 'Técnico', width: '1fr', visible: true, align: 'left' },
    { id: 'model', label: 'Modelo', width: '1fr', visible: true, align: 'left' },
    { id: 'updatedDate', label: 'Atualizado', width: '0.8fr', visible: true, align: 'left' },
    { id: 'updatedTime', label: 'Hora', width: '0.6fr', visible: true, align: 'left' },
    { id: 'updatedBy', label: 'Funcionário', width: '0.8fr', visible: true, align: 'left' },
    { id: 'value', label: 'Valor', width: '0.8fr', visible: true, align: 'right' },
    { id: 'status', label: 'Status', width: '1fr', visible: true, align: 'left' },
  ]
  const [osColumns, setOsColumns] = useState(osDefaultColumns)
  const [selectColumnsOpen, setSelectColumnsOpen] = useState(false)
  const [rowMenuOpenId, setRowMenuOpenId] = useState(null)
  const [rowMenuPos, setRowMenuPos] = useState({ left: 0, top: 0 })
  const [statusTargetOrder, setStatusTargetOrder] = useState(null)
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
  const [imei1, setImei1] = useState('')
  const [imei2, setImei2] = useState('')
  const [equipment, setEquipment] = useState('')
  const [problem, setProblem] = useState('')
  const [receiptNotes, setReceiptNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [warrantyInfo, setWarrantyInfo] = useState(activeStore?.serviceOrderSettings?.warrantyText || DEFAULT_WARRANTY)
  const [saving, setSaving] = useState(false)
  const [unlockType, setUnlockType] = useState(null)
  const [unlockPattern, setUnlockPattern] = useState([])
  const [unlockPin, setUnlockPin] = useState('')
  const [unlockPassword, setUnlockPassword] = useState('')
  const [paymentInfo, setPaymentInfo] = useState('')
  const [checklistSelectOpen, setChecklistSelectOpen] = useState(false)
  const [selectedChecklist, setSelectedChecklist] = useState(null)
  const [checklistQuestionsOpen, setChecklistQuestionsOpen] = useState(false)
  const [checklistAnswers, setChecklistAnswers] = useState({})
  const [unlockTypeOpen, setUnlockTypeOpen] = useState(false)
  const [patternModalOpen, setPatternModalOpen] = useState(false)
  const [textUnlockOpen, setTextUnlockOpen] = useState(false)
  useEffect(() => {
    if (!rowMenuOpenId) return
    const onScroll = () => setRowMenuOpenId(null)
    const onResize = () => setRowMenuOpenId(null)
    const onDocClick = () => setRowMenuOpenId(null)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    document.addEventListener('click', onDocClick)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('click', onDocClick)
    }
  }, [rowMenuOpenId])

  // Status da OS
  const [status, setStatus] = useState('Iniciado')
  const [chooseFinalStatusOpen, setChooseFinalStatusOpen] = useState(false)
  const [finalStatusTarget, setFinalStatusTarget] = useState(null)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [shareTargetOrder, setShareTargetOrder] = useState(null)
  // Produtos na OS e modais
  const [osProducts, setOsProducts] = useState([])
  const [osServices, setOsServices] = useState([])
  const [serviceSelectOpen, setServiceSelectOpen] = useState(false)
  const [addProdOpen, setAddProdOpen] = useState(false)
  const [prodSelectOpen, setProdSelectOpen] = useState(false)
  const [newProductOpen, setNewProductOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [qtyInput, setQtyInput] = useState(1)
  const [priceInput, setPriceInput] = useState('0')
  const [productsAll, setProductsAll] = useState([])
  const [servicesAll, setServicesAll] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  // Estados para variações
  const [varSelectOpen, setVarSelectOpen] = useState(false)
  const [selectedVariation, setSelectedVariation] = useState(null)
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [serviceEditTarget, setServiceEditTarget] = useState(null)
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
    const unsubSv = listenServices(items => setServicesAll(items), storeId)
    const unsubC = listenCategories(items => setCategories(items), storeId)
    const unsubS = listenSuppliers(items => setSuppliers(items), storeId)
    const unsubClients = listenClients(items => setClientsAll(items), storeId)
    let unsubMembers
    if (ownerId) {
      unsubMembers = listenSubUsers(ownerId, (list) => setMembers(list.filter(u => (u.active ?? true))))
    }
    return () => { unsubP && unsubP(); unsubSv && unsubSv(); unsubC && unsubC(); unsubS && unsubS(); unsubClients && unsubClients(); unsubMembers && unsubMembers() }
  }, [storeId, ownerId])

  const totalProductsAgg = useMemo(() => {
    return osProducts.reduce((s, p) => s + ((parseFloat(p.price)||0) * (parseFloat(p.quantity)||0)), 0)
  }, [osProducts])
  const totalServicesAgg = useMemo(() => {
    return osServices.reduce((s, sv) => s + ((parseFloat(sv.price)||0) * (parseFloat(sv.quantity)||0)), 0)
  }, [osServices])

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
  const [currentCash, setCurrentCash] = useState(null)
  const [cashTargetOrder, setCashTargetOrder] = useState(null)

  const totalPaidAgg = useMemo(() => {
    return osPayments.reduce((s, p) => s + (parseFloat(p.amount)||0), 0)
  }, [osPayments])
  const remainingToPay = useMemo(() => {
    const r = ((parseFloat(totalProductsAgg)||0) + (parseFloat(totalServicesAgg)||0)) - (parseFloat(totalPaidAgg)||0)
    return r > 0 ? r : 0
  }, [totalProductsAgg, totalServicesAgg, totalPaidAgg])
  const osLaunchRemaining = useMemo(() => {
    if (!cashTargetOrder) return remainingToPay
    const total = Number(
      cashTargetOrder.total ??
      cashTargetOrder.totalProducts ??
      cashTargetOrder.valor ??
      (Array.isArray(cashTargetOrder.products)
        ? cashTargetOrder.products.reduce((s,p)=> s + ((parseFloat(p.price)||0)*(parseFloat(p.quantity)||0)), 0)
        : 0)
    ) || 0
    const paid = osPayments.reduce((s,p)=> s + (parseFloat(p.amount)||0), 0)
    return Math.max(0, total - paid)
  }, [cashTargetOrder, osPayments, remainingToPay])

  const techniciansList = useMemo(() => {
    return members.filter(u => (u.isTech ?? false) || /t[eé]cnico/i.test(String(u.name||'')))
  }, [members])
  const attendantsList = useMemo(() => {
    const role = (u) => String(u.role || '').toLowerCase()
    return members.filter(u => (u.isSeller ?? false) || /atendente|vendedor/i.test(String(u.name||'')) || role(u).includes('attendant') || role(u).includes('seller'))
  }, [members])

  const resetForm = () => {
    setClient(''); setTechnician(''); setAttendant(''); setDateIn(''); setExpectedDate(''); setBrand(''); setModel(''); setSerialNumber(''); setImei1(''); setImei2(''); setEquipment(''); setProblem(''); setReceiptNotes(''); setInternalNotes(''); setWarrantyInfo(activeStore?.serviceOrderSettings?.warrantyText || DEFAULT_WARRANTY)
    setOsProducts([])
    setOsServices([])
    setOsPayments([])
    setPaymentInfo('')
    setEditingOrderId(null)
    setEditingOrderNumber('')
    setStatus('Iniciado')
    setUnlockType(null); setUnlockPattern([]); setUnlockPin(''); setUnlockPassword('')
    setSelectedChecklist(null); setChecklistAnswers({})
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
    setWarrantyInfo(o.warrantyInfo || activeStore?.serviceOrderSettings?.warrantyText || DEFAULT_WARRANTY)
    setOsProducts(Array.isArray(o.products) ? o.products : [])
    setOsServices(Array.isArray(o.services) ? o.services : [])
    setOsPayments(Array.isArray(o.payments) ? o.payments : [])
    setPaymentInfo(o.paymentInfo || '')
    setEditingOrderId(o.id)
    setEditingOrderNumber(o.number || o.id)
    setStatus(o.status || 'Iniciado')
    const pw = o.password
    if (pw && typeof pw === 'object') {
      setUnlockType(pw.type || null)
      setUnlockPattern(Array.isArray(pw.pattern) ? pw.pattern : [])
      setUnlockPin(pw.type==='pin' ? (pw.value||'') : '')
      setUnlockPassword(pw.type==='password' ? (pw.value||'') : '')
    } else {
      setUnlockType(null); setUnlockPattern([]); setUnlockPin(''); setUnlockPassword('')
    }
    if (o.checklist) {
      setSelectedChecklist({ id: o.checklist.id, name: o.checklist.name, questions: o.checklist.questions || [] })
      const answers = {}
      ;(o.checklist.questions || []).forEach(q => {
        if (q.checked) answers[q.id] = true
      })
      setChecklistAnswers(answers)
    } else {
      setSelectedChecklist(null); setChecklistAnswers({})
    }
    setView('edit')
  }

  useEffect(() => {
    if (viewParams && viewParams.id && viewParams.type === 'os' && orders.length > 0) {
      const order = orders.find(o => o.id === viewParams.id)
      if (order) {
        openEdit(order)
        if (setViewParams) setViewParams({})
      }
    }
  }, [viewParams, orders])
  
  useEffect(() => {
    const unsub = listenCurrentCash(storeId, (c)=>setCurrentCash(c))
    return () => unsub && unsub()
  }, [storeId])

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const basePayload = {
        type: 'service_order',
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
        warrantyInfo,
        services: osServices,
        products: osProducts,
        totalServices: totalServicesAgg,
        totalProducts: totalProductsAgg,
        discount: 0,
        total: (totalProductsAgg + totalServicesAgg),
        valor: (totalProductsAgg + totalServicesAgg),
        payments: osPayments,
        paymentInfo,
        password: unlockType === 'pattern' 
          ? { type: 'pattern', pattern: unlockPattern }
          : unlockType === 'pin'
          ? { type: 'pin', value: unlockPin }
          : unlockType === 'password'
          ? { type: 'password', value: unlockPassword }
          : '',
        checklist: selectedChecklist ? {
          id: selectedChecklist.id,
          name: selectedChecklist.name,
          questions: (selectedChecklist.questions||[]).map(q => ({
            id: q.id,
            text: q.text,
            checked: !!checklistAnswers[q.id]
          }))
        } : null,
        files: [],
        status,
        updatedAt: new Date(),
        updatedBy: user?.name || attendant || 'Sistema'
      }
      if (editingOrderId) {
        // Verificar produtos removidos ou com quantidade reduzida para devolver ao estoque
        const originalOrder = orders.find(o => o.id === editingOrderId)
        if (originalOrder && Array.isArray(originalOrder.products)) {
          for (const origItem of originalOrder.products) {
            const newItem = osProducts.find(p => 
              p.productId === origItem.productId && 
              (String(p.variationName || '').trim() === String(origItem.variationName || '').trim())
            )
            
            let qtyToReturn = 0
            if (!newItem) {
              // Produto foi removido
              qtyToReturn = parseFloat(origItem.quantity) || 0
            } else {
              // Produto existe, verificar se quantidade diminuiu
              const origQty = parseFloat(origItem.quantity) || 0
              const newQty = parseFloat(newItem.quantity) || 0
              if (newQty < origQty) {
                qtyToReturn = origQty - newQty
              }
            }

            if (qtyToReturn > 0) {
              const p = productsAll.find(pr => pr.id === origItem.productId)
              if (!p) continue

              const vname = origItem.variationName ? String(origItem.variationName).trim() : ''
              const hasVars = Array.isArray(p.variationsData) && p.variationsData.length > 0

              if (hasVars && vname) {
                const idx = p.variationsData.findIndex(vr => String(vr?.name || vr?.label || '').trim() === vname)
                if (idx >= 0) {
                  const itemsVar = p.variationsData.map(vr => ({ ...vr }))
                  const cur = Number(itemsVar[idx]?.stock ?? 0)
                  itemsVar[idx].stock = cur + qtyToReturn
                  const total = itemsVar.reduce((s, vr) => s + (Number(vr.stock ?? 0)), 0)
                  await updateProduct(p.id, { variationsData: itemsVar, stock: total })
                  
                  await recordStockMovement({
                    productId: p.id,
                    productName: p.name,
                    variationId: itemsVar[idx].id || null,
                    variationName: itemsVar[idx].name || itemsVar[idx].label || vname,
                    type: 'in',
                    quantity: qtyToReturn,
                    reason: 'adjustment',
                    referenceId: editingOrderId,
                    description: `Remoção de item na edição da OS ${originalOrder.number || originalOrder.id}`,
                    userId: ownerId
                  })
                  continue
                }
              }

              const cur = Number(p.stock ?? 0)
              const next = cur + qtyToReturn
              await updateProduct(p.id, { stock: next })
              
              await recordStockMovement({
                productId: p.id,
                productName: p.name,
                type: 'in',
                quantity: qtyToReturn,
                reason: 'adjustment',
                referenceId: editingOrderId,
                description: `Remoção de item na edição da OS ${originalOrder.number || originalOrder.id}`,
                userId: ownerId
              })
            }
          }
        }

        // Verificar produtos adicionados ou com quantidade aumentada para debitar do estoque
        for (const newItem of osProducts) {
          const origItem = originalOrder.products.find(p => 
            p.productId === newItem.productId && 
            (String(p.variationName || '').trim() === String(newItem.variationName || '').trim())
          )
          
          let qtyToRemove = 0
          if (!origItem) {
            // Produto novo
            qtyToRemove = parseFloat(newItem.quantity) || 0
          } else {
            // Produto já existia, verificar se aumentou
            const origQty = parseFloat(origItem.quantity) || 0
            const newQty = parseFloat(newItem.quantity) || 0
            if (newQty > origQty) {
              qtyToRemove = newQty - origQty
            }
          }

          if (qtyToRemove > 0) {
            const p = productsAll.find(pr => pr.id === newItem.productId)
            if (!p) continue

            const vname = newItem.variationName ? String(newItem.variationName).trim() : ''
            const hasVars = Array.isArray(p.variationsData) && p.variationsData.length > 0

            if (hasVars && vname) {
              const idx = p.variationsData.findIndex(vr => String(vr?.name || vr?.label || '').trim() === vname)
              if (idx >= 0) {
                const itemsVar = p.variationsData.map(vr => ({ ...vr }))
                const cur = Number(itemsVar[idx]?.stock ?? 0)
                itemsVar[idx].stock = Math.max(0, cur - qtyToRemove)
                const total = itemsVar.reduce((s, vr) => s + (Number(vr.stock ?? 0)), 0)
                await updateProduct(p.id, { variationsData: itemsVar, stock: total })
                
                await recordStockMovement({
                  productId: p.id,
                  productName: p.name,
                  variationId: itemsVar[idx].id || null,
                  variationName: itemsVar[idx].name || itemsVar[idx].label || vname,
                  type: 'out',
                  quantity: qtyToRemove,
                  reason: 'adjustment',
                  referenceId: editingOrderId,
                  description: `Adição de item na edição da OS ${originalOrder.number || originalOrder.id}`,
                  userId: ownerId
                })
                continue
              }
            }

            const cur = Number(p.stock ?? 0)
            const next = Math.max(0, cur - qtyToRemove)
            await updateProduct(p.id, { stock: next })
            
            await recordStockMovement({
              productId: p.id,
              productName: p.name,
              type: 'out',
              quantity: qtyToRemove,
              reason: 'adjustment',
              referenceId: editingOrderId,
              description: `Adição de item na edição da OS ${originalOrder.number || originalOrder.id}`,
              userId: ownerId
            })
          }
        }
        await updateOrder(editingOrderId, basePayload)
      } else {
        const newOsId = await addOrder({ ...basePayload }, storeId)
        const items = Array.isArray(osProducts) ? osProducts : []
        for (const it of items) {
          const p = productsAll.find(pr => pr.id === it.productId)
          if (!p) continue
          const qty = Math.max(0, parseFloat(it.quantity) || 0)
          const hasVars = Array.isArray(p.variationsData) && p.variationsData.length > 0
          const vname = it.variationName ? String(it.variationName).trim() : ''
          
          let variationId = null
          let variationName = null

          if (hasVars && vname) {
            const idx = p.variationsData.findIndex(v => String(v?.name || v?.label || '').trim() === vname)
            if (idx >= 0) {
              const itemsVar = p.variationsData.map(v => ({ ...v }))
              
              variationId = itemsVar[idx].id || null
              variationName = itemsVar[idx].name || itemsVar[idx].label || vname

              const cur = Number(itemsVar[idx]?.stock ?? 0)
              itemsVar[idx].stock = Math.max(0, cur - qty)
              const total = itemsVar.reduce((s, v) => s + (Number(v.stock ?? 0)), 0)
              await updateProduct(p.id, { variationsData: itemsVar, stock: total })
              
              await recordStockMovement({
                productId: p.id,
                productName: p.name,
                variationId,
                variationName,
                type: 'out',
                quantity: qty,
                reason: 'service_order',
                referenceId: newOsId,
                description: `OS para ${client}`,
                userId: ownerId, // Assuming ownerId is available or pass user
                userName: attendant
              })
              continue
            }
          }
          const cur = Number(p.stock ?? 0)
          const next = Math.max(0, cur - qty)
          await updateProduct(p.id, { stock: next })
          
          await recordStockMovement({
            productId: p.id,
            productName: p.name,
            type: 'out',
            quantity: qty,
            reason: 'service_order',
            referenceId: newOsId,
            description: `OS para ${client}`,
            userId: ownerId,
            userName: attendant
          })
        }
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
  const removeService = (idx) => {
    setOsServices(prev => prev.filter((_, i) => i !== idx))
  }

  const formatOSNumber = (order) => {
    if (order.number) {
      const digits = String(order.number).replace(/\D/g, '')
      const n = parseInt(digits, 10)
      return `O.S:${String(n).padStart(4, '0')}`
    }
    return `O.S:${String(order.id).slice(-4)}`
  }

  const isOrderLocked = useMemo(() => {
    const s = String(status || '').toLowerCase()
    return s.includes('faturada') || s.includes('finalizada') || s.includes('finalizado')
  }, [status])

  return (
    <div>
      {statusModalOpen && (
        <UpdateStatusModal
          open={statusModalOpen}
          statuses={availableStatuses}
          onClose={()=>setStatusModalOpen(false)}
          initialDate={statusTargetOrder ? (statusTargetOrder.dateIn || '') : dateIn}
          initialStatus={statusTargetOrder ? (statusTargetOrder.status || 'Iniciado') : status}
          internalNotes={statusTargetOrder ? (statusTargetOrder.internalNotes || '') : internalNotes}
          receiptNotes={statusTargetOrder ? (statusTargetOrder.receiptNotes || '') : receiptNotes}
          onConfirm={async (v)=>{
            if (statusTargetOrder) {
              // Lógica de retorno de estoque ao cancelar
              const newStatus = String(v.status || '').toLowerCase()
              const oldStatus = String(statusTargetOrder.status || '').toLowerCase()
              
              if (newStatus.includes('cancelad') && !oldStatus.includes('cancelad')) {
                const items = Array.isArray(statusTargetOrder.products) ? statusTargetOrder.products : []
                for (const it of items) {
                  const p = productsAll.find(pr => pr.id === it.productId)
                  if (!p) continue
                  const qty = Math.max(0, parseFloat(it.quantity) || 0)
                  
                  const vname = it.variationName ? String(it.variationName).trim() : ''
                  const hasVars = Array.isArray(p.variationsData) && p.variationsData.length > 0
                  
                  if (hasVars && vname) {
                    const idx = p.variationsData.findIndex(vr => String(vr?.name || vr?.label || '').trim() === vname)
                    if (idx >= 0) {
                      const itemsVar = p.variationsData.map(vr => ({ ...vr }))
                      const cur = Number(itemsVar[idx]?.stock ?? 0)
                      itemsVar[idx].stock = cur + qty
                      const total = itemsVar.reduce((s, vr) => s + (Number(vr.stock ?? 0)), 0)
                      await updateProduct(p.id, { variationsData: itemsVar, stock: total })
                      
                      await recordStockMovement({
                        productId: p.id,
                        productName: p.name,
                        variationId: itemsVar[idx].id || null,
                        variationName: itemsVar[idx].name || itemsVar[idx].label || vname,
                        type: 'in',
                        quantity: qty,
                        reason: 'cancel',
                        referenceId: statusTargetOrder.id,
                        description: `Cancelamento OS ${statusTargetOrder.number || statusTargetOrder.id}`,
                        userId: ownerId
                      })
                      continue
                    }
                  }
                  
                  const cur = Number(p.stock ?? 0)
                  const next = cur + qty
                  await updateProduct(p.id, { stock: next })
                  
                  await recordStockMovement({
                    productId: p.id,
                    productName: p.name,
                    type: 'in',
                    quantity: qty,
                    reason: 'cancel',
                    referenceId: statusTargetOrder.id,
                    description: `Cancelamento OS ${statusTargetOrder.number || statusTargetOrder.id}`,
                    userId: ownerId
                  })
                }

                if (currentCash) {
                  await removeCashTransactionsByOrder(currentCash.id, statusTargetOrder.id)
                  await updateOrder(statusTargetOrder.id, {
                    cashLaunched: false,
                    cashLaunchCashId: null,
                    payments: [],
                    updatedAt: new Date(),
                    updatedBy: user?.name || attendant || 'Sistema'
                  })
                }
              } else if (oldStatus.includes('cancelad') && newStatus.includes('iniciado')) {
                // Lógica inversa: Cancelado -> Iniciado (baixa no estoque)
                const items = Array.isArray(statusTargetOrder.products) ? statusTargetOrder.products : []
                for (const it of items) {
                  const p = productsAll.find(pr => pr.id === it.productId)
                  if (!p) continue
                  const qty = Math.max(0, parseFloat(it.quantity) || 0)
                  
                  const vname = it.variationName ? String(it.variationName).trim() : ''
                  const hasVars = Array.isArray(p.variationsData) && p.variationsData.length > 0
                  
                  if (hasVars && vname) {
                    const idx = p.variationsData.findIndex(vr => String(vr?.name || vr?.label || '').trim() === vname)
                    if (idx >= 0) {
                      const itemsVar = p.variationsData.map(vr => ({ ...vr }))
                      const cur = Number(itemsVar[idx]?.stock ?? 0)
                      itemsVar[idx].stock = Math.max(0, cur - qty)
                      const total = itemsVar.reduce((s, vr) => s + (Number(vr.stock ?? 0)), 0)
                      await updateProduct(p.id, { variationsData: itemsVar, stock: total })
                      
                      await recordStockMovement({
                        productId: p.id,
                        productName: p.name,
                        variationId: itemsVar[idx].id || null,
                        variationName: itemsVar[idx].name || itemsVar[idx].label || vname,
                        type: 'out',
                        quantity: qty,
                        reason: 'service_order',
                        referenceId: statusTargetOrder.id,
                        description: `Reabertura OS ${statusTargetOrder.number || statusTargetOrder.id}`,
                        userId: ownerId
                      })
                      continue
                    }
                  }
                  
                  const cur = Number(p.stock ?? 0)
                  const next = Math.max(0, cur - qty)
                  await updateProduct(p.id, { stock: next })
                  
                  await recordStockMovement({
                    productId: p.id,
                    productName: p.name,
                    type: 'out',
                    quantity: qty,
                    reason: 'service_order',
                    referenceId: statusTargetOrder.id,
                    description: `Reabertura OS ${statusTargetOrder.number || statusTargetOrder.id}`,
                    userId: ownerId
                  })
                }
              }

              if (editingOrderId === statusTargetOrder.id) {
                setStatus(v.status)
                if(v.dateIn) setDateIn(v.dateIn)
                if(v.internalNotes) setInternalNotes(v.internalNotes)
                if(v.receiptNotes) setReceiptNotes(v.receiptNotes)
              }
              updateOrder(statusTargetOrder.id, {
                status: v.status,
                dateIn: v.dateIn ? new Date(v.dateIn) : (statusTargetOrder.dateIn || null),
                internalNotes: v.internalNotes,
                receiptNotes: v.receiptNotes,
                updatedAt: new Date(),
                updatedBy: user?.name || attendant || 'Sistema'
              }).catch(()=>{}).finally(()=>{ setStatusTargetOrder(null); setStatusModalOpen(false) })
            } else {
              setStatus(v.status)
              setDateIn(v.dateIn)
              setInternalNotes(v.internalNotes)
              setReceiptNotes(v.receiptNotes)
              setStatusModalOpen(false)
            }
          }}
        />
      )}
      {payMethodsOpen && (
        <PaymentMethodsModal
          open={payMethodsOpen}
          onClose={()=>setPayMethodsOpen(false)}
          remaining={osLaunchRemaining}
          payments={osPayments}
          onRemovePayment={(idx)=>setOsPayments(prev=>prev.filter((_,i)=>i!==idx))}
          onChooseMethod={(m)=>{
            setSelectedPayMethod(m)
            setPayAmountInput(String(osLaunchRemaining))
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
          remaining={osLaunchRemaining}
          amount={payAmountInput}
          setAmount={setPayAmountInput}
          error={payError}
          setError={setPayError}
          onConfirm={()=>{
            const amt = parseFloat(payAmountInput)||0
            if(!selectedPayMethod) return
            const remaining = osLaunchRemaining
            if(selectedPayMethod.code === 'cash'){
              const applied = Math.min(amt, remaining)
              const change = Math.max(amt - remaining, 0)
              const newRemaining = Math.max(remaining - applied, 0)
              const newPayment = { method: selectedPayMethod.label, methodCode: selectedPayMethod.code, amount: applied, change, date: new Date() }
              const newPaymentsList = [...osPayments, newPayment]
              setOsPayments(newPaymentsList)
              
              // Persist payments immediately
              if (cashTargetOrder) {
                 updateOrder(cashTargetOrder.id, { 
                    payments: newPaymentsList,
                    updatedAt: new Date(),
                    updatedBy: user?.name || attendant || 'Sistema'
                 }).catch(()=>{})
              }

              setPayAmountOpen(false) // Close amount modal

              if(newRemaining > 0){ 
                setRemainingInfoOpen(true) 
              } else { 
                setPayMethodsOpen(false)
                if (cashTargetOrder && currentCash) {
                  // Antes de atualizar, abre modal para escolher o status final
                  setFinalStatusTarget({ orderId: cashTargetOrder.id, cashId: currentCash.id, payments: newPaymentsList })
                  setChooseFinalStatusOpen(true)
                }
                setCashTargetOrder(null) 
              }
            } else {
              if(amt > remaining){
                setPayAmountOpen(false)
                setPayAboveConfirmOpen(true)
                return
              }
              const newRemaining = Math.max(remaining - amt, 0)
              const newPayment = { method: selectedPayMethod.label, methodCode: selectedPayMethod.code, amount: amt, date: new Date() }
              const newPaymentsList = [...osPayments, newPayment]
              setOsPayments(newPaymentsList)

              // Persist payments immediately
              if (cashTargetOrder) {
                 updateOrder(cashTargetOrder.id, { 
                   payments: newPaymentsList,
                   updatedAt: new Date(),
                   updatedBy: user?.name || attendant || 'Sistema'
                 }).catch(()=>{})
              }

              setPayAmountOpen(false)
              setRemainingSnapshot(newRemaining)
              if(newRemaining > 0){ 
                setRemainingInfoOpen(true) 
              } else { 
                if (cashTargetOrder && currentCash) {
                  // Antes de atualizar, abre modal para escolher o status final
                  setFinalStatusTarget({ orderId: cashTargetOrder.id, cashId: currentCash.id, payments: newPaymentsList })
                  setChooseFinalStatusOpen(true)
                }
                setCashTargetOrder(null) 
              }
            }
          }}
        />
      )}
      {payAboveConfirmOpen && (
        <AboveAmountConfirmModal
          open={payAboveConfirmOpen}
          amount={parseFloat(payAmountInput)||0}
          remaining={osLaunchRemaining}
          method={selectedPayMethod}
          onCancel={()=>{ setPayAboveConfirmOpen(false); setPayAmountOpen(true) }}
          onConfirm={()=>{
            const amt = parseFloat(payAmountInput)||0
            const applied = Math.min(amt, osLaunchRemaining)
            const newRemaining = Math.max(osLaunchRemaining - applied, 0)
            const newPayment = { method: selectedPayMethod?.label, methodCode: selectedPayMethod?.code, amount: applied, date: new Date() }
            const newPaymentsList = [...osPayments, newPayment]
            setOsPayments(newPaymentsList)

            // Persist payments immediately
            if (cashTargetOrder) {
                updateOrder(cashTargetOrder.id, { 
                  payments: newPaymentsList,
                  updatedAt: new Date(),
                  updatedBy: user?.name || attendant || 'Sistema'
                }).catch(()=>{})
            }
            
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
          remaining={osLaunchRemaining}
          onClose={()=>setRemainingInfoOpen(false)}
          onAddMore={()=>{ setRemainingInfoOpen(false); setPayMethodsOpen(true) }}
        />
      )}
      {afterAboveAdjustedOpen && (
        <AfterAboveAdjustedModal
          open={afterAboveAdjustedOpen}
          method={selectedPayMethod}
          remaining={osLaunchRemaining}
          onClose={()=>setAfterAboveAdjustedOpen(false)}
        />
      )}
      {serviceModalOpen && (
        <NewServiceModal
          open={serviceModalOpen}
          onClose={()=>setServiceModalOpen(false)}
          initial={serviceEditTarget}
          onConfirm={async (data)=>{
            try{
              if (serviceEditTarget?.id) {
                await updateService(serviceEditTarget.id, data)
              } else {
                await addService(data, storeId)
              }
              setServiceEditTarget(null)
              setServiceModalOpen(false)
            }catch(e){
              console.error('Erro ao salvar serviço', e)
              alert('Erro ao salvar serviço')
            }
          }}
        />
      )}
      {view === 'list' ? (
        <>
          {/* Cabeçalho e controles */}
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="flex items-center gap-6 text-sm">
              <button onClick={()=>setListTab('os')} className={`pb-2 ${listTab==='os' ? 'text-green-600 border-b-2 border-green-600 font-semibold' : 'text-gray-600'}`}>Ordens De Serviço</button>
              <button onClick={()=>setListTab('services')} className={`pb-2 ${listTab==='services' ? 'text-green-600 border-b-2 border-green-600 font-semibold' : 'text-gray-600'}`}>Serviços</button>
            </div>
            {listTab==='os' ? (
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2">
                <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pesquisar..." className="flex-1 border rounded px-3 py-2 text-sm" />
                {/* Ícones ao lado direito da busca (mobile) */}
                <button type="button" onClick={()=>setDateFilterOpen(true)}
                  className="h-9 w-9 border rounded flex items-center justify-center md:h-auto md:w-auto md:px-3 md:py-2 text-sm"
                  aria-label="Período"
                  title="Período">
                  <span className="md:hidden">📅</span>
                  <span className="hidden md:inline">📅 {dateRange.label}</span>
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
              <div className="hidden md:block relative">
                <button 
                  onClick={() => setOptionsMenuOpen(!optionsMenuOpen)} 
                  className={`px-3 py-2 border rounded text-sm transition-colors ${optionsMenuOpen ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                >
                  Opções
                </button>
                {optionsMenuOpen && (
                  <div className="absolute top-full mt-1 right-0 w-48 bg-white rounded-md shadow-lg z-50 ring-1 ring-black ring-opacity-5 py-1 text-left">
                    <button 
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => { setOptionsMenuOpen(false); setSettingsModalOpen(true) }}
                    >
                      Configuração
                    </button>
                    <button 
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => { setOptionsMenuOpen(false) }}
                    >
                      Exportar serviços
                    </button>
                  </div>
                )}
              </div>
              <button onClick={()=>{ resetForm(); setView('new') }} className="hidden md:inline-block px-3 py-2 rounded text-sm bg-green-600 text-white">+ Nova</button>
            </div>
            ) : (
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2">
                <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pesquisar..." className="flex-1 border rounded px-3 py-2 text-sm" />
                <button type="button" className="px-2 py-1 text-xs rounded border bg-green-50 text-green-700">Ativo</button>
                <button type="button" className="px-2 py-1 text-xs rounded border">Inativo</button>
              </div>
              <div className="hidden md:block flex-1"></div>
              <button onClick={()=>{ setServiceEditTarget(null); setServiceModalOpen(true) }} className="hidden md:inline-block px-3 py-2 rounded text-sm bg-green-600 text-white">+ Novo</button>
            </div>
            )}
          </div>
          {/* Lista */}
          {listTab==='os' ? (
            <>
            {/* Cards de resumo */}
            
            </>
          ) : (
            <div className="mt-4 bg-white rounded shadow overflow-x-auto">
              <div className="min-w-full divide-y divide-gray-200">
                <div className="grid grid-cols-[2fr_1fr_0.8fr_0.3fr] items-center px-2 py-2 text-xs font-medium text-gray-600 bg-gray-50 gap-1">
                  <div>Serviço</div>
                  <div className="text-right">Preço</div>
                  <div>Status</div>
                  <div></div>
                </div>
                {(servicesAll||[]).filter(sv => {
                  const ql = query.trim().toLowerCase()
                  return (sv.name||'').toLowerCase().includes(ql)
                }).map(sv => (
                  <div key={sv.id} className="grid grid-cols-[2fr_1fr_0.8fr_0.3fr] items-center px-2 py-2 text-xs hover:bg-gray-50 gap-1">
                    <div className="">{sv.name}</div>
                    <div className="text-right">{Number(sv.price||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                    <div><span className={`inline-block px-2 py-1 rounded border ${sv.active ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700'}`}>{sv.active ? 'Ativo' : 'Inativo'}</span></div>
                    <button type="button" onClick={()=>{ setServiceEditTarget(sv); setServiceModalOpen(true) }} className="text-gray-500">›</button>
                  </div>
                ))}
              </div>
            </div>
          )}

        {listTab==='os' && (
          <>
        <SalesDateFilterModal 
          open={dateFilterOpen} 
          onClose={()=>setDateFilterOpen(false)} 
          onApply={setDateRange}
          currentLabel={dateRange.label}
        />

        {filtersOpen && (
          <FiltersModal
            open={filtersOpen}
            availableStatuses={availableStatuses}
            onClose={()=>setFiltersOpen(false)}
            clientName={filterClient}
            technicianName={filterTechnician}
            attendantName={filterAttendant}
            statuses={filterStatuses}
            onChooseClient={()=>setFilterClientSelectOpen(true)}
            onChooseTechnician={()=>setFilterTechSelectOpen(true)}
            onChooseAttendant={()=>setFilterAttendantSelectOpen(true)}
            onToggleStatus={(s)=>{
              setFilterStatuses(prev => prev.includes(s) ? prev.filter(x=>x!==s) : [...prev, s])
            }}
            onClear={()=>{ setFilterClient(''); setFilterTechnician(''); setFilterAttendant(''); setFilterStatuses([]) }}
            onApply={()=>setFiltersOpen(false)}
          />
        )}

        {filterClientSelectOpen && (
          <SelectClientModal
            open={filterClientSelectOpen}
            onClose={()=>setFilterClientSelectOpen(false)}
            clients={clientsAll}
            onChoose={(c)=>{ setFilterClient(c.name||''); setFilterClientSelectOpen(false) }}
          />
        )}
        {filterTechSelectOpen && (
          <SelectClientModal
            open={filterTechSelectOpen}
            onClose={()=>setFilterTechSelectOpen(false)}
            clients={techniciansList}
            onChoose={(u)=>{ setFilterTechnician(u.name||''); setFilterTechSelectOpen(false) }}
          />
        )}
        {filterAttendantSelectOpen && (
          <SelectClientModal
            open={filterAttendantSelectOpen}
            onClose={()=>setFilterAttendantSelectOpen(false)}
            clients={attendantsList}
            onChoose={(u)=>{ setFilterAttendant(u.name||''); setFilterAttendantSelectOpen(false) }}
          />
        )}

        {/* Cards de resumo */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <div className="mt-4 bg-white rounded-lg shadow overflow-visible">
            <div className="overflow-x-auto">
            <div
              className="min-w-full grid items-center px-2 py-2 text-xs text-gray-600 font-bold bg-gray-50 border-b gap-1"
              style={{ gridTemplateColumns: `${osColumns.filter(c=>c.visible).map(c=>c.width).join(' ')} 3rem` }}
            >
              {osColumns.filter(c=>c.visible).map(col => (
                <div key={col.id} className={`text-${col.align === 'right' ? 'right' : (col.align === 'center' ? 'center' : 'left')}`}>
                  {col.label}
                </div>
              ))}
              <div className="flex justify-center">
                <button 
                  onClick={(e) => { e.stopPropagation(); setSelectColumnsOpen(true) }}
                  className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                  title="Configurar colunas"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="min-w-full divide-y divide-gray-200">
              {filtered.map(o => (
                <div 
                  key={o.id}
                  onClick={()=>openEdit(o)}
                  className="grid items-center px-2 py-2 text-xs cursor-pointer hover:bg-gray-50 gap-1"
                  style={{ gridTemplateColumns: `${osColumns.filter(c=>c.visible).map(c=>c.width).join(' ')} 3rem` }}
                >
                  {osColumns.filter(c=>c.visible).map(col => {
                    switch(col.id){
                      case 'number': return <div key={`${o.id}-number`}>{formatOSNumber(o)}</div>
                      case 'client': return (
                        <div key={`${o.id}-client`} className="leading-tight">
                          <div className="">{o.client}</div>
                        </div>
                      )
                      case 'attendant': return <div key={`${o.id}-attendant`}>{o.attendant}</div>
                      case 'technician': return <div key={`${o.id}-technician`}>{o.technician}</div>
                      case 'model': return <div key={`${o.id}-model`}>{o.model}</div>
                      case 'updatedDate': {
                        const d = o.updatedAt ? new Date(o.updatedAt.seconds ? o.updatedAt.seconds*1000 : o.updatedAt) : (o.dateIn ? new Date(o.dateIn.seconds ? o.dateIn.seconds*1000 : o.dateIn) : null)
                        return <div key={`${o.id}-updatedDate`}>{d ? d.toLocaleDateString('pt-BR') : '-'}</div>
                      }
                      case 'updatedTime': {
                        const d = o.updatedAt ? new Date(o.updatedAt.seconds ? o.updatedAt.seconds*1000 : o.updatedAt) : (o.dateIn ? new Date(o.dateIn.seconds ? o.dateIn.seconds*1000 : o.dateIn) : null)
                        return <div key={`${o.id}-updatedTime`}>{d ? d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : '-'}</div>
                      }
                      case 'updatedBy': return <div key={`${o.id}-updatedBy`}>{o.updatedBy || o.attendant || '-'}</div>
                      case 'value': return <div key={`${o.id}-value`} className="text-right">{((o.total ?? o.totalProducts ?? o.valor ?? ((Array.isArray(o.products) ? o.products.reduce((s,p)=> s + ((parseFloat(p.price)||0)*(parseFloat(p.quantity)||0)), 0) : 0)))).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                      case 'status': return (
                        <div key={`${o.id}-status`}>
                          {(() => {
                            const s = String(o.status||'').trim()
                            const color = statusColorMap[s]
                            if (color) {
                              return <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: hexToRgba(color, 0.15), color: darkenColor(color, 40) }}>{s || '-'}</span>
                            }
                            
                            const l = s.toLowerCase()
                            let cls = 'bg-gray-200 text-gray-700'
                            
                            if (l.includes('cliente lojista') && (l.includes('faturada') || l.includes('finalizada'))) cls = 'bg-blue-100 text-blue-700'
                            else if (l.includes('finaliz') || l.includes('faturada')) cls = 'bg-green-100 text-green-700'
                            else if (l.includes('cancel')) cls = 'bg-red-100 text-red-700'
                            else if (l.includes('garantia')) cls = 'bg-purple-100 text-purple-700'
                            else if (l.includes('aguardando') || l.includes('peça')) cls = 'bg-amber-100 text-amber-700'
                            return <span className={`px-2 py-1 rounded text-xs ${cls}`}>{s || '-'}</span>
                          })()}
                        </div>
                      )
                      default: return null
                    }
                  })}
                  <div className="flex justify-center">
                    <button
                      onClick={(e)=>{ 
                        e.stopPropagation()
                        const rect = e.currentTarget.getBoundingClientRect()
                        const left = Math.max(8, rect.right - 180)
                        const top = rect.bottom + 4
                        setRowMenuPos({ left, top })
                        setRowMenuOpenId(rowMenuOpenId===o.id ? null : o.id)
                      }}
                      className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                      title="Ações"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                    {rowMenuOpenId === o.id && (
                      <div 
                        className="fixed bg-white border rounded shadow-lg text-sm z-[1000] min-w-[180px]"
                        style={{ left: rowMenuPos.left, top: rowMenuPos.top }}
                        onClick={(e)=>e.stopPropagation()}
                      >
                        <button 
                          className="w-full text-left px-3 py-2 hover:bg-gray-50"
                          onClick={()=>{
                            setShareTargetOrder(o)
                            setShareModalOpen(true)
                            setRowMenuOpenId(null)
                          }}
                        >Compartilhar</button>
                        <button className="w-full text-left px-3 py-2 hover:bg-gray-50" onClick={()=>window.print()}>Imprimir</button>
                        <button className="w-full text-left px-3 py-2 hover:bg-gray-50" onClick={()=>{ 
                          if (o.status && o.status.toLowerCase().includes('faturada')) {
                            showAlert('Não é possível mudar o status de uma O.S. já faturada. Realize o cancelamento do movimento para alterar o status novamente.')
                            setRowMenuOpenId(null)
                            return
                          }
                          setStatusTargetOrder(o); setStatusModalOpen(true); setRowMenuOpenId(null) 
                        }}>Alterar Status</button>
                        {o.cashLaunched ? (
                          <button
                            className="w-full text-left px-3 py-2 hover:bg-gray-50"
                            onClick={()=>{
                              if(!currentCash){ alert('Nenhum caixa aberto.'); return }
                              removeCashTransactionsByOrder(currentCash.id, o.id)
                                .then(()=>updateOrder(o.id, { cashLaunched: false, cashLaunchCashId: null, status: 'Iniciado', payments: [] }))
                                .finally(()=>setRowMenuOpenId(null))
                            }}
                          >Cancelar mov. caixa</button>
                        ) : (
                          <button 
                            className="w-full text-left px-3 py-2 hover:bg-gray-50"
                            onClick={()=>{
                              if(!currentCash){ alert('Nenhum caixa aberto. Abra o caixa para lançar.'); return }
                              setCashTargetOrder(o)
                              setOsPayments([])
                              setRowMenuOpenId(null)
                              setPayMethodsOpen(true)
                            }}
                          >Faturar no caixa</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            </div>
          </div>
          </>)}
        </>
      ) : (
        // Formulário Nova OS
        <div className="mt-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button onClick={()=>setView('list')} className="px-3 py-2 border rounded text-sm">← Voltar</button>
            </div>
            <div className="flex items-center gap-2">
              <button 
                type="button" 
                onClick={()=>{ 
                  if (status && status.toLowerCase().includes('faturada')) {
                    showAlert('Não é possível mudar o status de uma O.S. já faturada. Realize o cancelamento do movimento para alterar o status novamente.')
                    return
                  }
                  const t = editingOrderId ? orders.find(o => o.id === editingOrderId) : null
                  setStatusTargetOrder(t || null)
                  setStatusModalOpen(true)
                }} 
                className="px-3 py-2 border rounded text-sm hover:bg-gray-50"
              >
                Alterar Status
              </button>
              {(() => {
                const s = String(status||'').trim()
                const l = s.toLowerCase()
                let cls = 'bg-gray-200 text-gray-700'
                
                if (l.includes('cliente lojista') && (l.includes('faturada') || l.includes('finalizada'))) cls = 'bg-blue-100 text-blue-700'
                else if (l.includes('finaliz') || l.includes('faturada')) cls = 'bg-green-100 text-green-700'
                else if (l.includes('cancel')) cls = 'bg-red-100 text-red-700'
                else if (l.includes('garantia')) cls = 'bg-purple-100 text-purple-700'
                else if (l.includes('aguardando') || l.includes('peça')) cls = 'bg-amber-100 text-amber-700'
                
                return <span className={`px-3 py-2 rounded text-sm font-medium ${cls}`}>{s || 'Iniciado'}</span>
              })()}
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
                  <div>
                    <label className="text-xs text-gray-600">IMEI 1</label>
                    <input value={imei1} onChange={e=>setImei1(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">IMEI 2</label>
                    <input value={imei2} onChange={e=>setImei2(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
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
                  <button type="button" onClick={()=>setUnlockTypeOpen(true)} className="px-3 py-2 border rounded text-sm">Adicionar Senha</button>
                  {!selectedChecklist && (
                    <button type="button" onClick={()=>setChecklistSelectOpen(true)} className="px-3 py-2 border rounded text-sm">Adicionar Checklist</button>
                  )}
                  <button type="button" className="px-3 py-2 border rounded text-sm">Adicionar Arquivo</button>
                </div>
              </div>

              {selectedChecklist && (
                <div>
                  <div className="font-semibold text-lg mb-2">Checklist</div>
                  <div className="bg-gray-50 p-4 rounded-lg mb-3">
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                      {(selectedChecklist.questions || []).map((q, idx) => {
                        const isChecked = !!checklistAnswers[q.id]
                        return (
                          <div key={q.id} className="flex items-center gap-1">
                            {isChecked ? (
                              <span className="text-green-500 font-bold">✓</span>
                            ) : (
                              <span className="text-gray-400 font-bold">✕</span>
                            )}
                            <span className={isChecked ? 'text-green-700' : 'text-gray-500'}>{q.text}</span>
                            {idx < (selectedChecklist.questions || []).length - 1 && (
                              <span className="text-gray-300 ml-3">|</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      type="button" 
                      onClick={()=>setChecklistQuestionsOpen(true)} 
                      className="px-4 py-2 border border-green-500 text-green-600 rounded text-sm hover:bg-green-50 font-medium"
                    >
                      Editar Checklist
                    </button>
                    <button 
                      type="button" 
                      onClick={()=>{
                        setSelectedChecklist(null)
                        setChecklistAnswers({})
                      }} 
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50"
                    >
                      Remover Checklist
                    </button>
                  </div>
                </div>
              )}

              {unlockType && (
                <div className="rounded-lg bg-white p-6 shadow">
                  <div className="font-semibold text-lg">Senha</div>
                  {unlockType === 'pattern' ? (
                    <div className="mt-3">
                      <PatternPreview pattern={unlockPattern} />
                      <div className="mt-3"><button type="button" onClick={()=>setUnlockPattern([])} className="px-3 py-2 border rounded text-sm">Redefinir</button></div>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <div className="text-sm text-gray-700">{unlockType === 'pin' ? `PIN: ${unlockPin}` : `Senha: ${unlockPassword}`}</div>
                    </div>
                  )}
                  <div className="mt-3"><button type="button" onClick={()=>setUnlockTypeOpen(true)} className="px-3 py-2 border rounded text-sm">Editar Senha</button></div>
                </div>
              )}

              <div className="rounded-lg bg-white p-6 shadow">
                <div className="font-semibold text-lg">Serviços</div>
                {osServices.length === 0 ? (
                  <div className="mt-3 text-sm text-gray-600">Nenhum serviço adicionado...</div>
                ) : (
                  <div className="mt-3">
                    {osServices.map((sv, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_8rem_2rem] items-center gap-3 py-2 border-b last:border-0 text-sm">
                        <div>
                          <div className="font-medium">{sv.name}</div>
                        </div>
                        <div className="text-right">{(sv.price * (sv.quantity||1)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                        <button type="button" onClick={()=>removeService(idx)} className="text-gray-500">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3"><button type="button" onClick={()=>setServiceSelectOpen(true)} className="px-3 py-2 border rounded text-sm">Adicionar Serviço</button></div>
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
                        {!isOrderLocked && (
                          <button type="button" onClick={()=>removeProduct(idx)} className="text-gray-500">✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {!isOrderLocked && (
                  <div className="mt-3"><button type="button" onClick={openAddProduct} className="px-3 py-2 border rounded text-sm">Adicionar Produto</button></div>
                )}
              </div>
            </div>

            {/* Coluna direita */}
            <div className="space-y-6">
              <div className="rounded-lg bg-white p-6 shadow">
                <div className="font-semibold text-lg">Total</div>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 border rounded">
                    <div className="text-xs text-gray-500">Total de serviços</div>
                    <div className="text-right">{(totalServicesAgg).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
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
                    <div className="text-right">{(totalProductsAgg + totalServicesAgg).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-white p-6 shadow">
                <div className="font-semibold text-lg">Pagamento</div>
                <div className="mt-4">
                  <label className="text-sm text-gray-600 block mb-1">Metódo de pagamento pré estabelecido com cliente</label>
                  <textarea
                    value={paymentInfo}
                    onChange={e => setPaymentInfo(e.target.value)}
                    rows={3}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="Descreva o método de pagamento acordado..."
                  />
                </div>
              </div>

              <div className="rounded-lg bg-white p-6 shadow">
                <div className="font-semibold text-lg">Observações</div>
                <textarea rows={3} className="mt-3 w-full border rounded px-3 py-2 text-sm" placeholder="Observações do serviço" />
                <div className="mt-6">
                  <div className="text-sm text-gray-600">Informações de garantia</div>
                  <textarea rows={6} value={warrantyInfo} onChange={e=>setWarrantyInfo(e.target.value)} className="mt-2 w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div className="mt-6 flex items-center justify-end gap-3">
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

                let maxStock = 0
                if (selectedVariation) {
                   maxStock = Number(selectedVariation.stock ?? selectedVariation.stockInitial ?? 0)
                } else {
                   maxStock = Number(selectedProduct.stock || 0)
                }
                const q = parseFloat(qtyInput)||1
                if (q > maxStock) {
                   showAlert('Estoque insuficiente para adicionar essa quantidade.')
                   return
                }

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
                  const currentStock = Number(p.stock || 0)
                  if (currentStock <= 0) {
                    showAlert('Produto com estoque zerado. Não é possível adicionar.')
                    return
                  }
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
                const vars = selectedProduct?.variationsData || []
                const index = vars.findIndex(v => v.name === variation.name)
                let effectiveStock = Number(variation.stock ?? variation.stockInitial ?? 0)
                if (index > 0 && index < 4) {
                  const base = vars[0]
                  const baseStock = Number((base && (base.stock ?? base.stockInitial)) ?? 0)
                  const ownStock = Number((variation && (variation.stock ?? variation.stockInitial)) ?? 0)
                  if (ownStock === 0 && baseStock > 0) {
                    effectiveStock = baseStock
                  }
                }
                if (effectiveStock <= 0) {
                  showAlert('Variação com estoque zerado. Não é possível adicionar.')
                  return
                }
                setSelectedVariation({ ...variation, stock: effectiveStock, stockInitial: effectiveStock })
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
          {unlockTypeOpen && (
            <UnlockTypeModal
              open={unlockTypeOpen}
              onClose={()=>setUnlockTypeOpen(false)}
              onChoose={(t)=>{
                setUnlockType(t)
                setUnlockTypeOpen(false)
                if (t === 'pattern') setPatternModalOpen(true)
                else { setTextUnlockOpen(true) }
              }}
            />
          )}
          {patternModalOpen && (
            <DrawPatternModal
              open={patternModalOpen}
              onClose={()=>setPatternModalOpen(false)}
              initial={unlockPattern}
              onConfirm={(p)=>{ setUnlockPattern(p); setPatternModalOpen(false) }}
            />
          )}
          {textUnlockOpen && (
            <TextUnlockModal
              open={textUnlockOpen}
              type={unlockType}
              initialValue={unlockType==='pin' ? unlockPin : unlockPassword}
              onClose={()=>setTextUnlockOpen(false)}
              onConfirm={(v)=>{
                if (unlockType==='pin') setUnlockPin(v)
                else setUnlockPassword(v)
                setTextUnlockOpen(false)
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
          {serviceSelectOpen && (
            <SelectServiceModal
              open={serviceSelectOpen}
              onClose={()=>setServiceSelectOpen(false)}
              services={servicesAll.filter(sv => sv.active)}
              onChoose={(sv)=>{
                setOsServices(prev => [...prev, { serviceId: sv.id, name: sv.name, price: Number(sv.price||0), quantity: 1 }])
                setServiceSelectOpen(false)
              }}
            />
          )}
          {checklistSelectOpen && (
            <SelectChecklistModal
              open={checklistSelectOpen}
              onClose={()=>setChecklistSelectOpen(false)}
              checklists={activeStore?.serviceOrderSettings?.checklists || []}
              onChoose={(cl)=>{
                 setSelectedChecklist(cl)
                 setChecklistAnswers({})
                 setChecklistSelectOpen(false)
                 setChecklistQuestionsOpen(true)
               }}
             />
           )}
           {checklistQuestionsOpen && (
             <ChecklistQuestionsModal
               open={checklistQuestionsOpen}
               onClose={()=>setChecklistQuestionsOpen(false)}
               checklist={selectedChecklist}
               initialAnswers={checklistAnswers}
               onConfirm={(answers) => {
                 setChecklistAnswers(answers)
                 setChecklistQuestionsOpen(false)
               }}
             />
           )}
         </div>
       )}
      <SelectColumnsModal
        open={selectColumnsOpen}
        onClose={()=>setSelectColumnsOpen(false)}
        columns={osColumns}
        onSave={(cols)=>{ setOsColumns(cols); setSelectColumnsOpen(false) }}
        onReset={()=>setOsColumns(osDefaultColumns)}
      />
      <ChooseFinalStatusModal
        open={chooseFinalStatusOpen}
        onClose={() => {
          setChooseFinalStatusOpen(false)
          setFinalStatusTarget(null)
          setCashTargetOrder(null)
        }}
        onChoose={(statusChosen) => {
          // Close immediately for better UX
          setChooseFinalStatusOpen(false)

          if (!finalStatusTarget) return

          updateOrder(finalStatusTarget.orderId, { 
            status: statusChosen,
            cashLaunched: true,
            cashLaunchCashId: finalStatusTarget.cashId
          })
          .catch(e => {
            console.error(e)
            alert('Erro ao atualizar status da OS')
          })
          .finally(() => {
            setFinalStatusTarget(null)
            setCashTargetOrder(null)
          })
        }}
      />
      {alertModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 relative animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl text-red-500">⚠️</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Atenção</h3>
              <p className="text-gray-600 mb-6">{alertMessage}</p>
              <button 
                onClick={() => setAlertModalOpen(false)}
                className="w-full py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded font-medium transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
      <ShareOrderModal
        open={shareModalOpen}
        onClose={()=>setShareModalOpen(false)}
        order={shareTargetOrder}
        store={store}
      />
      {settingsModalOpen && (
        <ServiceOrderSettingsModal 
          store={activeStore} 
          onClose={() => setSettingsModalOpen(false)} 
        />
      )}
    </div>
  )
}

function FiltersModal({ open, onClose, clientName, technicianName, attendantName, statuses, availableStatuses, onChooseClient, onChooseTechnician, onChooseAttendant, onToggleStatus, onClear, onApply }){
  if (!open) return null
  const allStatuses = availableStatuses || DEFAULT_STATUSES
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[2000]">
      <div className="bg-white rounded-lg shadow-lg w-[640px] max-w-[95vw]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Filtrar</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-gray-600">Cliente</label>
            <button type="button" onClick={onChooseClient} className="mt-1 w-full border rounded px-3 py-2 text-sm text-left flex items-center justify-between">
              <span>{clientName ? clientName : 'Selecionar'}</span>
              <span>›</span>
            </button>
          </div>
          <div>
            <label className="text-xs text-gray-600">Técnico</label>
            <button type="button" onClick={onChooseTechnician} className="mt-1 w-full border rounded px-3 py-2 text-sm text-left flex items-center justify-between">
              <span>{technicianName ? technicianName : 'Selecionar'}</span>
              <span>›</span>
            </button>
          </div>
          <div>
            <label className="text-xs text-gray-600">Atendente</label>
            <button type="button" onClick={onChooseAttendant} className="mt-1 w-full border rounded px-3 py-2 text-sm text-left flex items-center justify-between">
              <span>{attendantName ? attendantName : 'Selecionar'}</span>
              <span>›</span>
            </button>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-2">Status:</div>
            <div className="flex flex-wrap gap-2">
              {allStatuses.map(s => {
                const selected = (statuses || []).includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={()=>onToggleStatus && onToggleStatus(s)}
                    className={`px-3 py-1 rounded-full text-xs border ${selected ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
            <div className="mt-3">
              <button type="button" onClick={onClear} className="text-sm text-green-600">Limpar Filtros</button>
            </div>
          </div>
        </div>
        <div className="p-4 border-t flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 border rounded text-sm">Cancelar</button>
          <button type="button" onClick={onApply} className="px-3 py-2 rounded text-sm bg-green-600 text-white">Filtrar</button>
        </div>
      </div>
    </div>
  )
}

function UpdateStatusModal({ open, onClose, statuses: propStatuses, initialDate, initialStatus, internalNotes, receiptNotes, onConfirm }){
  const [date, setDate] = useState(initialDate || '')
  const [statusSel, setStatusSel] = useState(initialStatus || 'Iniciado')
  const [internal, setInternal] = useState(internalNotes || '')
  const [receipt, setReceipt] = useState(receiptNotes || '')
  if (!open) return null

  const statuses = propStatuses || DEFAULT_STATUSES

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

function UnlockTypeModal({ open, onClose, onChoose }){
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[420px] max-w-[95vw]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Adicionar Senha</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="p-4 grid grid-cols-1 gap-3">
          <button className="px-3 py-2 border rounded text-sm" onClick={()=>onChoose && onChoose('pattern')}>Padrão</button>
          <button className="px-3 py-2 border rounded text-sm" onClick={()=>onChoose && onChoose('pin')}>PIN</button>
          <button className="px-3 py-2 border rounded text-sm" onClick={()=>onChoose && onChoose('password')}>Senha</button>
        </div>
        <div className="p-4 border-t flex items-center justify-end">
          <button type="button" onClick={onClose} className="px-3 py-2 border rounded text-sm">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function DrawPatternModal({ open, onClose, initial, onConfirm }){
  const ref = React.useRef(null)
  const [points, setPoints] = useState([])
  const [centers, setCenters] = useState({})
  const [drawing, setDrawing] = useState(false)
  useEffect(()=>{ setPoints(Array.isArray(initial)?initial:[]) },[initial])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const w = rect.width
    const h = rect.height
    const gapX = w/4
    const gapY = h/4
    const map = {}
    let idx = 1
    for(let r=1;r<=3;r++){
      for(let c=1;c<=3;c++){
        map[idx] = { x: gapX*c, y: gapY*r }
        idx++
      }
    }
    setCenters(map)
  }, [ref.current])
  const addPoint = (i) => {
    if (!drawing) return
    setPoints(prev => prev.includes(i) ? prev : [...prev, i])
  }
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[520px] max-w-[95vw]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Desenhe o padrão de desbloqueio</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6 flex items-center justify-center">
          <div
            ref={ref}
            className="relative w-[300px] h-[300px] select-none"
            onMouseDown={()=>setDrawing(true)}
            onMouseUp={()=>setDrawing(false)}
            onMouseLeave={()=>setDrawing(false)}
            onTouchStart={()=>setDrawing(true)}
            onTouchEnd={()=>setDrawing(false)}
          >
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {points.map((p, idx) => {
                const a = centers[p]
                const b = centers[points[idx+1]]
                if (!a || !b) return null
                return <line key={`${p}-${idx}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#16a34a" strokeWidth="6" />
              })}
            </svg>
            {[...Array(9)].map((_, i) => {
              const id = i+1
              const c = centers[id] || { x: 0, y: 0 }
              const active = points.includes(id)
              return (
                <button
                  key={id}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full ${active ? 'bg-green-600' : 'bg-green-100'}`}
                  style={{ left: c.x, top: c.y }}
                  onMouseEnter={()=>addPoint(id)}
                  onTouchMove={(e)=>{
                    const t = e.changedTouches?.[0]
                    if (!t || !drawing) return
                    const rect = ref.current.getBoundingClientRect()
                    const x = t.clientX - rect.left
                    const y = t.clientY - rect.top
                    let near = null
                    Object.entries(centers).forEach(([k, v]) => {
                      const dx = v.x - x
                      const dy = v.y - y
                      const d = Math.sqrt(dx*dx + dy*dy)
                      if (d < 24) near = parseInt(k,10)
                    })
                    if (near) addPoint(near)
                  }}
                  onMouseDown={()=>{ setDrawing(true); addPoint(id) }}
                >
                  {active && (
                    <span className="text-white text-xs font-semibold">{points.indexOf(id)+1}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
        <div className="p-4 border-t flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 border rounded text-sm">Cancelar</button>
          <button type="button" onClick={()=>onConfirm && onConfirm(points)} className="px-3 py-2 rounded text-sm bg-green-600 text-white">Confirmar</button>
        </div>
      </div>
    </div>
  )
}

function TextUnlockModal({ open, onClose, type, initialValue, onConfirm }){
  const [val, setVal] = useState(initialValue || '')
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[520px] max-w-[95vw]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">{type==='pin' ? 'Digite o PIN' : 'Digite a senha'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="p-6">
          <input
            value={val}
            onChange={e=>setVal(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder={type==='pin' ? 'PIN do aparelho' : 'Senha do aparelho'}
            inputMode={type==='pin' ? 'numeric' : 'text'}
          />
        </div>
        <div className="p-4 border-t flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 border rounded text-sm">Cancelar</button>
          <button type="button" onClick={()=>onConfirm && onConfirm(val)} className="px-3 py-2 rounded text-sm bg-green-600 text-white">Confirmar</button>
        </div>
      </div>
    </div>
  )
}

function PatternPreview({ pattern }){
  const ref = React.useRef(null)
  const [centers, setCenters] = useState({})
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const w = rect.width
    const h = rect.height
    const gapX = w/4
    const gapY = h/4
    const map = {}
    let idx = 1
    for(let r=1;r<=3;r++){
      for(let c=1;c<=3;c++){
        map[idx] = { x: gapX*c, y: gapY*r }
        idx++
      }
    }
    setCenters(map)
  }, [ref.current])
  return (
    <div className="relative w-[220px] h-[220px]" ref={ref}>
      <svg className="absolute inset-0 w-full h-full">
        {pattern.map((p, idx) => {
          const a = centers[p]
          const b = centers[pattern[idx+1]]
          if (!a || !b) return null
          return <line key={`${p}-${idx}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#16a34a" strokeWidth="6" />
        })}
      </svg>
      {[...Array(9)].map((_, i) => {
        const id = i+1
        const c = centers[id] || { x: 0, y: 0 }
        const active = pattern.includes(id)
        return (
          <div
            key={id}
            className={`absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full ${active ? 'bg-green-600' : 'bg-green-100'} flex items-center justify-center`}
            style={{ left: c.x, top: c.y }}
          >
            {active && <span className="text-white text-xs font-semibold">{pattern.indexOf(id)+1}</span>}
          </div>
        )
      })}
    </div>
  )
}

function NewServiceModal({ open, onClose, initial, onConfirm }){
  const [name, setName] = useState(initial?.name || '')
  const [cost, setCost] = useState(String(initial?.cost ?? 0))
  const [price, setPrice] = useState(String(initial?.price ?? 0))
  const [active, setActive] = useState(initial?.active ?? true)
  useEffect(() => {
    setName(initial?.name || '')
    setCost(String(initial?.cost ?? 0))
    setPrice(String(initial?.price ?? 0))
    setActive(initial?.active ?? true)
  }, [initial])
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[520px] max-w-[95vw]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Serviço</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-gray-600">Nome</label>
            <input value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Custo do serviço</label>
              <input value={cost} onChange={e=>setCost(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-600">Preço</label>
              <input value={price} onChange={e=>setPrice(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input id="sv-active" type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} />
            <label htmlFor="sv-active" className="text-sm">Ativo</label>
          </div>
        </div>
        <div className="p-4 border-t flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 border rounded text-sm">Cancelar</button>
          <button
            type="button"
            onClick={()=>onConfirm && onConfirm({ name: name.trim(), cost: parseFloat(cost)||0, price: parseFloat(price)||0, active })}
            className="px-3 py-2 rounded text-sm bg-green-600 text-white"
          >Confirmar</button>
        </div>
      </div>
    </div>
  )
}

function SelectServiceModal({ open, onClose, services, onChoose }){
  const [query, setQuery] = useState('')
  if (!open) return null
  const filtered = (services||[]).filter(sv => (sv.name||'').toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[680px] max-w-[95vw]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Selecionar Serviço</h3>
          <button onClick={()=>onClose && onClose()} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="p-4">
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pesquisar..." className="w-full border rounded px-3 py-2 text-sm" />
          <div className="mt-3 max-h-[60vh] overflow-y-auto">
            {filtered.map(sv => (
              <div key={sv.id} className="grid grid-cols-[1fr_8rem] items-center gap-3 px-2 py-3 border-b last:border-0 text-sm cursor-pointer" onClick={()=>onChoose && onChoose(sv)}>
                <div>
                  <div className="font-medium">{sv.name}</div>
                </div>
                <div className="text-right">{Number(sv.price||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
              </div>
            ))}
            {filtered.length===0 && (<div className="text-sm text-gray-600 px-2 py-3">Nenhum serviço encontrado.</div>)}
          </div>
        </div>
        <div className="p-4 border-t flex items-center justify-end">
          <button type="button" onClick={onClose} className="px-3 py-2 border rounded text-sm">Voltar</button>
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
