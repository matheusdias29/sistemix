import { collection, addDoc, updateDoc, doc, onSnapshot, query, where, orderBy, serverTimestamp, deleteDoc, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'

const colRef = collection(db, 'terms')

export function listenTerms(callback, storeId) {
  if (!storeId) return () => {}
  
  const q = query(colRef, where('storeId', '==', storeId))
  
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.label || '').localeCompare(b.label || ''))
    callback(items)
  }, (err) => {
    console.error('listenTerms error', err)
  })
}

export async function addTerm(term, storeId) {
  if (!storeId) throw new Error('storeId é obrigatório')
  
  const data = {
    storeId,
    label: term.label || 'Novo Termo',
    text: term.text || '',
    filename: term.filename || 'documento.pdf',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  
  const res = await addDoc(colRef, data)
  return res.id
}

export async function updateTerm(id, partial) {
  const ref = doc(db, 'terms', id)
  await updateDoc(ref, { ...partial, updatedAt: serverTimestamp() })
}

export async function deleteTerm(id) {
  const ref = doc(db, 'terms', id)
  await deleteDoc(ref)
}

// Função para inicializar os termos padrão se não existirem
export async function seedDefaultTerms(storeId, defaultTerms) {
  if (!storeId || !defaultTerms || defaultTerms.length === 0) return

  // Usar batch para adicionar vários de uma vez
  const batch = writeBatch(db)
  
  defaultTerms.forEach(term => {
    const newRef = doc(colRef) // Gera um ID novo automaticamente
    batch.set(newRef, {
      storeId,
      label: term.label,
      text: term.text || '',
      filename: term.filename || `${term.label}.pdf`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
  })

  await batch.commit()
}
