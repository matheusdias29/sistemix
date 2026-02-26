import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where, getDocs, limit, startAfter, endAt, startAt, getDoc, getCountFromServer, deleteDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

const colRef = collection(db, 'clients')

function normalize(val) {
  return String(val || '').trim().toLowerCase()
}
function digits(val) {
  return String(val || '').replace(/\D/g, '')
}

export function listenClients(callback, storeId){
  const q = storeId
    ? query(colRef, where('storeId','==',storeId), orderBy('createdAt', 'desc'), limit(100))
    : query(colRef, orderBy('createdAt', 'desc'), limit(100))
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(items)
  })
}

// Retorna contagem total de clientes da loja
export async function getTotalClientsCount(storeId) {
  const q = query(colRef, where('storeId', '==', storeId))
  const snap = await getCountFromServer(q)
  return snap.data().count
}

// Busca paginada usando skip/offset manual (simulado com cursor seria melhor, mas para "Jump to Page" precisamos de offset ou carregar tudo)
// Como Firestore cobra offset, e o usuário quer "Jump", vamos usar uma abordagem híbrida ou array de cursors no front.
// Mas para simplificar a implementação do "Jump to Page 740", vamos usar a paginação por offset se o SDK permitir, 
// ou (melhor para performance) buscar apenas os IDs necessários? Não, Firestore não busca só IDs.
// Vamos usar a estratégia de: se page é alta, infelizmente é lento.
// POREM, podemos usar uma paginação baseada em "limit" iterativo se não tivermos "offset" importado?
// Vamos tentar importar 'offset' no topo? O SDK v9 tem? Tem.
// Vou usar uma lógica de busca sequencial de cursors se o pulo for pequeno, ou offset se for grande.
// Simplificação: Vamos fazer o "loading" dos itens.

export async function getAllClients(storeId) {
  const all = []
  let lastDoc = null
  const CHUNK_SIZE = 5000 

  try {
    while (true) {
      let q = query(
        colRef, 
        where('storeId', '==', storeId), 
        limit(CHUNK_SIZE)
      )
      
      if (lastDoc) {
        q = query(q, startAfter(lastDoc))
      }

      const snap = await getDocs(q)
      if (snap.empty) break
      
      snap.docs.forEach(d => all.push({ id: d.id, ...d.data() }))
      if (snap.docs.length < CHUNK_SIZE) break
      
      lastDoc = snap.docs[snap.docs.length - 1]
    }
  } catch (err) {
    console.error('Erro em getAllClients:', err)
  }
  
  return all
}

export async function getClientsByPage(storeId, page, pageSize) {
  // Nota: Idealmente usaríamos startAfter com o doc anterior.
  // Mas para pular para página X, precisamos de offset.
  // Vamos buscar TUDO até a página X? Não.
  // Vamos buscar ordenado por createdAt.
  
  // Solução de performance para Firestore:
  // Para pular para página 10, precisamos do último doc da página 9.
  // Não tem mágica. O custo de leitura existe.
  // Se o usuário quer ir para a página 740, ele vai ler 740 * 30 documentos (meta-data) se usar offset.
  // Vamos assumir que isso é aceitável para essa feature específica.
  
  // Como não importei 'offset' explicitamente no topo, vou usar chunks.
  // Ou melhor: vou usar o query normal e iterar.
  // É o que o offset faz por baixo dos panos no client SDK.
  
  let q = query(colRef, where('storeId', '==', storeId), orderBy('createdAt', 'desc'))
  
  // Se página 1, é simples
  if (page <= 1) {
    q = query(q, limit(pageSize))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }

  // Se página > 1, precisamos pular (page-1)*pageSize
  // Isso é pesado. Vamos tentar minimizar trazendo apenas IDs? Não dá.
  // Vamos usar getDocs com limit maior e pegar o slice?
  // Ex: limit(page * pageSize). Slice no final.
  // Isso consome banda.
  
  // Melhor: vamos manter o sistema de "Load More" (scroll infinito) ou "Next/Prev" que é o padrão Firestore.
  // MAS o usuário exigiu "Pular para página".
  // Vou implementar, mas sabendo que a página 740 vai demorar.
  
  const targetIndex = (page - 1) * pageSize
  // Usando limit grande
  const qBig = query(colRef, where('storeId', '==', storeId), orderBy('createdAt', 'desc'), limit(targetIndex + pageSize))
  const snap = await getDocs(qBig)
  const allDocs = snap.docs
  const pageDocs = allDocs.slice(targetIndex, targetIndex + pageSize)
  return pageDocs.map(d => ({ id: d.id, ...d.data() }))
}

