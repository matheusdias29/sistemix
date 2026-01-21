import { collection, addDoc, updateDoc, doc, onSnapshot, query, where, serverTimestamp, orderBy } from 'firebase/firestore'
import { db } from '../lib/firebase'

const colRef = collection(db, 'paymentMethods')

export function listenPaymentMethods(callback, storeId) {
  if (!storeId) return () => {}
  
  // Removed orderBy to avoid missing index error
  const q = query(colRef, where('storeId', '==', storeId))
  
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    // Sort by createdAt client-side
    items.sort((a, b) => {
      const tA = a.createdAt?.seconds || 0
      const tB = b.createdAt?.seconds || 0
      return tA - tB
    })
    callback(items)
  }, (err) => {
    console.error('listenPaymentMethods error', err)
  })
}

export async function addPaymentMethod(method, storeId) {
  if (!storeId) throw new Error('storeId é obrigatório')
  
  const data = {
    storeId,
    name: method.name,
    label: method.label || method.name,
    type: method.type,
    active: method.active ?? true,
    locked: false,
    
    // Configurações específicas
    tax: method.tax ?? '',
    pixKey: method.pixKey ?? '',
    pixKeyType: method.pixKeyType ?? '',
    bankInfo: method.bankInfo ?? '',
    
    // Configurações de cartão
    paymentMode: method.paymentMode ?? 'single', // 'single' | 'installments'
    installmentsConfig: method.installmentsConfig ?? [], // array de config
    cnpjCredenciadora: method.cnpjCredenciadora ?? method.cnpj ?? '',

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  
  await addDoc(colRef, data)
}

export async function updatePaymentMethod(id, partial) {
  const ref = doc(db, 'paymentMethods', id)
  await updateDoc(ref, { ...partial, updatedAt: serverTimestamp() })
}
