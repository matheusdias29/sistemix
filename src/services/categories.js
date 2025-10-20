import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

const colRef = collection(db, 'categories')

export function listenCategories(callback){
  const q = query(colRef, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(items)
  })
}

export async function addCategory(category){
  const data = {
    name: category.name ?? 'Nova Categoria',
    commissionRate: Number(category.commissionRate ?? 0),
    active: category.active ?? true,
    imageUrl: category.imageUrl ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const res = await addDoc(colRef, data)
  return res.id
}

export async function updateCategory(id, partial){
  const ref = doc(db, 'categories', id)
  await updateDoc(ref, { ...partial, updatedAt: serverTimestamp() })
}