// Busca rápida com paginação numérica
export async function searchClientsByPage(storeId, searchTerm, page, pageSize) {
  const term = searchTerm.trim()
  if (!term) return { clients: [], total: 0 }
  
  const lower = term.toLowerCase()
  const digitsVal = term.replace(/\D/g, '')
  const isNumeric = digitsVal.length === term.length && digitsVal.length > 0
  
  // 1. Contagem Total (rápida)
  let total = 0
  let qCount
  if (isNumeric) {
    qCount = query(
      colRef,
      where('storeId', '==', storeId),
      orderBy('phoneDigits'),
      startAt(digitsVal),
      endAt(digitsVal + '\uf8ff')
    )
  } else {
    qCount = query(
      colRef,
      where('storeId', '==', storeId),
      orderBy('nameLower'),
      startAt(lower),
      endAt(lower + '\uf8ff')
    )
  }
  const countSnap = await getCountFromServer(qCount)
  total = countSnap.data().count

  // 2. Busca dos dados da página
  // Mesma lógica: para pular para página X, precisamos dos dados anteriores ou limit grande.
  const targetIndex = (page - 1) * pageSize
  let qData
  if (isNumeric) {
    qData = query(
      colRef,
      where('storeId', '==', storeId),
      orderBy('phoneDigits'),
      startAt(digitsVal),
      endAt(digitsVal + '\uf8ff'),
      limit(targetIndex + pageSize)
    )
  } else {
    qData = query(
      colRef,
      where('storeId', '==', storeId),
      orderBy('nameLower'),
      startAt(lower),
      endAt(lower + '\uf8ff'),
      limit(targetIndex + pageSize)
    )
  }
  
  const snap = await getDocs(qData)
  const allDocs = snap.docs
  const pageDocs = allDocs.slice(targetIndex, targetIndex + pageSize)
  const clients = pageDocs.map(d => ({ id: d.id, ...d.data() }))
  
  return { clients, total }
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
    cep: client.cep ?? '',
    address: client.address ?? '',
    number: client.number ?? '',
    complement: client.complement ?? '',
    neighborhood: client.neighborhood ?? '',
    city: client.city ?? '',
    state: client.state ?? '',
    email: client.email ?? '',
    notes: client.notes ?? '',
    code: client.code ?? '',
    identity: client.identity ?? '',
    stateRegistrationIndicator: client.stateRegistrationIndicator ?? '',
    motherName: client.motherName ?? '',
    birthDate: client.birthDate ?? '',
    active: client.active ?? true,
    createdBy: client.createdBy ?? '',
    lastEditedBy: client.lastEditedBy ?? '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  data.nameLower = normalize(data.name)
  data.codeLower = normalize(data.code)
  data.phoneDigits = digits(data.phone)
  data.whatsappDigits = digits(data.whatsapp)
  data.cpfDigits = digits(data.cpf)
  data.cnpjDigits = digits(data.cnpj)
  const res = await addDoc(colRef, data)
  return { id: res.id, ...data, createdAt: new Date(), updatedAt: new Date() }
}

export async function updateClient(id, partial){
  const ref = doc(db, 'clients', id)
  let normalized = {}
  try {
    const snap = await getDoc(ref)
    const cur = snap.exists() ? snap.data() : {}
    const merged = { ...cur, ...partial }
    normalized = {
      nameLower: normalize(merged.name),
      codeLower: normalize(merged.code),
      phoneDigits: digits(merged.phone),
      whatsappDigits: digits(merged.whatsapp),
      cpfDigits: digits(merged.cpf),
      cnpjDigits: digits(merged.cnpj),
    }
    await updateDoc(ref, { ...partial, ...normalized, updatedAt: serverTimestamp() })
  } catch {
    await updateDoc(ref, { ...partial, updatedAt: serverTimestamp() })
  }
  return { ...partial, ...normalized, updatedAt: new Date() }
}

export async function removeClient(id){
  const ref = doc(db, 'clients', id)
  await deleteDoc(ref)
}

export async function getNextClientCode(storeId) {
  try {
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
    return '1'
  }
}



export async function getClientById(id) {
  const ref = doc(db, 'clients', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}
