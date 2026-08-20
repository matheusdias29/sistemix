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
  // IMPORTANTE: orderBy(__name__) (ID do documento) COMO PRIMEIRO ou SEGUNDO critério de ordenação.
  // Motivo: 99% dos clientes antigos não têm campo createdAt (null), então orderBy('createdAt')
  // IGNORA COMPLETAMENTE esses docs e retorna só os 81/82 novos que realmente têm o campo.
  // Usar __name__ (existe SEMPRE, não nulo) como ordenação base GARANTE trazer TODOS os docs.
  // Depois ordenamos por nome ou data em memória (o cliente já filtra/local anyway).
  const q = storeId
    ? query(colRef, where('storeId','==',storeId), orderBy('__name__', 'desc'), limit(5000))
    : query(colRef, orderBy('__name__', 'desc'), limit(5000))
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

// Retorna contagem TOTAL de CLIENTES ATIVOS (0 reads cobrados, são só metadados via getCountFromServer)
// Usado para a estratégia Smart Cache: só baixa inativos se o usuário realmente pedir via filtro.
// CORREÇÃO CRÍTICA (clientes antigos SEM campo 'active' → são CONSIDERADOS ATIVOS por padrão,
// pois 99% dos docs do usuário não tem o campo gravado. A query where('active','==',true) IGNORA
// completamente docs undefined → voltava só 120/22859 ativos. Não há query Firestore para
// "active != false" incluindo undefined, então CONTAMOS TODOS (já que só marcados explicitamente
// active=false são inativos; o restante (undefined/true) são ativos por regra de negócio).
export async function getTotalActiveClientsCount(storeId) {
  const q = query(colRef, where('storeId', '==', storeId))
  const snap = await getCountFromServer(q)
  return snap.data().count
}

