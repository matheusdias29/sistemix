import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../lib/firebase'

const colRef = collection(db, 'suppliers')

export function listenSuppliers(callback, storeId){
  const q = storeId
    ? query(colRef, where('storeId','==',storeId))
    : query(colRef, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
    callback(items)
  }, (err) => {
    console.error('listenSuppliers error', err)
  })
}

export async function addSupplier(supplier, storeId){
  if (!storeId) throw new Error('storeId é obrigatório ao criar fornecedor')
  const data = {
    storeId,
    name: supplier.name ?? 'Novo Fornecedor',
    whatsapp: supplier.whatsapp ?? '',
    phone: supplier.phone ?? '',
    cnpj: supplier.cnpj ?? '',
    isCompany: supplier.isCompany ?? false,
    // Endereço
    cep: supplier.cep ?? '',
    address: supplier.address ?? '',
    number: supplier.number ?? '',
    complement: supplier.complement ?? '',
    neighborhood: supplier.neighborhood ?? '',
    city: supplier.city ?? '',
    state: supplier.state ?? '',
    // Informações adicionais
    code: supplier.code ?? '',
    stateRegistration: supplier.stateRegistration ?? '',
    email: supplier.email ?? '',
    notes: supplier.notes ?? '',
    // Status
    active: supplier.active ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const res = await addDoc(colRef, data)
  return res.id
}

export async function updateSupplier(id, partial){
  const ref = doc(db, 'suppliers', id)
  await updateDoc(ref, { ...partial, updatedAt: serverTimestamp() })
}

export async function removeSupplier(id){
  const { deleteDoc } = await import('firebase/firestore')
  const ref = doc(db, 'suppliers', id)
  await deleteDoc(ref)
}