import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where, getDocs, limit, startAfter, endAt, startAt, getDoc, getCountFromServer, deleteDoc, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { getStoreById, listStoresByOwner } from './stores'

const colRef = collection(db, 'clients')

function normalize(val) {
  return String(val || '').trim().toLowerCase()
}
function digits(val) {
  return String(val || '').replace(/\D/g, '')
}

// ============================================================
// SINCRONIZAÇÃO CLIENTES ENTRE LOJAS DO MESMO DONO
// ============================================================
// Chave determinística para identificar a MESMA PESSOA entre lojas diferentes.
// Baseada em CPF/CNPJ (melhor), depois WhatsApp/telefone (2º melhor), depois nome.
// SEMPRE igual para a mesma pessoa, nunca aleatória → não cria duplicatas.
export function buildOwnerClientKey(clientData) {
  const c = clientData || {}
  const cpf = digits(c.cpf)
  const cnpj = digits(c.cnpj)
  const wa = digits(c.whatsapp)
  const ph = digits(c.phone)
  const nm = normalize(c.name)
  // Prioridade: documento > whatsapp > telefone > nome
  const parts = [
    cpf || cnpj || '',
    wa || ph || '',
    !cpf && !cnpj && !wa && !ph ? nm : '',
  ].filter(Boolean)
  if (parts.length === 0) return ''
  return `cli:${parts.join('|')}`
}

// Deduplicação em outra loja: existe cliente com MESMO ownerClientKey OU MESMO CPF/WhatsApp igual?
async function findExistingClientInStore({ storeId, ownerId, ownerClientKey, cpf, cnpj, whatsapp, phone }) {
  if (!storeId) return null
  const cpfD = digits(cpf)
  const cnpjD = digits(cnpj)
  const waD = digits(whatsapp)
  const phD = digits(phone)

  const hasOwnerKey = ownerClientKey && ownerId
  if (hasOwnerKey) {
    // Primeiro: procura exato por ownerId + ownerClientKey (match garantido)
    try {
      const q1 = query(
        colRef,
        where('ownerId', '==', ownerId),
        where('ownerClientKey', '==', ownerClientKey),
        where('storeId', '==', storeId),
        limit(1)
      )
      const snap1 = await getDocs(q1)
      if (!snap1.empty) return { id: snap1.docs[0].id, ...snap1.docs[0].data() }
    } catch {
      // índice composto não existe ainda — fallback para queries individuais
    }
  }

  // Fallback: procura por CPF/CNPJ/WhatsApp individualmente (queries já existem sem índice)
  const ors = []
  if (cpfD) ors.push({ field: 'cpfDigits', value: cpfD })
  if (cnpjD) ors.push({ field: 'cnpjDigits', value: cnpjD })
  if (waD) ors.push({ field: 'whatsappDigits', value: waD })
  if (phD) ors.push({ field: 'phoneDigits', value: phD })

  for (const c of ors) {
    try {
      const q = query(colRef, where('storeId', '==', storeId), where(c.field, '==', c.value), limit(1))
      const snap = await getDocs(q)
      if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() }
    } catch { /* continue */ }
  }
  return null
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

