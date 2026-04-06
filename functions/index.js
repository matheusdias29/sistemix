const admin = require('firebase-admin')
const { onCall, HttpsError } = require('firebase-functions/v2/https')

admin.initializeApp()

exports.mpCreatePixForInvoice = onCall({ secrets: ['MERCADOPAGO_ACCESS_TOKEN'] }, async (req) => {
  const invoiceId = String(req?.data?.invoiceId || '').trim()
  if (!invoiceId) throw new HttpsError('invalid-argument', 'invoiceId é obrigatório')
  if (!req.auth) throw new HttpsError('unauthenticated', 'Autenticação necessária')

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) throw new HttpsError('failed-precondition', 'MERCADOPAGO_ACCESS_TOKEN não configurado')

  const db = admin.firestore()
  const invRef = db.collection('invoices').doc(invoiceId)
  const invSnap = await invRef.get()
  if (!invSnap.exists) throw new HttpsError('not-found', 'Fatura não encontrada')

  const invoice = { id: invSnap.id, ...invSnap.data() }
  const amount = Number(invoice.amount || 0)
  if (!amount || amount <= 0) throw new HttpsError('failed-precondition', 'Valor da fatura inválido')

  const ownerId = String(invoice.ownerId || '').trim()
  const ownerSnap = ownerId ? await db.collection('users').doc(ownerId).get() : null
  const ownerEmail = ownerSnap && ownerSnap.exists ? String(ownerSnap.data().email || '').trim() : ''
  const payerEmail = ownerEmail || String(req?.auth?.token?.email || '').trim()
  if (!payerEmail) throw new HttpsError('failed-precondition', 'E-mail do pagador não encontrado')

  const description = String(invoice.description || 'Assinatura Sistemix').slice(0, 240)
  const body = {
    transaction_amount: Number(amount.toFixed(2)),
    description,
    payment_method_id: 'pix',
    payer: { email: payerEmail },
    external_reference: invoiceId,
  }

  const res = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Idempotency-Key': `inv_${invoiceId}`,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.message || data?.error || 'Falha ao criar pagamento Mercado Pago'
    throw new HttpsError('internal', msg)
  }

  const tx = data?.point_of_interaction?.transaction_data || {}
  const qr_code = String(tx.qr_code || '')
  const qr_code_base64 = String(tx.qr_code_base64 || '')
  const ticket_url = String(tx.ticket_url || '')
  const mpPaymentId = data?.id || null

  await invRef.update({
    paymentProvider: 'mercadopago',
    paymentMethod: 'PIX',
    paymentStatus: 'pending',
    paymentUrl: ticket_url || invoice.paymentUrl || '',
    ticketUrl: ticket_url || '',
    pixCopyPaste: qr_code || '',
    pixQrCodeBase64: qr_code_base64 || '',
    mpPaymentId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    history: admin.firestore.FieldValue.arrayUnion({
      type: 'mp_pix_created',
      at: new Date().toISOString(),
      by: req.auth.uid,
    }),
  })

  return { qr_code, qr_code_base64, ticket_url, mpPaymentId }
})
