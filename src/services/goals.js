import { collection, addDoc, updateDoc, doc, onSnapshot, query, where, serverTimestamp, deleteDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

const colRef = collection(db, 'goals')

export function listenGoals(callback, storeId){
  const q = storeId ? query(colRef, where('storeId','==',storeId)) : query(colRef)
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(items)
  })
}

export async function addGoal(goal, storeId){
  const data = {
    storeId,
    monthYear: goal.monthYear, // formato MM/YYYY
    target: Number(goal.target || 0),
    includeSale: !!goal.includeSale,
    includeServiceOrder: !!goal.includeServiceOrder,
    // opcional para metas de vendedor
    sellerId: goal.sellerId || '',
    sellerName: goal.sellerName || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const res = await addDoc(colRef, data)
  return res.id
}

export async function updateGoal(id, partial){
  const ref = doc(db, 'goals', id)
  await updateDoc(ref, { ...partial, updatedAt: serverTimestamp() })
}

export async function removeGoal(id){
  const ref = doc(db, 'goals', id)
  await deleteDoc(ref)
}
