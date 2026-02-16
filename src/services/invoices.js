import { collection, onSnapshot, query, where, orderBy, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

const colRef = collection(db, 'invoices')

export function listenInvoices(ownerId, cb) {
  if (!ownerId) return () => {}
  const q = query(colRef, where('ownerId', '==', ownerId))
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    items.sort((a, b) => {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : 0
      const dbt = b.dueDate ? new Date(b.dueDate).getTime() : 0
      return da - dbt
    })
    cb(items)
  })
}

export async function addInvoice({ ownerId, amount, dueDate, paymentMethod }) {
  if (!ownerId) throw new Error('ownerId é obrigatório')
  const payload = {
    ownerId,
    amount: Number(amount || 0),
    status: 'pending',
    dueDate,
    paymentMethod: paymentMethod || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const res = await addDoc(colRef, payload)
  return res.id
}
