import { collection, doc, setDoc, onSnapshot, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

const colRef = collection(db, 'subscriptions')

export function listenAllSubscriptions(cb) {
  return onSnapshot(colRef, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    cb(items)
  })
}

export function listenSubscription(ownerId, cb) {
  if (!ownerId) return () => {}
  const ref = doc(db, 'subscriptions', ownerId)
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      cb({ id: snap.id, ...snap.data() })
    } else {
      cb(null)
    }
  })
}

export async function getSubscription(ownerId) {
  if (!ownerId) return null
  const ref = doc(db, 'subscriptions', ownerId)
  const snap = await getDoc(ref)
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function upsertPlan(ownerId, plan) {
  if (!ownerId) throw new Error('ownerId obrigatório')
  const ref = doc(db, 'subscriptions', ownerId)
  const base = {
    ownerId,
    planId: plan.id,
    planName: plan.name,
    price: Number(plan.price || 0),
    billingCycle: plan.billingCycle || 'monthly',
    graceDays: plan.graceDays ?? 3,
    updatedAt: serverTimestamp(),
  }
  const current = await getSubscription(ownerId)
  if (!current) {
    const nextDue = new Date()
    nextDue.setDate(nextDue.getDate() + 30)
    await setDoc(ref, {
      ...base,
      nextDueDate: nextDue,
      trialStart: null,
      trialEnd: null,
      canceledAt: null,
      computedStatus: 'ativo',
      computedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true })
  } else {
    await setDoc(ref, base, { merge: true })
  }
}

export async function setNextDueDate(ownerId, date) {
  const ref = doc(db, 'subscriptions', ownerId)
  await updateDoc(ref, { nextDueDate: date, updatedAt: serverTimestamp() })
}

export function computeStatus(sub) {
  const now = new Date()
  if (sub?.canceledAt) return 'cancelado'
  if (sub?.trialEnd && now <= new Date(sub.trialEnd)) return 'ativo'
  if (!sub?.nextDueDate) return 'em_atraso'
  const due = new Date(sub.nextDueDate)
  const grace = Number(sub.graceDays || 0)
  const graceLimit = new Date(due.getTime() + grace * 24 * 60 * 60 * 1000)
  if (now <= due) return 'ativo'
  if (now <= graceLimit) return 'em_atraso'
  return 'cancelado'
}

export async function startTrial(ownerId, days = 7) {
  if (!ownerId) throw new Error('ownerId obrigatório')
  const ref = doc(db, 'subscriptions', ownerId)
  const start = new Date()
  const end = new Date(Date.now() + days*24*60*60*1000)
  await setDoc(ref, {
    ownerId,
    trialStart: start,
    trialEnd: end,
    computedStatus: 'ativo',
    computedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true })
}

function normalizeDate(d) {
  if (!d) return null
  try {
    if (typeof d?.toDate === 'function') return d.toDate()
    if (typeof d?.seconds === 'number') return new Date(d.seconds * 1000)
    return new Date(d)
  } catch {
    return null
  }
}

function sameDay(a, b) {
  if (!a || !b) return false
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate()
}

export function computeStatusWithInvoices(sub, invoices) {
  const now = new Date()
  if (sub?.canceledAt) return 'cancelado'
  const trialEnd = normalizeDate(sub?.trialEnd)
  if (trialEnd && now <= trialEnd) return 'ativo'
  if (trialEnd && now > trialEnd) {
    const paidFirst = Array.isArray(invoices) && invoices.some(i => {
      const due = normalizeDate(i?.dueDate)
      return i?.status === 'paid' && due && sameDay(due, trialEnd)
    })
    if (paidFirst) return 'ativo'
    return 'em_atraso'
  }
  return computeStatus(sub)
}
