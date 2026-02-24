import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../lib/firebase'

const colRef = collection(db, 'categories')

export function listenCategories(callback, storeId){
  const q = storeId
    ? query(colRef, where('storeId','==',storeId))
    : query(colRef, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
    callback(items)
  }, (err) => {
    console.error('listenCategories error', err)
  })
}

export async function addCategory(category, storeId){
  if (!storeId) throw new Error('storeId é obrigatório ao criar categoria')
  const data = {
    storeId,
    name: category.name ?? 'Nova Categoria',
    commissionRate: Number(category.commissionRate ?? 0),
    catalogMessage: category.catalogMessage ?? null,
    active: category.active ?? true,
    imageUrl: category.imageUrl ?? null,
    defaultMarkups: category.defaultMarkups ?? null,
    defaultMarkupsByGroup: category.defaultMarkupsByGroup ?? null,
    defaultMarkupModesByGroup: category.defaultMarkupModesByGroup ?? null,
    defaultMarkupAddCostByGroup: category.defaultMarkupAddCostByGroup ?? null,
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

export async function removeCategory(id){
  const ref = doc(db, 'categories', id)
  await deleteDoc(ref)
}