// Retorna APENAS CLIENTES ATIVOS (paginação cursor 1k em 1k)
// ESTRATÉGIA Smart Cache de clientes: primeiro carregamento baixa SÓ ativos
// (economiza leituras de inativos que o usuário quase nunca consulta).
// Inativos SÓ são baixados se o usuário clicar em Filtros e mudar status para Inativo/Todos.
//
// CORREÇÃO CRÍTICA (igual a contagem): não usamos where('active','==',true).
//   Motivo: 99% dos clientes ANTIGOS NÃO TEM o campo 'active' gravado no Firestore (undefined).
//   Firestore IGNORA COMPLETAMENTE esses docs em queries com where('active','==',true).
//   Resultado: de 22.859 clientes, só voltavam ~120 que realmente tem active=true no doc.
//   SOLUÇÃO: baixamos TODOS (igual getAllClients, cursor 1k em 1k com orderBy(__name__))
//   e FILTRAMOS LOCALMENTE removendo APENAS os que tem active === false (explicitamente marcados).
//   Clientes com active undefined/null são CONSIDERADOS ATIVOS (padrão default).
export async function getActiveClients(storeId) {
  const PAGE_SIZE = 1000
  const all = []
  let lastDoc = null
  let page = 0
  console.log(`[getActiveClients] Iniciando paginação (loja ${storeId}, ordem __name__ DESC, ${PAGE_SIZE}/página).`)
  console.log(`[getActiveClients] Filtrando LOCALMENTE: remove active===false. Undefined/null = ATIVO (padrão).`)
  while (true) {
    page++
    let q
    if (!lastDoc) {
      q = query(
        colRef,
        where('storeId', '==', storeId),
        orderBy('__name__', 'desc'),
        limit(PAGE_SIZE)
      )
    } else {
      q = query(
        colRef,
        where('storeId', '==', storeId),
        orderBy('__name__', 'desc'),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      )
    }
    const snap = await getDocs(q)
    if (snap.empty) {
      console.log(`[getActiveClients] Pg ${page}: VAZIA. Total bruto=${all.length}`)
      break
    }
    const docs = snap.docs
    for (let i = 0; i < docs.length; i++) all.push({ id: docs[i].id, ...docs[i].data() })
    console.log(`[getActiveClients] Pg ${page}: +${docs.length} total bruto=${all.length}`)
    lastDoc = docs[docs.length - 1]
    if (docs.length < PAGE_SIZE) break
    if (page >= 100) { console.warn(`[getActiveClients] Limite 100 pág ${all.length}.`); break }
  }
  const activeOnly = all.filter(c => c.active !== false)
  console.log(`[getActiveClients] Concluído: ${all.length} bruto → ${activeOnly.length} ATIVOS (filtrado active!==false) em ${page} página(s).`)
  return activeOnly
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

export async function getClientsByPage(storeId, page, pageSize) {
  // CORREÇÃO CRÍTICA: orderBy('__name__') (ID do documento) ao invés de orderBy('createdAt')
  // Motivo: clientes antigos (99% dos 22k) NÃO TEM o campo createdAt (null), e o Firestore
  // SIMPLESMENTE IGNORA esses docs em queries com orderBy. Resultado: só 82 clientes voltavam.
  // 'orderBy(__name__)' existe SEMPRE em TODO documento, não tem exceção → retorna 100% dos docs.
  let q = query(colRef, where('storeId', '==', storeId), orderBy('__name__', 'desc'))
  
  // Se página 1, é simples
  if (page <= 1) {
    q = query(q, limit(pageSize))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }

  const targetIndex = (page - 1) * pageSize
  const qBig = query(colRef, where('storeId', '==', storeId), orderBy('__name__', 'desc'), limit(targetIndex + pageSize))
  const snap = await getDocs(qBig)
  const allDocs = snap.docs
  const pageDocs = allDocs.slice(targetIndex, targetIndex + pageSize)
  console.log(`[getClientsByPage] page=${page}, pageSize=${pageSize}, allDocs=${allDocs.length}, retornados=${pageDocs.length} (orderBy __name__)`)
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
    active: client.active === false ? false : true,
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
    // CORREÇÃO: 'active' SEMPRE gravado como boolean (nunca undefined).
    // Se o cliente antigo não tem o campo (undefined), default = true (considerado ativo).
    const finalPartial = { ...partial }
    if ('active' in finalPartial) {
      finalPartial.active = finalPartial.active === false ? false : true
    }
    normalized = {
      nameLower: normalize(merged.name),
      codeLower: normalize(merged.code),
      phoneDigits: digits(merged.phone),
      whatsappDigits: digits(merged.whatsapp),
      cpfDigits: digits(merged.cpf),
      cnpjDigits: digits(merged.cnpj),
    }
    await updateDoc(ref, { ...finalPartial, ...normalized, updatedAt: serverTimestamp() })
  } catch {
    const finalPartial = { ...partial, updatedAt: serverTimestamp() }
    if ('active' in finalPartial) finalPartial.active = finalPartial.active === false ? false : true
    await updateDoc(ref, finalPartial)
  }
  const finalOut = { ...partial, ...normalized, updatedAt: new Date() }
  if ('active' in finalOut) finalOut.active = finalOut.active === false ? false : true
  return finalOut
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

// Retorna TODOS os clientes de uma loja (para Smart Cache)
// CORREÇÃO: usa PAGINAÇÃO POR CURSOR de 1000 em 1000 para não cair no limite
// implícito do Firestore.
// CORREÇÃO CRÍTICA 2: orderBy('__name__') (ID do doc) NÃO orderBy('createdAt')
//   Motivo: 99% dos clientes antigos NÃO TEM o campo createdAt (null).
//   O Firestore IGNORA COMPLETAMENTE documentos que não possuem o campo do orderBy
//   (não retorna nem no final como null). Resultado: de 22k clientes, 82 voltavam.
//   __name__ = ID do documento → SEMPRE existe, SEMPRE não nulo → 22k completos.
export async function getAllClients(storeId) {
  const PAGE_SIZE = 1000
  const all = []
  let lastDoc = null
  let page = 0
  console.log(`[getAllClients] Iniciando paginação de clientes da loja ${storeId} (ordem por __name__ DESC, ${PAGE_SIZE} docs por página)`)
  while (true) {
    page++
    let q
    if (!lastDoc) {
      q = query(
        colRef,
        where('storeId', '==', storeId),
        orderBy('__name__', 'desc'),
        limit(PAGE_SIZE)
      )
    } else {
      q = query(
        colRef,
        where('storeId', '==', storeId),
        orderBy('__name__', 'desc'),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      )
    }
    const snap = await getDocs(q)
    if (snap.empty) {
      console.log(`[getAllClients] Página ${page}: VAZIA. Finalizando. Total=${all.length}`)
      break
    }
    const docs = snap.docs
    for (let i = 0; i < docs.length; i++) {
      const d = docs[i]
      all.push({ id: d.id, ...d.data() })
    }
    console.log(`[getAllClients] Página ${page}: +${docs.length} docs. Total acumulado=${all.length}`)
    lastDoc = docs[docs.length - 1]
    if (docs.length < PAGE_SIZE) break
    // Segurança extra: evita loop infinito (teórico), max 100 páginas = 100k clientes
    if (page >= 100) {
      console.warn(`[getAllClients] Atingiu limite de 100 páginas (${all.length} clientes). Interrompendo paginação.`)
      break
    }
  }
  console.log(`[getAllClients] Concluído: ${all.length} clientes carregados em ${page} página(s).`)
  return all
}
