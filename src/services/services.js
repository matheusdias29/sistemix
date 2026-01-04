import { collection, addDoc, updateDoc, doc, onSnapshot, query, where, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

const colRef = collection(db, 'services')

export function listenServices(callback, storeId){
  const q = storeId 
    ? query(colRef, where('storeId','==',storeId))
    : query(colRef, orderBy('createdAt','desc'))
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
    callback(items)
  }, (err) => {
    console.error('listenServices error', err)
  })
}

export async function addService(service, storeId){
  if (!storeId) throw new Error('storeId é obrigatório ao criar serviço')
  const data = {
    storeId,
    name: service.name ?? 'Novo Serviço',
    active: service.active ?? true,
    cost: Number(service.cost ?? 0),
    price: Number(service.price ?? 0),
    notes: service.notes ?? '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const res = await addDoc(colRef, data)
  return res.id
}

export async function updateService(id, partial){
  const ref = doc(db, 'services', id)
  await updateDoc(ref, { ...partial, updatedAt: serverTimestamp() })
}
