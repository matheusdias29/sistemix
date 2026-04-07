const admin = require('firebase-admin')
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https')
const { onDocumentCreated, onDocumentUpdated, onDocumentWritten } = require('firebase-functions/v2/firestore')
const { getFirestore } = require('firebase-admin/firestore')
const crypto = require('crypto')
const { Resend } = require('resend')

admin.initializeApp()

function normalizeTimestampToDate(v) {
  try {
    if (!v) return null
    if (typeof v.toDate === 'function') return v.toDate()
    if (typeof v.seconds === 'number') return new Date(v.seconds * 1000)
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

function isPixStillValid(invoice) {
  const exp = normalizeTimestampToDate(invoice?.pixExpiresAt)
  if (!exp) return false
  return exp.getTime() > Date.now()
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + Number(days || 0))
  return d
}

function toDateOnly(d) {
  const dt = normalizeTimestampToDate(d)
  if (!dt) return null
  const x = new Date(dt)
  x.setHours(0, 0, 0, 0)
  return x
}

function cycleMonths(cycle) {
  const c = String(cycle || '').toLowerCase()
  if (c === 'annual') return 12
  if (c === 'semiannual') return 6
  return 1
}

function addMonthsWithFebRule(base, months) {
  const dt = toDateOnly(base)
  if (!dt) return null
  const day = dt.getDate()
  const baseMonth = dt.getMonth()
  const baseYear = dt.getFullYear()
  const total = baseMonth + Number(months || 0)
  const year = baseYear + Math.floor(total / 12)
  const month = ((total % 12) + 12) % 12
  if (month === 1 && day >= 29) {
    const m1 = new Date(year, 2, 1)
    m1.setHours(0, 0, 0, 0)
    return m1
  }
  const candidate = new Date(year, month, day)
  candidate.setHours(0, 0, 0, 0)
  return candidate
}

function isPaidInvoice(inv) {
  const s = String(inv?.status || '').toLowerCase()
  const ps = String(inv?.paymentStatus || '').toLowerCase()
  return s === 'paid' || ps === 'paid'
}

async function ensureTwoPendingInvoices({ db, ownerId }) {
  if (!ownerId) return

  const subRef = db.collection('subscriptions').doc(ownerId)
  const subSnap = await subRef.get()
  if (!subSnap.exists) return
  const sub = { id: subSnap.id, ...subSnap.data() }
  if (!sub.planId) return

  const invSnap = await db.collection('invoices').where('ownerId', '==', ownerId).get()
  const invoices = invSnap.docs.map(d => ({ id: d.id, _ref: d.ref, ...d.data() }))
  const validInvoices = invoices.filter(i => {
    const due = toDateOnly(i.dueDate)
    return due && due.getFullYear() >= 2000
  })

  // Dedup: se houver mais de uma fatura pendente no mesmo dia, mantém só 1 (evita "duplicadas")
  const dueKeyOf = (d) => {
    const dt = toDateOnly(d)
    if (!dt) return ''
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  }
  const dupMap = new Map()
  for (const inv of validInvoices) {
    const key = dueKeyOf(inv.dueDate)
    if (!key) continue
    if (!dupMap.has(key)) dupMap.set(key, [])
    dupMap.get(key).push(inv)
  }
  const dupBatch = db.batch()
  let dupDeletes = 0
  for (const [key, list] of dupMap.entries()) {
    const unpaidList = list.filter(i => !isPaidInvoice(i))
    if (unpaidList.length <= 1) continue
    const sorted = unpaidList.slice().sort((a, b) => {
      const na = Number(a.number || 0)
      const nb = Number(b.number || 0)
      if (na && nb && na !== nb) return na - nb
      const ca = normalizeTimestampToDate(a.createdAt)?.getTime?.() || 0
      const cb = normalizeTimestampToDate(b.createdAt)?.getTime?.() || 0
      return ca - cb
    })
    const keep = sorted[0]
    for (const it of sorted.slice(1)) {
      if (it._ref) {
        dupBatch.delete(it._ref)
        dupDeletes += 1
      }
    }
    // Garante o docId determinístico também marcado como existente (se já existir outro ID, não cria outro)
    // Nada a fazer aqui além de deletar os extras
    void keep
  }
  if (dupDeletes) await dupBatch.commit()

  const unpaid = validInvoices.filter(i => !isPaidInvoice(i))
  const unpaidSorted = unpaid
    .slice()
    .sort((a, b) => (toDateOnly(a.dueDate)?.getTime() || 0) - (toDateOnly(b.dueDate)?.getTime() || 0))

  const amount = Number(sub.price || 0)
  const cycle = cycleMonths(sub.billingCycle)

  const existingDueKeys = new Set(
    validInvoices
      .map(i => {
        const d = toDateOnly(i.dueDate)
        if (!d) return ''
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      })
      .filter(Boolean)
  )

  const findStartDue = () => {
    const trialEnd = toDateOnly(sub.trialEnd)
    if (trialEnd) return trialEnd
    const nextDue = toDateOnly(sub.nextDueDate)
    if (nextDue) return nextDue
    return toDateOnly(new Date())
  }

  let lastDue = null
  for (const i of validInvoices) {
    const d = toDateOnly(i.dueDate)
    if (!d) continue
    if (!lastDue || d.getTime() > lastDue.getTime()) lastDue = d
  }
  if (!lastDue) lastDue = findStartDue()

  const createInvoiceForDue = async (due) => {
    const d0 = toDateOnly(due)
    if (!d0) return false
    const key = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`
    if (existingDueKeys.has(key)) return false
    existingDueKeys.add(key)
    lastDue = d0

    const countSnap = await db.collection('invoices').where('ownerId', '==', ownerId).count().get()
    const seq = Number(countSnap.data().count || 0) + 1
    const docId = `${ownerId}_${key}`
    try {
      await db.collection('invoices').doc(docId).create({
      ownerId,
      amount,
      status: 'pending',
      dueDate: d0,
      dueKey: key,
      paymentMethod: 'PIX',
      clientRef: ownerId,
      description: sub.planName || 'Assinatura',
      number: seq,
      orderNsu: String(seq),
      paymentStatus: 'pending',
      paymentUrl: '',
      issuedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      history: [{ type: 'created', at: new Date().toISOString(), by: 'auto' }],
      })
      return true
    } catch (e) {
      // Já existe
      return false
    }
  }

  if (unpaidSorted.length >= 2) return

  if (unpaidSorted.length === 0) {
    const startDue = findStartDue()
    await createInvoiceForDue(startDue)
  }

  const invSnap2 = await db.collection('invoices').where('ownerId', '==', ownerId).get()
  const invoices2 = invSnap2.docs.map(d => ({ id: d.id, ...d.data() }))
  let pendingCount = invoices2.filter(i => {
    const due = toDateOnly(i.dueDate)
    if (!due || due.getFullYear() < 2000) return false
    return !isPaidInvoice(i)
  }).length

  let attempts = 0
  while (pendingCount < 2 && attempts < 24) {
    const next = addMonthsWithFebRule(lastDue, cycle)
    const created = await createInvoiceForDue(next)
    if (created) pendingCount += 1
    lastDue = next || lastDue
    attempts += 1
  }
}

async function updateUnpaidInvoicesAmount({ db, ownerId }) {
  if (!ownerId) return
  const subSnap = await db.collection('subscriptions').doc(ownerId).get()
  if (!subSnap.exists) return
  const sub = { id: subSnap.id, ...subSnap.data() }
  if (!sub.planId) return
  const amount = Number(sub.price || 0)
  const name = sub.planName || 'Assinatura'

  const invSnap = await db.collection('invoices').where('ownerId', '==', ownerId).get()
  const batch = db.batch()
  let touched = 0
  invSnap.docs.forEach(docSnap => {
    const inv = docSnap.data()
    if (isPaidInvoice(inv)) return
    const due = toDateOnly(inv.dueDate)
    if (!due || due.getFullYear() < 2000) return
    batch.update(docSnap.ref, {
      amount,
      description: name,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      history: admin.firestore.FieldValue.arrayUnion({
        type: 'plan_sync',
        at: new Date().toISOString(),
        by: 'system',
      }),
    })
    touched += 1
  })
  if (touched) await batch.commit()
}

async function fetchMpPayment(token, paymentId) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.message || data?.error || 'Falha ao consultar pagamento Mercado Pago'
    throw new Error(msg)
  }
  return data
}

function parseXSignature(headerValue) {
  const raw = String(headerValue || '').trim()
  if (!raw) return { ts: '', v1: '' }
  const parts = raw.split(',').map(s => s.trim())
  let ts = ''
  let v1 = ''
  for (const p of parts) {
    const kv = p.split('=')
    if (kv.length < 2) continue
    const k = String(kv[0] || '').trim()
    const v = String(kv.slice(1).join('=') || '').trim()
    if (k === 'ts') ts = v
    if (k === 'v1') v1 = v
  }
  return { ts, v1 }
}

function safeEqualHex(a, b) {
  const aa = String(a || '')
  const bb = String(b || '')
  if (!aa || !bb) return false
  if (aa.length !== bb.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(aa, 'hex'), Buffer.from(bb, 'hex'))
  } catch {
    return false
  }
}

function verifyMpWebhookSignature({ secret, xSignature, xRequestId, dataId }) {
  const { ts, v1 } = parseXSignature(xSignature)
  const reqId = String(xRequestId || '').trim()
  const id = String(dataId || '').trim().toLowerCase()
  if (!secret || !ts || !v1 || !reqId || !id) return { ok: false, reason: 'missing_fields' }

  const tsNum = Number(ts)
  if (!Number.isFinite(tsNum)) return { ok: false, reason: 'invalid_ts' }
  const drift = Math.abs(Date.now() - tsNum)
  if (drift > 10 * 60 * 1000) return { ok: false, reason: 'ts_out_of_range' }

  const manifest = `id:${id};request-id:${reqId};ts:${ts};`
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex')
  return { ok: safeEqualHex(expected, v1), reason: 'mismatch' }
}

exports.mpWebhook = onRequest({ secrets: ['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET'] }, async (req, res) => {
  try {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!token) return res.status(500).send('missing_token')

    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET
    const xSignature = req.get('x-signature') || req.get('X-Signature') || ''
    const xRequestId = req.get('x-request-id') || req.get('X-Request-Id') || ''

    const dataIdUrl = String(req.query?.['data.id'] || '').trim()
    const idUrl = String(req.query?.id || '').trim()
    const signatureDataId = dataIdUrl || idUrl
    if (webhookSecret) {
      const v = verifyMpWebhookSignature({ secret: webhookSecret, xSignature, xRequestId, dataId: signatureDataId })
      if (!v.ok) return res.status(200).send('invalid_signature')
    }

    const idFromQuery = idUrl
    const typeFromQuery = String(req.query?.type || req.query?.topic || '').trim()
    const idFromBody = String(req.body?.data?.id || req.body?.id || '').trim()

    const paymentId = dataIdUrl || idFromQuery || idFromBody
    if (!paymentId) return res.status(200).send('no_payment_id')

    const mp = await fetchMpPayment(token, paymentId)
    const mpStatus = String(mp?.status || '').toLowerCase()
    const approved = mpStatus === 'approved'

    const externalRef = String(mp?.external_reference || '').trim()
    if (!externalRef) return res.status(200).send('no_external_reference')

    const db = getFirestore('sistemix')
    const invRef = db.collection('invoices').doc(externalRef)
    const invSnap = await invRef.get()
    if (!invSnap.exists) return res.status(200).send('invoice_not_found')

    if (!approved) {
      await invRef.update({
        mpStatus,
        mpPaymentId: mp?.id || paymentId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        history: admin.firestore.FieldValue.arrayUnion({
          type: 'mp_payment_update',
          at: new Date().toISOString(),
          by: 'webhook',
          mpStatus,
          topic: typeFromQuery || null,
        }),
      })
      return res.status(200).send('ok')
    }

    await invRef.update({
      status: 'paid',
      paymentStatus: 'paid',
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      mpStatus,
      mpPaymentId: mp?.id || paymentId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      history: admin.firestore.FieldValue.arrayUnion({
        type: 'mp_payment_paid',
        at: new Date().toISOString(),
        by: 'webhook',
        mpStatus,
        topic: typeFromQuery || null,
      }),
    })

    return res.status(200).send('ok')
  } catch (e) {
    return res.status(200).send('error')
  }
})

exports.mpSyncInvoicePayment = onCall({ secrets: ['MERCADOPAGO_ACCESS_TOKEN'] }, async (req) => {
  const invoiceId = String(req?.data?.invoiceId || '').trim()
  if (!invoiceId) throw new HttpsError('invalid-argument', 'invoiceId é obrigatório')
  if (!req.auth) throw new HttpsError('unauthenticated', 'Autenticação necessária')

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) throw new HttpsError('failed-precondition', 'MERCADOPAGO_ACCESS_TOKEN não configurado')

  const db = getFirestore('sistemix')
  const invRef = db.collection('invoices').doc(invoiceId)
  const invSnap = await invRef.get()
  if (!invSnap.exists) throw new HttpsError('not-found', 'Fatura não encontrada')
  const inv = { id: invSnap.id, ...invSnap.data() }

  const mpPaymentId = String(inv.mpPaymentId || '').trim()
  if (!mpPaymentId) {
    return { ok: true, status: 'missing_mp_payment_id' }
  }

  const mp = await fetchMpPayment(token, mpPaymentId)
  const mpStatus = String(mp?.status || '').toLowerCase()
  const approved = mpStatus === 'approved'

  if (!approved) {
    await invRef.update({
      mpStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      history: admin.firestore.FieldValue.arrayUnion({
        type: 'mp_payment_sync',
        at: new Date().toISOString(),
        by: req.auth.uid,
        mpStatus,
      }),
    })
    return { ok: true, status: mpStatus }
  }

  await invRef.update({
    status: 'paid',
    paymentStatus: 'paid',
    paidAt: admin.firestore.FieldValue.serverTimestamp(),
    mpStatus,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    history: admin.firestore.FieldValue.arrayUnion({
      type: 'mp_payment_sync_paid',
      at: new Date().toISOString(),
      by: req.auth.uid,
      mpStatus,
    }),
  })
  return { ok: true, status: 'approved' }
})

exports.mpCreatePixForInvoice = onCall({ secrets: ['MERCADOPAGO_ACCESS_TOKEN'] }, async (req) => {
  const invoiceId = String(req?.data?.invoiceId || '').trim()
  if (!invoiceId) throw new HttpsError('invalid-argument', 'invoiceId é obrigatório')
  if (!req.auth) throw new HttpsError('unauthenticated', 'Autenticação necessária')

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) throw new HttpsError('failed-precondition', 'MERCADOPAGO_ACCESS_TOKEN não configurado')
  const forcedAmount = 1

  const db = getFirestore('sistemix')
  const invRef = db.collection('invoices').doc(invoiceId)
  const invSnap = await invRef.get()
  if (!invSnap.exists) throw new HttpsError('not-found', 'Fatura não encontrada')

  const invoice = { id: invSnap.id, ...invSnap.data() }
  const existingQr = String(invoice.pixQrCodeBase64 || '')
  const existingCode = String(invoice.pixCopyPaste || '')
  const existingTicket = String(invoice.ticketUrl || invoice.paymentUrl || '')
  if ((existingQr || existingCode) && isPixStillValid(invoice)) {
    return { qr_code: existingCode, qr_code_base64: existingQr, ticket_url: existingTicket, mpPaymentId: invoice.mpPaymentId || null }
  }

  const amount = Number(invoice.amount || 0)
  if (!amount || amount <= 0) throw new HttpsError('failed-precondition', 'Valor da fatura inválido')

  const ownerId = String(invoice.ownerId || '').trim()
  const ownerSnap = ownerId ? await db.collection('users').doc(ownerId).get() : null
  const ownerEmail = ownerSnap && ownerSnap.exists ? String(ownerSnap.data().email || '').trim() : ''
  const payerEmail = ownerEmail || String(req?.auth?.token?.email || '').trim()
  if (!payerEmail) throw new HttpsError('failed-precondition', 'E-mail do pagador não encontrado')

  const expDate = addDays(new Date(), 7)
  const description = String(invoice.description || 'Assinatura Sistemix').slice(0, 240)
  const nextVersion = Number(invoice.mpPixVersion || 0) + 1
  const body = {
    transaction_amount: Number(forcedAmount.toFixed(2)),
    description,
    payment_method_id: 'pix',
    payer: { email: payerEmail },
    external_reference: invoiceId,
    date_of_expiration: expDate.toISOString(),
  }

  const res = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Idempotency-Key': `inv_${invoiceId}_v${nextVersion}`,
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
    pixAmount: Number(forcedAmount.toFixed(2)),
    paymentUrl: ticket_url || invoice.paymentUrl || '',
    ticketUrl: ticket_url || '',
    pixCopyPaste: qr_code || '',
    pixQrCodeBase64: qr_code_base64 || '',
    pixGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
    pixExpiresAt: admin.firestore.Timestamp.fromDate(expDate),
    mpPaymentId,
    mpPixVersion: nextVersion,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    history: admin.firestore.FieldValue.arrayUnion({
      type: 'mp_pix_created',
      at: new Date().toISOString(),
      by: req.auth.uid,
    }),
  })

  return { qr_code, qr_code_base64, ticket_url, mpPaymentId }
})

exports.mpPixJobProcessor = onDocumentCreated({ document: 'mp_pix_jobs/{jobId}', database: 'sistemix', secrets: ['MERCADOPAGO_ACCESS_TOKEN'] }, async (event) => {
  const jobId = String(event?.params?.jobId || '').trim()
  const jobData = event?.data?.data?.() ? event.data.data() : null
  if (!jobId || !jobData) return

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) return
  const forcedAmount = 1

  const db = getFirestore('sistemix')
  const jobRef = db.collection('mp_pix_jobs').doc(jobId)

  const invoiceId = String(jobData.invoiceId || '').trim()
  if (!invoiceId) {
    await jobRef.update({
      status: 'error',
      error: 'invoiceId é obrigatório',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return
  }

  await jobRef.update({
    status: 'processing',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  const invRef = db.collection('invoices').doc(invoiceId)
  const invSnap = await invRef.get()
  if (!invSnap.exists) {
    await jobRef.update({
      status: 'error',
      error: 'Fatura não encontrada',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return
  }

  const invoice = { id: invSnap.id, ...invSnap.data() }
  const existingQr = String(invoice.pixQrCodeBase64 || '')
  const existingCode = String(invoice.pixCopyPaste || '')
  if ((existingQr || existingCode) && isPixStillValid(invoice)) {
    await jobRef.update({
      status: 'done',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return
  }

  const amount = Number(invoice.amount || 0)
  if (!amount || amount <= 0) {
    await jobRef.update({
      status: 'error',
      error: 'Valor da fatura inválido',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return
  }

  const ownerId = String(invoice.ownerId || '').trim()
  const ownerSnap = ownerId ? await db.collection('users').doc(ownerId).get() : null
  const ownerEmail = ownerSnap && ownerSnap.exists ? String(ownerSnap.data().email || '').trim() : ''
  if (!ownerEmail) {
    await jobRef.update({
      status: 'error',
      error: 'E-mail do pagador não encontrado',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return
  }

  const expDate = addDays(new Date(), 7)
  const description = String(invoice.description || 'Assinatura Sistemix').slice(0, 240)
  const nextVersion = Number(invoice.mpPixVersion || 0) + 1
  const body = {
    transaction_amount: Number(forcedAmount.toFixed(2)),
    description,
    payment_method_id: 'pix',
    payer: { email: ownerEmail },
    external_reference: invoiceId,
    date_of_expiration: expDate.toISOString(),
  }

  const res = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Idempotency-Key': `inv_${invoiceId}_v${nextVersion}`,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.message || data?.error || 'Falha ao criar pagamento Mercado Pago'
    await jobRef.update({
      status: 'error',
      error: msg,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    await invRef.update({
      paymentProvider: 'mercadopago',
      paymentMethod: 'PIX',
      paymentStatus: 'error',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      history: admin.firestore.FieldValue.arrayUnion({
        type: 'mp_pix_error',
        at: new Date().toISOString(),
        by: 'system',
        error: msg,
      }),
    })
    return
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
    pixAmount: Number(forcedAmount.toFixed(2)),
    paymentUrl: ticket_url || invoice.paymentUrl || '',
    ticketUrl: ticket_url || '',
    pixCopyPaste: qr_code || '',
    pixQrCodeBase64: qr_code_base64 || '',
    pixGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
    pixExpiresAt: admin.firestore.Timestamp.fromDate(expDate),
    mpPaymentId,
    mpPixVersion: nextVersion,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    history: admin.firestore.FieldValue.arrayUnion({
      type: 'mp_pix_created',
      at: new Date().toISOString(),
      by: 'system',
    }),
  })

  await jobRef.update({
    status: 'done',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
})

exports.mpPaymentSyncJobProcessor = onDocumentCreated({ document: 'mp_payment_sync_jobs/{jobId}', database: 'sistemix', secrets: ['MERCADOPAGO_ACCESS_TOKEN'] }, async (event) => {
  const jobId = String(event?.params?.jobId || '').trim()
  const jobData = event?.data?.data?.() ? event.data.data() : null
  if (!jobId || !jobData) return

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) return

  const db = getFirestore('sistemix')
  const jobRef = db.collection('mp_payment_sync_jobs').doc(jobId)

  const invoiceId = String(jobData.invoiceId || '').trim()
  if (!invoiceId) {
    await jobRef.update({
      status: 'error',
      error: 'invoiceId é obrigatório',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return
  }

  await jobRef.update({
    status: 'processing',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  const invRef = db.collection('invoices').doc(invoiceId)
  const invSnap = await invRef.get()
  if (!invSnap.exists) {
    await jobRef.update({
      status: 'error',
      error: 'Fatura não encontrada',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return
  }

  const inv = { id: invSnap.id, ...invSnap.data() }
  const mpPaymentId = String(inv.mpPaymentId || '').trim()
  if (!mpPaymentId) {
    await jobRef.update({
      status: 'error',
      error: 'mpPaymentId não encontrado na fatura',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return
  }

  let mp
  try {
    mp = await fetchMpPayment(token, mpPaymentId)
  } catch (e) {
    await jobRef.update({
      status: 'error',
      error: String(e?.message || 'Falha ao consultar pagamento'),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return
  }

  const mpStatus = String(mp?.status || '').toLowerCase()
  const approved = mpStatus === 'approved'

  if (!approved) {
    await invRef.update({
      mpStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      history: admin.firestore.FieldValue.arrayUnion({
        type: 'mp_payment_sync_job',
        at: new Date().toISOString(),
        by: 'system',
        mpStatus,
      }),
    })
    await jobRef.update({
      status: 'done',
      result: mpStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    return
  }

  await invRef.update({
    status: 'paid',
    paymentStatus: 'paid',
    paidAt: admin.firestore.FieldValue.serverTimestamp(),
    mpStatus,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    history: admin.firestore.FieldValue.arrayUnion({
      type: 'mp_payment_sync_job_paid',
      at: new Date().toISOString(),
      by: 'system',
      mpStatus,
    }),
  })

  await jobRef.update({
    status: 'done',
    result: 'approved',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
})

exports.subscriptionSyncProcessor = onDocumentWritten({ document: 'subscriptions/{ownerId}', database: 'sistemix' }, async (event) => {
  const ownerId = String(event?.params?.ownerId || '').trim()
  if (!ownerId) return
  const db = getFirestore('sistemix')
  await updateUnpaidInvoicesAmount({ db, ownerId })
  await ensureTwoPendingInvoices({ db, ownerId })
})

exports.invoicePaidProcessor = onDocumentUpdated({ document: 'invoices/{invoiceId}', database: 'sistemix' }, async (event) => {
  const after = event?.data?.after?.data?.() ? event.data.after.data() : null
  const before = event?.data?.before?.data?.() ? event.data.before.data() : null
  if (!after || !before) return

  const wasPaid = isPaidInvoice(before)
  const isPaid = isPaidInvoice(after)
  if (wasPaid || !isPaid) return

  const ownerId = String(after.ownerId || '').trim()
  if (!ownerId) return

  const db = getFirestore('sistemix')
  await ensureTwoPendingInvoices({ db, ownerId })
})

exports.requestRegistrationCode = onCall({ cors: true }, async (request) => {
  const email = String(request.data?.email || '').trim().toLowerCase();
  if (!email) throw new HttpsError('invalid-argument', 'E-mail é obrigatório');

  const db = getFirestore('sistemix');
  
  try {
    // Verificar se já existe usuário com esse email
    const userSnap = await db.collection('users').where('email', '==', email).get();
    if (!userSnap.empty) {
      throw new HttpsError('already-exists', 'Este e-mail já está em uso em uma conta ativa.');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    await db.collection('registration_codes').doc(email).set({
      code,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('ERRO: RESEND_API_KEY não encontrada no process.env');
      throw new HttpsError('failed-precondition', 'Configuração de e-mail ausente no servidor.');
    }

    const resend = new Resend(apiKey);
    const from = process.env.RESEND_SENDER_EMAIL || 'contato@sistemixcomercio.app.br';

    await resend.emails.send({
      from,
      to: email,
      subject: 'Seu código de verificação Sistemix',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #111827; text-align: center;">Bem-vindo ao Sistemix</h2>
          <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">Olá! Para finalizar seu cadastro, use o código de verificação abaixo:</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #059669;">${code}</span>
          </div>
          <p style="color: #6b7280; font-size: 14px; text-align: center;">Este código expira em 15 minutos.</p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">Se você não solicitou este código, ignore este e-mail.</p>
        </div>
      `,
    });

    return { ok: true };
  } catch (error) {
    console.error('Erro em requestRegistrationCode:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', error.message || 'Falha ao processar solicitação.');
  }
});

