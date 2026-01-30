import { collection, addDoc, updateDoc, doc, onSnapshot, query, where, orderBy, serverTimestamp, deleteDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

const colRef = collection(db, 'financial_categories')

export function listenFinancialCategories(callback, storeId){
  const q = storeId
    ? query(colRef, where('storeId','==',storeId))
    : query(colRef, orderBy('createdAt', 'desc'))
  
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b) => (a.name || '').localeCompare(b.name || ''))
    callback(items)
  }, (err) => {
    console.error('listenFinancialCategories error', err)
  })
}

export async function addFinancialCategory(data, storeId){
  if (!storeId) throw new Error('storeId é obrigatório')
  
  const payload = {
    storeId,
    name: data.name,
    type: data.type || 'out', // 'in' | 'out'
    active: data.active ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }
  
  const res = await addDoc(colRef, payload)
  return res.id
}

export async function updateFinancialCategory(id, partial){
  const ref = doc(db, 'financial_categories', id)
  await updateDoc(ref, { ...partial, updatedAt: serverTimestamp() })
}

export async function deleteFinancialCategory(id){
  const ref = doc(db, 'financial_categories', id)
  await deleteDoc(ref)
}
