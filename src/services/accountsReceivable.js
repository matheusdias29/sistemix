import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

const colRef = collection(db, 'accounts_receivable')

// Ouvir contas a receber de uma loja
export function listenAccountsReceivable(callback, storeId) {
  if (!storeId) return () => {}
  const q = query(colRef, where('storeId', '==', storeId))
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    // Ordenação cliente-side
    items.sort((a, b) => {
      const dateA = a.dueDate || ''
      const dateB = b.dueDate || ''
      return dateA.localeCompare(dateB)
    })
    callback(items)
  }, (err) => {
    console.error('listenAccountsReceivable error', err)
  })
}

// Adicionar conta
export async function addAccountReceivable(data, storeId) {
  if (!storeId) throw new Error('storeId é obrigatório')
  
  const docData = {
    storeId,
    clientId: data.clientId || null,
    clientName: data.clientName || '', // Desnormalizado
    description: data.description || '',
    value: Number(data.value || 0),
    paidValue: 0,
    remainingValue: Number(data.value || 0),
    dueDate: data.dueDate || null, // String YYYY-MM-DD
    paymentDate: null,
    status: 'pending', // pending, paid, cancelled
    type: data.type || 'receivable', // 'receivable' or 'credit'
    receivedBy: data.receivedBy || '', 
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }

  const res = await addDoc(colRef, docData)
  return res.id
}

// Atualizar conta
export async function updateAccountReceivable(id, data) {
  const docRef = doc(db, 'accounts_receivable', id)
  await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() })
}

// Remover conta
export async function removeAccountReceivable(id) {
  const docRef = doc(db, 'accounts_receivable', id)
  await deleteDoc(docRef)
}
