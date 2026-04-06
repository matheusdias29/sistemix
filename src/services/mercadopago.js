import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

export async function createMercadoPagoPixForInvoice(invoiceId) {
  if (!invoiceId) throw new Error('invoiceId é obrigatório')
  const colRef = collection(db, 'mp_pix_jobs')
  const res = await addDoc(colRef, {
    invoiceId,
    status: 'queued',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { jobId: res.id }
}

export async function syncMercadoPagoInvoicePayment(invoiceId) {
  if (!invoiceId) throw new Error('invoiceId é obrigatório')
  const colRef = collection(db, 'mp_payment_sync_jobs')
  const res = await addDoc(colRef, {
    invoiceId,
    status: 'queued',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { jobId: res.id }
}
