import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

const notificationsCol = collection(db, 'notifications')
const GLOBAL_STORE_ID = '__all__'

export function getGlobalStoreId() {
  return GLOBAL_STORE_ID
}

function normalizeType(t) {
  const type = String(t || '').toLowerCase()
  if (type === 'success' || type === 'warning' || type === 'error') return type
  return 'info'
}

function mapSnap(snap) {
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

function mergeSortNotifications(a = [], b = [], max = 50) {
  const map = new Map()
  ;[...a, ...b].forEach(it => {
    if (!it || !it.id) return
    map.set(it.id, it)
  })
  const list = Array.from(map.values())
  list.sort((x, y) => {
    const ax = x.createdAt?.toMillis?.() ?? x.createdAt?.toDate?.()?.getTime?.() ?? 0
    const ay = y.createdAt?.toMillis?.() ?? y.createdAt?.toDate?.()?.getTime?.() ?? 0
    return ay - ax
  })
  return list.slice(0, Math.max(1, Number(max) || 50))
}

export function listenStoreNotifications(storeId, callback, options = {}) {
  if (!storeId) {
    callback([])
    return () => {}
  }

  const max = typeof options.limit === 'number' ? options.limit : 50
  const includeGlobal = options.includeGlobal !== false

  let storeItems = []
  let globalItems = []

  const qStore = query(notificationsCol, where('storeId', '==', storeId))

  const unsubStore = onSnapshot(qStore, (snap) => {
    storeItems = mapSnap(snap)
    callback(mergeSortNotifications(storeItems, globalItems, max))
  })

  let unsubGlobal = null
  if (includeGlobal) {
    const qGlobal = query(notificationsCol, where('storeId', '==', GLOBAL_STORE_ID))
    unsubGlobal = onSnapshot(qGlobal, (snap) => {
      globalItems = mapSnap(snap)
      callback(mergeSortNotifications(storeItems, globalItems, max))
    })
  }

  return () => {
    try { unsubStore && unsubStore() } catch {}
    try { unsubGlobal && unsubGlobal() } catch {}
  }
}

export function listenAllNotifications(callback, options = {}) {
  const max = typeof options.limit === 'number' ? options.limit : 50
  const q = query(notificationsCol, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => callback(mapSnap(snap).slice(0, Math.max(1, max))))
}

export async function sendNotificationToStore(storeId, payload) {
  const data = {
    storeId: storeId || GLOBAL_STORE_ID,
    title: String(payload?.title || '').trim(),
    message: String(payload?.message || '').trim(),
    type: normalizeType(payload?.type),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: payload?.createdBy || null,
  }
  const res = await addDoc(notificationsCol, data)
  return res.id
}

export async function sendNotificationToAllStores(payload) {
  return sendNotificationToStore(GLOBAL_STORE_ID, payload)
}
