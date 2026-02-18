import { collection, onSnapshot, query, where, orderBy, addDoc, serverTimestamp, getCountFromServer, limit, doc, getDocs, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { collection as subsCollection, getDocs as getSubsDocs } from 'firebase/firestore'
import { collection as usersCollection } from 'firebase/firestore'

const colRef = collection(db, 'invoices')
const subRef = collection(db, 'subscriptions')

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

async function nextSequentialNumber(ownerId){
  const q = query(colRef, where('ownerId','==',ownerId))
  const c = await getCountFromServer(q)
  return (c.data().count || 0) + 1
}

export async function addInvoice({ ownerId, amount, dueDate, paymentMethod, clientRef, description }) {
  if (!ownerId) throw new Error('ownerId é obrigatório')
  const seq = await nextSequentialNumber(ownerId)
  const payload = {
    ownerId,
    amount: Number(amount || 0),
    status: 'pending',
    dueDate,
    paymentMethod: paymentMethod || '',
    clientRef: clientRef || ownerId,
    description: description || '',
    number: seq,
    issuedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    history: [
      { type: 'created', at: new Date().toISOString(), by: 'system' }
    ],
  }
  const res = await addDoc(colRef, payload)
  return res.id
}

function cycleDays(billingCycle){
  if (billingCycle === 'monthly') return 30
  if (billingCycle === 'bimestral') return 60
  if (billingCycle === 'trimestral') return 90
  if (billingCycle === 'semiannual') return 180
  if (billingCycle === 'annual') return 365
  return 30
}

export async function generateInvoicesBatch({ now = new Date() } = {}){
  const subsSnap = await getSubsDocs(subRef)
  const subs = subsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  const batch = writeBatch(db)
  const results = []
  for (const sub of subs){
    const ownerId = sub.ownerId || sub.id
    if (!ownerId) continue
    const cycle = sub.billingCycle || 'monthly'
    const due = sub.nextDueDate ? new Date(sub.nextDueDate) : null
    const graceDays = sub.graceDays ?? 0
    const baseAmount = Number(sub.price || 0)
    if (!due) continue
    const today = new Date(now)
    today.setHours(0,0,0,0)
    const dueOnly = new Date(due)
    dueOnly.setHours(0,0,0,0)
    if (dueOnly > today) continue
    const existingQ = query(colRef, where('ownerId','==',ownerId), where('dueDate','==',dueOnly.toISOString()))
    const existingSnap = await getDocs(existingQ)
    if (!existingSnap.empty) continue
    const seq = await nextSequentialNumber(ownerId)
    const docRef = doc(colRef)
    const payload = {
      ownerId,
      amount: baseAmount,
      status: 'pending',
      dueDate: dueOnly.toISOString(),
      paymentMethod: '',
      clientRef: ownerId,
      description: sub.planName || 'Assinatura',
      number: seq,
      issuedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      history: [
        { type: 'created', at: new Date().toISOString(), by: 'auto' }
      ],
    }
    batch.set(docRef, payload)
    results.push({ ownerId, number: seq })
  }
  if (results.length){
    await batch.commit()
  }
  return { generated: results.length, items: results }
}
