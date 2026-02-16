import { collection, doc, setDoc, addDoc, getDocs, query, where, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { addUser, updateUser } from './users'
import { addStore } from './stores'

const trialsCol = collection(db, 'trial_requests')
const adminNotifsCol = collection(db, 'admin_notifications')
const emailsCol = collection(db, 'emails')

export async function createTrialRequest(payload) {
  const email = String(payload.email || '').trim().toLowerCase()
  if (!email) throw new Error('Email é obrigatório')
  // Bloqueia duplicados pendentes
  const q = query(trialsCol, where('email', '==', email), where('status', '==', 'pending'))
  const snap = await getDocs(q)
  if (!snap.empty) {
    const d = snap.docs[0]
    return d.id
  }
  const ref = doc(trialsCol)
  const trialStart = new Date()
  const trialEnd = new Date(Date.now() + 7*24*60*60*1000)
  const data = {
    requestId: ref.id,
    name: payload.name || '',
    email,
    whatsapp: payload.whatsapp || '',
    cep: payload.cep || '',
    address: payload.address || '',
    number: payload.number || '',
    neighborhood: payload.neighborhood || '',
    city: payload.city || '',
    state: payload.state || '',
    status: 'pending',
    trial: true,
    trialStart,
    trialEnd,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }
  await setDoc(ref, data)
  await addDoc(adminNotifsCol, {
    type: 'trial_request',
    requestId: ref.id,
    email,
    name: data.name,
    createdAt: serverTimestamp(),
    unread: true
  })
  await addDoc(emailsCol, {
    to: email,
    subject: 'Recebemos sua solicitação de teste grátis',
    text: `Olá ${data.name || ''}, recebemos sua solicitação de teste de 7 dias. Em breve entraremos em contato.`,
    html: `<p>Olá ${data.name || ''},</p><p>Recebemos sua solicitação de teste grátis de 7 dias. Nossa equipe fará a aprovação e você receberá um retorno por e-mail.</p><p>Atenciosamente,<br/>SisteMix</p>`,
    status: 'queued',
    createdAt: serverTimestamp()
  })
  return ref.id
}

export function listenPendingTrials(cb, onError) {
  const q = query(trialsCol, where('status','==','pending'))
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // Ordena no cliente por createdAt desc
      items.sort((a, b) => {
        const ta = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0
        const tb = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0
        return tb - ta
      })
      cb(items)
    },
    (err) => {
      console.error('listenPendingTrials error', err)
      onError && onError(err)
    }
  )
}

export async function approveTrial(request, adminUser) {
  const id = typeof request === 'string' ? request : request.id
  if (!id) throw new Error('ID inválido')
  // Cria usuário e loja
  const name = request.name || ''
  const email = String(request.email || '').toLowerCase()
  const userId = await addUser({
    name,
    email,
    password: request.tempPassword || '123456', // senha provisória
    role: 'manager',
    isAdmin: true,
    active: true,
    // Endereço
    cep: request.cep || '',
    address: request.address || '',
    number: request.number || '',
    neighborhood: request.neighborhood || '',
    city: request.city || '',
    state: request.state || ''
  })
  const storeId = await addStore({
    name: `Loja de ${name || email}`,
    ownerId: userId,
    adminId: userId,
    cep: request.cep || '',
    address: request.address || '',
    number: request.number || '',
    neighborhood: request.neighborhood || '',
    city: request.city || '',
    state: request.state || ''
  })

  const validUntil = new Date(Date.now() + 7*24*60*60*1000)
  await updateUser(userId, { trial: true, trialStoreId: storeId, trialValidUntil: validUntil })
  await updateDoc(doc(trialsCol, id), {
    status: 'approved',
    approvedAt: serverTimestamp(),
    approvedBy: adminUser?.email || 'admin',
    userId,
    storeId,
    validUntil
  })
  await addDoc(emailsCol, {
    to: email,
    subject: 'Seu teste grátis foi aprovado!',
    text: `Olá ${name || ''}, seu teste grátis foi aprovado por 7 dias. E-mail de acesso: ${email}`,
    html: `<p>Olá ${name || ''},</p><p>Seu teste grátis foi <strong>aprovado</strong> por 7 dias.</p><p>Use seu e-mail <strong>${email}</strong> e a senha provisória cadastrada para acessar.</p>`,
    status: 'queued',
    createdAt: serverTimestamp()
  })
}

export async function rejectTrial(request, reason, adminUser) {
  const id = typeof request === 'string' ? request : request.id
  if (!id) throw new Error('ID inválido')
  await updateDoc(doc(trialsCol, id), {
    status: 'rejected',
    rejectedAt: serverTimestamp(),
    rejectedBy: adminUser?.email || 'admin',
    rejectReason: reason || ''
  })
  const email = (typeof request === 'object' ? request.email : null) || ''
  if (email) {
    await addDoc(emailsCol, {
      to: email,
      subject: 'Solicitação de teste - atualização',
      text: `Sua solicitação de teste foi analisada. Motivo: ${reason || '—'}`,
      html: `<p>Sua solicitação de teste foi analisada.</p><p>Motivo: ${reason || '—'}</p>`,
      status: 'queued',
      createdAt: serverTimestamp()
    })
  }
}
