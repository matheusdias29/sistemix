import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, getDocs, where, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

const colRef = collection(db, 'orders')

function normalizeClientText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

// Gera número sequencial de 6 dígitos no formato #000001
async function getNextOrderNumber(storeId, type){
  try {
    if (storeId) {
      // Evita índice composto: filtra por storeId e calcula o maior número no cliente
      const q = query(colRef, where('storeId','==',storeId))
      const snap = await getDocs(q)
      let max = 0
      snap.docs.forEach(d => {
        const data = d.data()
        // Filter by type:
        // If type is 'sale', only consider 'sale'.
        // If type is 'service_order', consider 'service_order' OR undefined (legacy).
        const dType = data.type
        const isMatch = (type === 'sale') 
          ? (dType === 'sale')
          : (dType === 'service_order' || !dType)
        
        if (isMatch) {
          const digits = String(data.number || '').replace(/^#/, '')
          const n = parseInt(digits, 10)
          if (!isNaN(n) && n > max) max = n
        }
      })
      const next = max + 1
      return `#${String(next).padStart(6, '0')}`
    } else {
      // Fallback
      return `#${String(1).padStart(6, '0')}`
    }
  } catch (e) {
    return `#${String(1).padStart(6, '0')}`
  }
}

export function listenOrders(callback, storeId){
  const q = storeId
    ? query(colRef, where('storeId','==',storeId))
    : query(colRef, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
    callback(items)
  })
}

export async function addOrder(order, storeId){
  if (!storeId) throw new Error('storeId é obrigatório ao criar OS')
  const type = order.type || 'service_order'
  const number = await getNextOrderNumber(storeId, type)
  const data = {
    storeId,
    type,
    // Identificação
    client: order.client || '',
    clientId: order.clientId || null,
    attendant: order.attendant || '',
    technician: order.technician || '',
    // Datas
    dateIn: order.dateIn || null,
    expectedDate: order.expectedDate || null,
    // Equipamento
    brand: order.brand || '',
    model: order.model || '',
    serialNumber: order.serialNumber || '',
    imei1: order.imei1 || '',
    imei2: order.imei2 || '',
    equipment: order.equipment || '',
    problem: order.problem || '',
    // Observações
    receiptNotes: order.receiptNotes || '',
    internalNotes: order.internalNotes || '',
    observations: order.observations || '',
    warrantyInfo: order.warrantyInfo || '',
    // Outros
    password: order.password || '',
    checklist: Array.isArray(order.checklist) ? order.checklist : [],
    files: Array.isArray(order.files) ? order.files : [],
    // Itens
    services: Array.isArray(order.services) ? order.services : [],
    products: Array.isArray(order.products) ? order.products : [],
    // Totais
    totalServices: Number(order.totalServices || 0),
    totalProducts: Number(order.totalProducts || 0),
    feesApplied: Array.isArray(order.feesApplied) ? order.feesApplied : [],
    discount: (order.discount && typeof order.discount === 'object') ? order.discount : Number(order.discount || 0),
    total: Number(order.total || 0),
    // Pagamentos
    payments: Array.isArray(order.payments) ? order.payments : [],
    plannedPayments: Array.isArray(order.plannedPayments) ? order.plannedPayments : [],
    plannedPayment: (order.plannedPayment && typeof order.plannedPayment === 'object') ? order.plannedPayment : null,
    paymentInfo: order.paymentInfo || '',
    preEstablishedPayment: order.preEstablishedPayment || '',
    // Status
    status: order.status || 'Iniciado',
    valor: Number(order.total || 0),
    // Número sequencial
    number,
    // Timestamps
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: order.updatedBy || '',
  }
  const res = await addDoc(colRef, data)
  return { id: res.id, number }
}

export async function getOrderById(id){
  if (!id) return null
  const ref = doc(db, 'orders', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

export async function getClientOrderHistory(storeId, client){
  if (!storeId || !client) return []

  const clientId = String(client.id || '').trim()
  const clientName = normalizeClientText(client.name)

  if (!clientId && !clientName) return []

  const q = query(colRef, where('storeId','==',storeId))
  const snap = await getDocs(q)

  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(order => {
      const type = order.type || 'service_order'
      if (type !== 'sale' && type !== 'service_order') return false

      const matchesClientId = clientId && String(order.clientId || '').trim() === clientId
      const matchesClientName = clientName && normalizeClientText(order.client) === clientName

      return matchesClientId || matchesClientName
    })
    .map(order => ({
      id: order.id,
      type: order.type || 'service_order',
      number: order.number || '',
      client: order.client || '',
      status: order.status || '',
      total: Number(order.total ?? order.valor ?? 0),
      attendant: order.attendant || '',
      technician: order.technician || '',
      productsCount: Array.isArray(order.products) ? order.products.length : 0,
      servicesCount: Array.isArray(order.services) ? order.services.length : 0,
      createdAt: order.createdAt || null,
      updatedAt: order.updatedAt || null,
      dateIn: order.dateIn || null,
    }))
    .sort((a, b) => {
      const getTime = (item) =>
        item.createdAt?.toMillis?.() ||
        item.updatedAt?.toMillis?.() ||
        item.dateIn?.toMillis?.() ||
        (item.createdAt ? new Date(item.createdAt).getTime() : 0) ||
        (item.updatedAt ? new Date(item.updatedAt).getTime() : 0) ||
        (item.dateIn ? new Date(item.dateIn).getTime() : 0) ||
        0

      return getTime(b) - getTime(a)
    })
}

export async function updateOrder(id, partial){
  const ref = doc(db, 'orders', id)
  await updateDoc(ref, { ...partial, updatedAt: serverTimestamp() })
}

export async function deleteOrder(id){
  const ref = doc(db, 'orders', id)
  await deleteDoc(ref)
}
