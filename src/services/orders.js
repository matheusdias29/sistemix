import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, getDocs, where, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

const colRef = collection(db, 'orders')

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
    equipment: order.equipment || '',
    problem: order.problem || '',
    // Observações
    receiptNotes: order.receiptNotes || '',
    internalNotes: order.internalNotes || '',
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
    discount: Number(order.discount || 0),
    total: Number(order.total || 0),
    // Pagamentos
    payments: Array.isArray(order.payments) ? order.payments : [],
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
  return res.id
}

export async function getOrderById(id){
  if (!id) return null
  const ref = doc(db, 'orders', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

export async function updateOrder(id, partial){
  const ref = doc(db, 'orders', id)
  await updateDoc(ref, { ...partial, updatedAt: serverTimestamp() })
}