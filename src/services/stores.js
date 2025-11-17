import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

const storesCol = collection(db, 'stores')

export async function addStore(store){
  const data = {
    name: store.name ?? 'Nova Loja',
    ownerId: store.ownerId, // dono da loja
    adminId: store.adminId ?? store.ownerId, // id do admin
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