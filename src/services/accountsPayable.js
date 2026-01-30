import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

const colRef = collection(db, 'accounts_payable')

// Ouvir contas a pagar de uma loja
export function listenAccountsPayable(callback, storeId) {
  if (!storeId) return () => {}
  // Removido orderBy para evitar necessidade de índice composto imediato no Firestore
  // A ordenação será feita no cliente
  const q = query(colRef, where('storeId', '==', storeId))
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    // Ordenação cliente-side por data de vencimento
    items.sort((a, b) => {
      const dateA = a.dueDate || ''
      const dateB = b.dueDate || ''
      return dateA.localeCompare(dateB)
    })
    callback(items)
  }, (err) => {
    console.error('listenAccountsPayable error', err)
  })
}

// Adicionar conta
export async function addAccountPayable(data, storeId) {
  if (!storeId) throw new Error('storeId é obrigatório')
  
  const docData = {
    storeId,
    supplierId: data.supplierId || null,
    supplierName: data.supplierName || '', // Desnormalizado para facilitar
    description: data.description || '',
    categoryId: data.categoryId || null,
    categoryName: data.categoryName || '',
    details: data.details || '',
    isRecurring: data.isRecurring || false,
    originalValue: Number(data.value || 0),
    paidValue: 0,
    remainingValue: Number(data.value || 0),
    dueDate: data.dueDate || null, // Timestamp ou string ISO
    paymentDate: null,
    status: 'pending', // pending, paid, cancelled
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }

  const res = await addDoc(colRef, docData)
  return res.id
}

// Atualizar conta
export async function updateAccountPayable(id, data) {
  const docRef = doc(db, 'accounts_payable', id)
  await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() })
}

// Remover conta
export async function removeAccountPayable(id) {
  const docRef = doc(db, 'accounts_payable', id)
  await deleteDoc(docRef)
}
