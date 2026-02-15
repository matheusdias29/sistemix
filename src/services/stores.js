import { collection, addDoc, query, where, getDocs, serverTimestamp, doc, getDoc, updateDoc, orderBy, onSnapshot, limit, deleteDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { signInAnonymously } from 'firebase/auth'
import { auth } from '../lib/firebase'

const storesCol = collection(db, 'stores')

export async function addStore(store){
  const data = {
    name: store.name ?? 'Nova Loja',
    ownerId: store.ownerId, // dono da loja
    adminId: store.adminId ?? store.ownerId, // id do admin
    
    // Endereço da Loja
    cep: store.cep ?? '',
    address: store.address ?? '',
    number: store.number ?? '',
    neighborhood: store.neighborhood ?? '',
    city: store.city ?? '',
    state: store.state ?? '',

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const res = await addDoc(storesCol, data)
  return res.id
}

export async function listStoresByOwner(ownerId){
  const q = query(storesCol, where('ownerId', '==', ownerId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export function listenAllStores(callback){
  const q = query(storesCol, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(items)
  })
}

// Carrega uma loja por ID
export async function getStoreById(id){
  if(!id) return null
  const ref = doc(db, 'stores', id)
  const snap = await getDoc(ref)
  if(!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

export async function getStoreBySlug(slug){
  if(!slug) return null
  async function fetchOnce() {
    const q = query(storesCol, where('catalogSlug','==',slug))
    const snap = await getDocs(q)
    if (snap.empty) return null
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data(), _ref: d }))
    let best = null
    for (const it of docs) {
      if (!best) { best = it; continue }
      const aEnabled = !!it.catalogEnabled
      const bEnabled = !!best.catalogEnabled
      const au = it.updatedAt?.toMillis?.() ?? it.updatedAt?.toDate?.()?.getTime?.() ?? 0
      const bu = best.updatedAt?.toMillis?.() ?? best.updatedAt?.toDate?.()?.getTime?.() ?? 0
      const ac = it.createdAt?.toMillis?.() ?? it.createdAt?.toDate?.()?.getTime?.() ?? 0
      const bc = best.createdAt?.toMillis?.() ?? best.createdAt?.toDate?.()?.getTime?.() ?? 0
      if (aEnabled !== bEnabled) { best = aEnabled ? it : best; continue }
      if (au !== bu) { best = au > bu ? it : best; continue }
      if (ac !== bc) { best = ac > bc ? it : best; continue }
      best = it.id > best.id ? it : best
    }
    return best ? { id: best.id, ...best } : null
  }
  try {
    const r = await fetchOnce()
    if (r) return r
    return null
  } catch (e) {
    try {
      await signInAnonymously(auth)
      const r2 = await fetchOnce()
      return r2
    } catch {
      return null
    }
  }
}

export function listenStore(storeId, callback){
  if(!storeId) return () => {}
  const ref = doc(db, 'stores', storeId)
  return onSnapshot(ref, (snap) => {
    if(snap.exists()){
      callback({ id: snap.id, ...snap.data() })
    }
  })
}

// Atualiza dados da loja (dados da empresa)
export async function updateStore(id, partial){
  const ref = doc(db, 'stores', id)
  await updateDoc(ref, { ...partial, updatedAt: serverTimestamp() })
}

export async function isSlugAvailable(slug, excludeId){
  if(!slug) return false
  const q = query(storesCol, where('catalogSlug','==',slug))
  const snap = await getDocs(q)
  if (snap.empty) return true
  if (excludeId) {
    const others = snap.docs.filter(d => d.id !== excludeId)
    return others.length === 0
  }
  return false
}

export async function ensureUniqueSlug(baseSlug, currentId){
  const clean = String(baseSlug || '').trim()
  if (!clean) return ''
  if (await isSlugAvailable(clean, currentId)) return clean
  for (let i = 2; i < 1000; i++){
    const candidate = `${clean}-${i}`
    if (await isSlugAvailable(candidate, currentId)) return candidate
  }
  return `${clean}-${Date.now()}`
}
// ---- Taxas adicionais (por loja) ----
function feesCollection(storeId){
  return collection(db, 'stores', storeId, 'fees')
}

export async function listFees(storeId){
  if(!storeId) return []
  const q = query(feesCollection(storeId), orderBy('createdAt','desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export function listenFees(storeId, callback, onError){
  if(!storeId) return () => {}
  const q = query(feesCollection(storeId), orderBy('createdAt','desc'))
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      callback(items)
    },
    (err) => {
      console.error('listenFees error', err)
      onError && onError(err)
    }
  )
}

export async function addFee(storeId, fee){
  const data = {
    name: fee.name ?? '',
    value: typeof fee.value === 'number' ? fee.value : Number(fee.value || 0),
    type: fee.type === 'percent' ? 'percent' : 'fixed', // fixed | percent
    active: fee.active !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const res = await addDoc(feesCollection(storeId), data)
  return res.id
}

export async function updateFee(storeId, id, partial){
  const ref = doc(db, 'stores', storeId, 'fees', id)
  await updateDoc(ref, { ...partial, updatedAt: serverTimestamp() })
}

export async function deleteStoresByOwner(ownerId){
  if (!ownerId) return
  const q = query(storesCol, where('ownerId', '==', ownerId))
  const snap = await getDocs(q)
  const batchDeletes = []
  for (const d of snap.docs){
    // Remove documento da loja
    batchDeletes.push(deleteDoc(doc(db, 'stores', d.id)))
  }
  // Executa em paralelo com limite implícito
  await Promise.allSettled(batchDeletes)
}
