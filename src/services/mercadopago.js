import { httpsCallable } from 'firebase/functions'
import { functions } from '../lib/firebase'

export async function createMercadoPagoPixForInvoice(invoiceId) {
  if (!invoiceId) throw new Error('invoiceId é obrigatório')
  const fn = httpsCallable(functions, 'mpCreatePixForInvoice')
  const res = await fn({ invoiceId })
  return res?.data || null
}
