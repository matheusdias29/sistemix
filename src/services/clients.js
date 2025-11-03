import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

const colRef = collection(db, 'clients')

export function listenClients(callback){
  const q = query(colRef, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(items)
  })
}

export async function addClient(client){
  const data = {
    name: client.name ?? 'Novo Cliente',
    whatsapp: client.whatsapp ?? '',
    phone: client.phone ?? '',
    cpf: client.cpf ?? '',
    cnpj: client.cnpj ?? '',
    allowCredit: client.allowCredit ?? false,
    isCompany: client.isCompany ?? false,
    // Endereço
    cep: client.cep ?? '',
    address: client.address ?? '',
    number: client.number ?? '',
    complement: client.complement ?? '',
    neighborhood: client.neighborhood ?? '',
    city: client.city ?? '',
    state: client.state ?? '',
    // Informações adicionais
    email: client.email ?? '',
    notes: client.notes ?? '',
    code: client.code ?? '',
    // Status
    active: client.active ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const res = await addDoc(colRef, data)
  return res.id
}

export async function updateClient(id, partial){
  const ref = doc(db, 'clients', id)
  await updateDoc(ref, { ...partial, updatedAt: serverTimestamp() })
}