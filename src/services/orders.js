import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, getDocs, limit } from 'firebase/firestore'
import { db } from '../lib/firebase'

const colRef = collection(db, 'orders')

// Gera número sequencial de 6 dígitos no formato #000001
async function getNextOrderNumber(){
  try {
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(1))
    const snap = await getDocs(q)
    let next = 1
    if (!snap.empty) {
      const last = snap.docs[0].data()
      const digits = String(last?.number || '').replace(/^#/, '')
      const n = parseInt(digits, 10)
      if (!isNaN(n)) next = n + 1
    }
    return `#${String(next).padStart(6, '0')}`
  } catch (e) {
    return `#${String(1).padStart(6, '0')}`
  }
}

export function listenOrders(callback){
  const q = query(colRef, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(items)
  })
}

export async function addOrder(order){
  const number = await getNextOrderNumber()
  const data = {
    // Identificação
    client: order.client || '',
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
    // Status
    status: order.status || 'Iniciado',
    valor: Number(order.total || 0),
    // Número sequencial
    number,
    // Timestamps
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const res = await addDoc(colRef, data)
  return res.id
}

export async function updateOrder(id, partial){
  const ref = doc(db, 'orders', id)
  await updateDoc(ref, { ...partial, updatedAt: serverTimestamp() })
}