import { collection, onSnapshot, query, where, orderBy, addDoc, serverTimestamp, getCountFromServer, doc, getDocs, writeBatch, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

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
    orderNsu: String(seq),
    paymentStatus: 'pending',
    paymentUrl: '',
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
  const subsSnap = await getDocs(subRef)
  const subs = subsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  const batch = writeBatch(db)
  const results = []

  const normalizeDate = (d) => {
    if (!d) return null
    try {
      if (typeof d?.toDate === 'function') return d.toDate()
      if (typeof d?.seconds === 'number') return new Date(d.seconds * 1000)
      return new Date(d)
    } catch {
      return null
    }
  }

  for (const sub of subs){
    const ownerId = sub.ownerId || sub.id
    if (!ownerId) continue
    const cycle = sub.billingCycle || 'monthly'
    const dueRaw = sub.nextDueDate
    const due = normalizeDate(dueRaw)
    const graceDays = sub.graceDays ?? 0
    const baseAmount = Number(sub.price || 0)
    if (!due) continue
    const today = new Date(now)
    today.setHours(0,0,0,0)
    const dueOnly = new Date(due)
    dueOnly.setHours(0,0,0,0)
    // Sempre garantir fatura do vencimento configurado (mesmo futuro)
    const existingQ = query(colRef, where('ownerId','==',ownerId), where('dueDate','==', dueOnly))
    const existingSnap = await getDocs(existingQ)
    if (existingSnap.empty) {
      const seq = await nextSequentialNumber(ownerId)
      const docRef = doc(colRef)
      const payload = {
        ownerId,
        amount: baseAmount,
        status: 'pending',
        dueDate: dueOnly,
        paymentMethod: '',
        clientRef: ownerId,
        description: sub.planName || 'Assinatura',
        number: seq,
        orderNsu: String(seq),
        paymentStatus: 'pending',
        paymentUrl: '',
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
    // Também garantir a próxima fatura já criada
    const next = new Date(dueOnly)
    next.setDate(next.getDate() + cycleDays(cycle))
    const nextQ = query(colRef, where('ownerId','==',ownerId), where('dueDate','==', next))
    const nextSnap = await getDocs(nextQ)
    if (nextSnap.empty) {
      const nextSeq = await nextSequentialNumber(ownerId)
      const nextDocRef = doc(colRef)
      const nextPayload = {
        ownerId,
        amount: baseAmount,
        status: 'pending',
        dueDate: next,
        paymentMethod: '',
        clientRef: ownerId,
        description: sub.planName || 'Assinatura',
        number: nextSeq,
        orderNsu: String(nextSeq),
        paymentStatus: 'pending',
        paymentUrl: '',
        issuedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        history: [
          { type: 'created', at: new Date().toISOString(), by: 'auto' }
        ],
      }
      batch.set(nextDocRef, nextPayload)
      results.push({ ownerId, number: nextSeq })
    }
  }
  if (results.length){
    await batch.commit()
  }
  return { generated: results.length, items: results }
}

export async function requestInfinitePayCheckout(invoiceId) {
  if (!invoiceId) throw new Error('invoiceId é obrigatório')
  const ref = doc(colRef, invoiceId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Fatura não encontrada')
  const invoice = { id: snap.id, ...snap.data() }

  const handle = import.meta.env.VITE_INFINITEPAY_HANDLE || 'sistemix-comercio'
  const endpoint = import.meta.env.VITE_INFINITEPAY_CHECKOUT_URL
  if (!endpoint || !handle) throw new Error('Configuração InfinitePay ausente')

  const baseAmount = Number(invoice.amount || 0)
  const priceCents = Math.round(baseAmount * 100)
  const orderNsu = String(invoice.orderNsu || invoice.number || invoice.id)
  const description = invoice.description || invoice.planName || 'Assinatura Sistemix'

  const body = {
    handle,
    redirect_url: 'https://sistmix.app.br/',
    webhook_url: 'https://sistmix.app.br/',
    order_nsu: orderNsu,
    items: [
      {
        quantity: 1,
        price: priceCents,
        description,
      },
    ],
  }

  const apiKey = import.meta.env.VITE_INFINITEPAY_API_KEY
  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error('Falha ao criar pagamento InfinitePay')
  }
  const data = await res.json()
  const paymentUrl = data?.url || data?.checkout_url || data?.payment_url || ''
  const returnedNsu = data?.order_nsu || orderNsu

  await updateDoc(ref, {
    orderNsu: returnedNsu,
    paymentUrl,
    paymentStatus: 'pending',
    updatedAt: serverTimestamp(),
  })

  return { paymentUrl, orderNsu: returnedNsu }
}