exports.verifyCodeAndCompleteRegistration = onCall({ cors: true }, async (request) => {
  const email = String(request.data?.email || '').trim().toLowerCase()
  const code = String(request.data?.code || '').trim()
  const name = String(request.data?.name || '').trim()
  const password = String(request.data?.password || '')
  const whatsapp = String(request.data?.whatsapp || '').trim()
  const storeName = String(request.data?.storeName || '').trim()

  if (!email || !code || !name || !password || !whatsapp || !storeName) {
    throw new HttpsError('invalid-argument', 'Todos os campos são obrigatórios.')
  }
  if (code.length !== 6) {
    throw new HttpsError('invalid-argument', 'Código inválido.')
  }
  if (password.length < 6) {
    throw new HttpsError('invalid-argument', 'A senha deve ter pelo menos 6 caracteres.')
  }

  const db = getFirestore('sistemix')

  try {
    const codeRef = db.collection('registration_codes').doc(email)
    const codeSnap = await codeRef.get()
    if (!codeSnap.exists) {
      throw new HttpsError('not-found', 'Código não encontrado ou expirado.')
    }

    const codeData = codeSnap.data()
    const storedCode = String(codeData?.code || '').trim()
    const expiresAt = codeData?.expiresAt?.toDate ? codeData.expiresAt.toDate() : null
    if (storedCode !== code) {
      throw new HttpsError('invalid-argument', 'Código de verificação incorreto.')
    }
    if (!expiresAt || expiresAt.getTime() < Date.now()) {
      throw new HttpsError('deadline-exceeded', 'Código expirado.')
    }

    const userSnap = await db.collection('users').where('email', '==', email).get()
    if (!userSnap.empty) {
      throw new HttpsError('already-exists', 'Este e-mail já está em uso em uma conta ativa.')
    }

    const ownerRef = db.collection('users').doc()
    const storeRef = db.collection('stores').doc()

    const now = admin.firestore.FieldValue.serverTimestamp()
    const trialStart = new Date()
    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const batch = db.batch()
    batch.set(ownerRef, {
      name,
      email,
      password,
      whatsapp,
      trial: true,
      trialValidUntil: admin.firestore.Timestamp.fromDate(trialEnd),
      isAdmin: false,
      isSeller: false,
      isTech: false,
      allowDiscount: false,
      active: true,
      role: '',
      storeId: storeRef.id,
      permissions: {},
      cep: '',
      address: '',
      number: '',
      neighborhood: '',
      city: '',
      state: '',
      status: 'ativo',
      createdAt: now,
      updatedAt: now,
    })

    batch.set(storeRef, {
      name: storeName,
      ownerId: ownerRef.id,
      adminId: ownerRef.id,
      cep: '',
      address: '',
      number: '',
      neighborhood: '',
      city: '',
      state: '',
      createdAt: now,
      updatedAt: now,
    })

    const subRef = db.collection('subscriptions').doc(ownerRef.id)
    batch.set(subRef, {
      ownerId: ownerRef.id,
      trialStart: admin.firestore.Timestamp.fromDate(trialStart),
      trialEnd: admin.firestore.Timestamp.fromDate(trialEnd),
      computedStatus: 'ativo',
      computedAt: now,
      updatedAt: now,
      createdAt: now,
    }, { merge: true })

    batch.delete(codeRef)
    await batch.commit()

    return { ok: true, ownerId: ownerRef.id, storeId: storeRef.id, trialUntil: trialEnd.toISOString() }
  } catch (error) {
    console.error('Erro em verifyCodeAndCompleteRegistration:', error)
    if (error instanceof HttpsError) throw error
    throw new HttpsError('internal', error?.message || 'Erro ao concluir cadastro.')
  }
})