export async function addClient(client, storeId, opts = {}){
  if (!storeId) throw new Error('storeId é obrigatório ao criar cliente')
  // Resolve ownerId: pode ser passado via opts.ownerId ou buscar na loja
  let ownerId = opts.ownerId || client.ownerId || ''
  if (!ownerId) {
    try {
      const store = await getStoreById(storeId)
      ownerId = store?.ownerId || ''
    } catch {}
  }
  const ownerClientKey = buildOwnerClientKey(client)

  const data = {
    storeId,
    ownerId: ownerId || '',
    ownerClientKey: ownerClientKey || '',
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
  const createdClient = { id: res.id, ...data, createdAt: new Date(), updatedAt: new Date() }

  // ----------------------------------------------------------
  // AUTO-SYNC: espelha cliente nas outras lojas do MESMO DONO
  // (background sem await no caller — retorna void Promise)
  // ----------------------------------------------------------
  if (ownerId && opts.autoSync !== false) {
    // Fire-and-forget: não bloqueia fluxo de criação do cliente
    syncClientToOwnerStores(createdClient, storeId, ownerId, { isNew: true }).catch(() => {})
  }
  return createdClient
}

// ============================================================
// SINCRONIZA 1 CLIENTE INDIVIDUAL -> OUTRAS LOJAS DO DONO
// (usa ownerId + ownerClientKey para não duplicar / conflitar IDs)
// Retorna: { copied: 0, skipped: 0, targetStores: [...] }
// ============================================================
export async function syncClientToOwnerStores(client, currentStoreId, ownerId, opts = {}) {
  if (!client || !ownerId) return { copied: 0, skipped: 0, targetStores: [] }
  const ownerKey = client.ownerClientKey || buildOwnerClientKey(client)
  const stores = await listStoresByOwner(ownerId).catch(() => [])
  const otherStores = stores.filter(s => String(s.id) !== String(currentStoreId))
  if (otherStores.length === 0) return { copied: 0, skipped: 0, targetStores: [] }

  let copied = 0
  let skipped = 0

  for (const other of otherStores) {
    // Verifica se já existe cliente com mesmo ownerClientKey/CPF/WhatsApp na outra loja
    // (não copia 2x — evita conflito e duplicação)
    const existing = await findExistingClientInStore({
      storeId: other.id,
      ownerId,
      ownerClientKey: ownerKey,
      cpf: client.cpf,
      cnpj: client.cnpj,
      whatsapp: client.whatsapp,
      phone: client.phone,
    })
    if (existing) { skipped++; continue }

    try {
      // Cria novo documento com PRÓPRIO ID (addDoc gera aleatório novo) — NÃO conflita com o master.
      // Os 2 documentos compartilham o MESMO ownerId + ownerClientKey.
      const nextCode = opts.isNew ? (client.code || '') : client.code
      const copyData = {
        storeId: other.id,
        ownerId,
        ownerClientKey: ownerKey,
        name: client.name ?? 'Novo Cliente',
        whatsapp: client.whatsapp ?? '',
        phone: client.phone ?? '',
        cpf: client.cpf ?? '',
        cnpj: client.cnpj ?? '',
        allowCredit: !!client.allowCredit,
        isCompany: !!client.isCompany,
        cep: client.cep ?? '',
        address: client.address ?? '',
        number: client.number ?? '',
        complement: client.complement ?? '',
        neighborhood: client.neighborhood ?? '',
        city: client.city ?? '',
        state: client.state ?? '',
        email: client.email ?? '',
        notes: client.notes ?? '',
        code: nextCode,
        identity: client.identity ?? '',
        stateRegistrationIndicator: client.stateRegistrationIndicator ?? '',
        motherName: client.motherName ?? '',
        birthDate: client.birthDate ?? '',
        active: client.active === false ? false : true,
        createdBy: client.createdBy || '',
        lastEditedBy: client.lastEditedBy || '',
        syncedFromStoreId: String(currentStoreId || ''),
        syncedFromClientId: String(client.id || ''),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      copyData.nameLower = normalize(copyData.name)
      copyData.codeLower = normalize(copyData.code)
      copyData.phoneDigits = digits(copyData.phone)
      copyData.whatsappDigits = digits(copyData.whatsapp)
      copyData.cpfDigits = digits(copyData.cpf)
      copyData.cnpjDigits = digits(copyData.cnpj)
      await addDoc(colRef, copyData)
      copied++
    } catch { skipped++ }
  }
  return { copied, skipped, targetStores: otherStores.map(s => s.id) }
}

// ============================================================
// SINCRONIZAÇÃO EM LOTE (botão Opções -> Sincronizar Clientes)
// Percorre TODOS os clientes da loja atual e replica nas outras do mesmo dono
// onProgress({ step, total, copied, skipped, currentClientName })
// Retorna: { total, copied, skipped, errors }
// ============================================================
export async function bulkSyncAllClientsToOwnerStores(currentStoreId, onProgress) {
  if (!currentStoreId) return { total: 0, copied: 0, skipped: 0, errors: 0 }

  // 1. Resolve ownerId
  let ownerId = ''
  try {
    const store = await getStoreById(currentStoreId)
    ownerId = store?.ownerId || ''
  } catch {}
  if (!ownerId) return { total: 0, copied: 0, skipped: 0, errors: 0, noOwner: true }

  // 2. Outras lojas do mesmo dono
  const allStores = await listStoresByOwner(ownerId).catch(() => [])
  const otherStores = allStores.filter(s => String(s.id) !== String(currentStoreId))
  if (otherStores.length === 0) return { total: 0, copied: 0, skipped: 0, errors: 0, noOtherStores: true }

  // 3. Carrega TODOS clientes da loja atual
  const allCurrentClients = await getAllClients(currentStoreId).catch(() => [])
  const total = allCurrentClients.length
  let copied = 0, skipped = 0, errors = 0

  // 4. Processa em lotes de 50 (writeBatch + pausas para não estourar limites Firestore)
  const BATCH_SIZE = 50
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = allCurrentClients.slice(i, i + BATCH_SIZE)
    for (let j = 0; j < batch.length; j++) {
      const cli = batch[j]
      const globalIdx = i + j + 1
      onProgress && onProgress({
        step: globalIdx,
        total,
        copied,
        skipped,
        errors,
        currentClientName: cli.name || 'Cliente',
      })
      try {
        // Para cada outra loja: verifica duplicata, cria cópia se faltar
        for (const other of otherStores) {
          const ownerKey = cli.ownerClientKey || buildOwnerClientKey(cli)
          const existing = await findExistingClientInStore({
            storeId: other.id,
            ownerId,
            ownerClientKey: ownerKey,
            cpf: cli.cpf,
            cnpj: cli.cnpj,
            whatsapp: cli.whatsapp,
            phone: cli.phone,
          })
          if (existing) { skipped++; continue }
          try {
            const copyData = {
              storeId: other.id,
              ownerId,
              ownerClientKey: ownerKey,
              name: cli.name ?? 'Novo Cliente',
              whatsapp: cli.whatsapp ?? '',
              phone: cli.phone ?? '',
              cpf: cli.cpf ?? '',
              cnpj: cli.cnpj ?? '',
              allowCredit: !!cli.allowCredit,
              isCompany: !!cli.isCompany,
              cep: cli.cep ?? '',
              address: cli.address ?? '',
              number: cli.number ?? '',
              complement: cli.complement ?? '',
              neighborhood: cli.neighborhood ?? '',
              city: cli.city ?? '',
              state: cli.state ?? '',
              email: cli.email ?? '',
              notes: cli.notes ?? '',
              code: cli.code || '',
              identity: cli.identity ?? '',
              stateRegistrationIndicator: cli.stateRegistrationIndicator ?? '',
              motherName: cli.motherName ?? '',
              birthDate: cli.birthDate ?? '',
              active: cli.active === false ? false : true,
              createdBy: cli.createdBy || '',
              lastEditedBy: cli.lastEditedBy || '',
              syncedFromStoreId: String(currentStoreId || ''),
              syncedFromClientId: String(cli.id || ''),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }
            copyData.nameLower = normalize(copyData.name)
            copyData.codeLower = normalize(copyData.code)
            copyData.phoneDigits = digits(copyData.phone)
            copyData.whatsappDigits = digits(copyData.whatsapp)
            copyData.cpfDigits = digits(copyData.cpf)
            copyData.cnpjDigits = digits(copyData.cnpj)
            await addDoc(colRef, copyData)
            copied++
          } catch { errors++ }
        }
      } catch { errors++ }
    }
    // pausa 30ms entre lotes para não saturar
    await new Promise(r => setTimeout(r, 30))
  }
  onProgress && onProgress({ step: total, total, copied, skipped, errors, done: true })
  return { total, copied, skipped, errors, otherStoresCount: otherStores.length }
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
