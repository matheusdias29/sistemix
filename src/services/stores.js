import { collection, addDoc, query, where, getDocs, serverTimestamp, doc, getDoc, updateDoc, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'

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

// Carrega uma loja por ID
export async function getStoreById(id){
  if(!id) return null
  const ref = doc(db, 'stores', id)
  const snap = await getDoc(ref)
  if(!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

// Atualiza dados da loja (dados da empresa)
export async function updateStore(id, partial){
  const ref = doc(db, 'stores', id)
  await updateDoc(ref, { ...partial, updatedAt: serverTimestamp() })
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