exports.requestPasswordResetCode = onCall({ cors: true }, async (request) => {
  const email = String(request.data?.email || '').trim().toLowerCase();
  if (!email) throw new HttpsError('invalid-argument', 'E-mail é obrigatório');

  const db = getFirestore('sistemix');
  
  try {
    // 1. Verificar se o usuário existe
    const userSnap = await db.collection('users').where('email', '==', email).get();
    if (userSnap.empty) {
      // Por segurança, não confirmamos que o e-mail não existe, 
      // mas aqui para o sistema interno vamos dar o erro para o usuário saber.
      throw new HttpsError('not-found', 'E-mail não cadastrado no sistema.');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos para reset

    await db.collection('password_reset_codes').doc(email).set({
      code,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_SENDER_EMAIL || 'contato@sistemixcomercio.app.br';
    const resend = new Resend(apiKey);

    await resend.emails.send({
      from,
      to: email,
      subject: 'Recuperação de Senha - Sistemix',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #111827; text-align: center;">Recuperação de Senha</h2>
          <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">Você solicitou a recuperação de sua senha. Use o código abaixo para prosseguir:</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #ef4444;">${code}</span>
          </div>
          <p style="color: #6b7280; font-size: 14px; text-align: center;">Este código expira em 10 minutos.</p>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">Se você não solicitou a troca de senha, por favor ignore este e-mail.</p>
        </div>
      `,
    });

    return { ok: true };
  } catch (error) {
    console.error('Erro em requestPasswordResetCode:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Erro ao processar solicitação de senha.');
  }
});

exports.verifyResetCodeAndChangePassword = onCall({ cors: true }, async (request) => {
  const { email, code, newPassword } = request.data || {};
  const emailLower = String(email || '').trim().toLowerCase();
  
  if (!emailLower || !code || !newPassword) {
    throw new HttpsError('invalid-argument', 'Todos os campos são obrigatórios.');
  }

  const db = getFirestore('sistemix');
  
  try {
    const codeRef = db.collection('password_reset_codes').doc(emailLower);
    const codeSnap = await codeRef.get();

    if (!codeSnap.exists) {
      throw new HttpsError('not-found', 'Código não encontrado ou expirado.');
    }

    const data = codeSnap.data();
    if (data.code !== code) {
      throw new HttpsError('invalid-argument', 'Código de verificação incorreto.');
    }

    if (data.expiresAt.toDate() < new Date()) {
      throw new HttpsError('deadline-exceeded', 'Código expirado.');
    }

    // 1. Buscar o usuário
    const userSnap = await db.collection('users').where('email', '==', emailLower).get();
    if (userSnap.empty) {
      throw new HttpsError('not-found', 'Usuário não encontrado.');
    }

    const userDoc = userSnap.docs[0];
    
    // 2. Atualizar a senha
    await userDoc.ref.update({
      password: newPassword,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 3. Limpar o código usado
    await codeRef.delete();

    return { ok: true };
  } catch (error) {
    console.error('Erro em verifyResetCodeAndChangePassword:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Erro ao atualizar senha.');
  }
});
