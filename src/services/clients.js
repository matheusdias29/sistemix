import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where, getDocs, limit } from 'firebase/firestore'
import { db } from '../lib/firebase'

const colRef = collection(db, 'clients')

export function listenClients(callback, storeId){
  const q = storeId
    ? query(colRef, where('storeId','==',storeId))
    : query(colRef, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
    callback(items)
  })
}

export async function addClient(client, storeId){
  if (!storeId) throw new Error('storeId é obrigatório ao criar cliente')
  const data = {
    storeId,
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
    identity: client.identity ?? '',
    stateRegistrationIndicator: client.stateRegistrationIndicator ?? '',
    motherName: client.motherName ?? '',
    birthDate: client.birthDate ?? '',
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

export async function removeClient(id){
  const ref = doc(db, 'clients', id)
  const { deleteDoc } = await import('firebase/firestore')
  await deleteDoc(ref)
}

export async function getNextClientCode(storeId) {
  try {
    // Busca todos os clientes da loja para calcular o maior código
    // (Isso evita erros de índice composto no Firestore e problemas de ordenação de string)
    const q = query(colRef, where('storeId', '==', storeId))
    const snapshot = await getDocs(q)
    
    if (snapshot.empty) return '1'

    let maxCode = 0

    snapshot.docs.forEach(doc => {
      const data = doc.data()
      if (data.code) {
        const num = parseInt(data.code, 10)
        if (!isNaN(num) && num > maxCode) {
          maxCode = num
        }
      }
    })

    return (maxCode + 1).toString()
  } catch (error) {
    console.error("Error getting next code:", error)
    // Em caso de erro, tenta fallback seguro ou retorna 1
    return '1'
  }
}