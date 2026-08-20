import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where, deleteDoc, getDocs, getCountFromServer, limit, startAt, endAt, startAfter, getDoc, runTransaction } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { getStoreById, listStoresByOwner } from './stores'

const colRef = collection(db, 'products')

export function listenProducts(callback, storeId){
  // CORREÇÃO CRÍTICA (igual clientes): orderBy('__name__') (ID do documento) NÃO orderBy('createdAt')
  // Motivo: produtos antigos NÃO TEM createdAt → orderBy(createdAt) IGNORA eles completamente!
  // __name__ sempre existe → retorna 100% dos docs da loja
  const q = storeId 
    ? query(colRef, where('storeId','==',storeId), orderBy('__name__', 'desc'), limit(50))
    : query(colRef, orderBy('__name__', 'desc'), limit(50))
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
    callback(items)
  }, (err) => {
    console.error('listenProducts error', err)
  })
}

export function listenCatalogProducts(callback, storeId){
  if (!storeId) return () => {}
  // Removido o filtro where('showInCatalog','==', true) e o limite
  // para garantir que TODOS os produtos da loja sejam carregados e filtrados no cliente.
  // Isso resolve problemas onde produtos novos ou específicos ficavam fora do limite inicial.
  const q = query(
    colRef, 
    where('storeId', '==', storeId)
  )
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p.showInCatalog === true) // Filtro no cliente para garantir exibição
    callback(items)
  }, (err) => {
    console.error('listenCatalogProducts error', err)
  })
}

export async function getTotalProductsCount(storeId) {
  const q = query(colRef, where('storeId', '==', storeId))
  const snap = await getCountFromServer(q)
  return snap.data().count
}

// Retorna contagem TOTAL de PRODUTOS ATIVOS (0 reads cobrados — só metadados getCountFromServer)
// CORREÇÃO CRÍTICA (igual clientes): 99% dos produtos ANTIGOS não tem o campo 'active' gravado.
// Firestore IGNORA COMPLETAMENTE docs undefined em where('active','==',true).
// Portanto, consideramos TODOS os produtos (menos active===false) como ativos.
export async function getTotalActiveProductsCount(storeId) {
  const q = query(colRef, where('storeId', '==', storeId))
  const snap = await getCountFromServer(q)
  return snap.data().count
}

// Retorna APENAS PRODUTOS ATIVOS (paginação cursor 1k em 1k)
// ESTRATÉGIA SMART CACHE: primeiro carregamento SÓ ativos (economiza inativos).
// Inativos SÓ baixados se o usuário abrir filtros e marcar filterInactive=true.
//
// CORREÇÃO CRÍTICA (igual clientes): não usamos where('active','==',true).
//   Motivo: 99% dos produtos ANTIGOS não tem o campo active (undefined) → Firestore os IGNORA.
//   SOLUÇÃO: baixamos TUDO (cursor 1k/pg orderBy __name__) e FILTRAMOS LOCALMENTE
//   removendo apenas active===false. Undefined/null = CONSIDERADO ATIVO (padrão default).
export async function getActiveProducts(storeId) {
  const PAGE_SIZE = 1000
  const all = []
  let lastDoc = null
  let page = 0
  console.log(`[getActiveProducts] Iniciando paginação produtos loja ${storeId} (ordem __name__ DESC, ${PAGE_SIZE}/página).`)
  console.log(`[getActiveProducts] Filtrando LOCALMENTE: remove active===false. Undefined/null = ATIVO.`)
  try {
    while (true) {
      page++
      let q
      if (!lastDoc) {
        q = query(colRef, where('storeId', '==', storeId), orderBy('__name__', 'desc'), limit(PAGE_SIZE))
      } else {
        q = query(colRef, where('storeId', '==', storeId), orderBy('__name__', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE))
      }
      const snap = await getDocs(q)
      if (snap.empty) {
        console.log(`[getActiveProducts] Pg ${page}: VAZIA. Total bruto=${all.length}`)
        break
      }
      snap.docs.forEach(d => all.push({ id: d.id, ...d.data() }))
      console.log(`[getActiveProducts] Pg ${page}: +${snap.docs.length} total bruto=${all.length}`)
      if (snap.docs.length < PAGE_SIZE) break
      lastDoc = snap.docs[snap.docs.length - 1]
      if (page >= 100) {
        console.warn(`[getActiveProducts] Limite 100 pág (${all.length}). Parando.`)
        break
      }
    }
  } catch (err) {
    console.error('Erro em getActiveProducts:', err)
  }
  const activeOnly = all.filter(p => p.active !== false)
  console.log(`[getActiveProducts] Concluído: ${all.length} bruto → ${activeOnly.length} ATIVOS em ${page} página(s).`)
  return activeOnly
}

// Retorna TODOS os produtos da loja com PAGINAÇÃO POR CURSOR de 1000 em 1000
// (evita limite implícito do firestore 81/500 docs)
// CORREÇÃO CRÍTICA: orderBy('__name__') SEMPRE → produtos SEM createdAt não são ignorados.
export async function getAllProducts(storeId) {
  const PAGE_SIZE = 1000
  const all = []
  let lastDoc = null
  let page = 0
  console.log(`[getAllProducts] Iniciando paginação produtos loja ${storeId} (ordem __name__ DESC, ${PAGE_SIZE}/página)`)
  try {
    while (true) {
      page++
      let q
      if (!lastDoc) {
        q = query(colRef, where('storeId', '==', storeId), orderBy('__name__', 'desc'), limit(PAGE_SIZE))
      } else {
        q = query(colRef, where('storeId', '==', storeId), orderBy('__name__', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE))
      }
      const snap = await getDocs(q)
      if (snap.empty) {
        console.log(`[getAllProducts] Página ${page}: VAZIA. Finalizando. Total=${all.length}`)
        break
      }
      snap.docs.forEach(d => all.push({ id: d.id, ...d.data() }))
      console.log(`[getAllProducts] Pg ${page}: +${snap.docs.length} total=${all.length}`)
      if (snap.docs.length < PAGE_SIZE) break
      lastDoc = snap.docs[snap.docs.length - 1]
      if (page >= 100) {
        console.warn(`[getAllProducts] Limite 100 páginas (${all.length} produtos). Parando.`)
        break
      }
    }
  } catch (err) {
    console.error('Erro em getAllProducts:', err)
  }
  console.log(`[getAllProducts] Concluído: ${all.length} produtos em ${page} página(s).`)
  return all
}

export async function getProductsByPage(storeId, page, pageSize) {
  // CORREÇÃO: orderBy('__name__') não createdAt (garante 100% docs, sem ignorar velhos)
  const targetIndex = (page - 1) * pageSize
  const qBig = query(colRef, where('storeId', '==', storeId), orderBy('__name__', 'desc'), limit(targetIndex + pageSize))
  const snap = await getDocs(qBig)
  const allDocs = snap.docs
  const pageDocs = allDocs.slice(targetIndex, targetIndex + pageSize)
  console.log(`[getProductsByPage] p=${page} sz=${pageSize} all=${allDocs.length} retornados=${pageDocs.length} (orderBy __name__)`)
  return pageDocs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getProductById(id) {
  const ref = doc(db, 'products', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

export async function searchProductsByPage(storeId, searchTerm, page, pageSize) {
  const term = searchTerm.trim()
  if (!term) return { products: [], total: 0 }
  
  const lower = term.toLowerCase()
  const isNumeric = /^\d+$/.test(term)
  
  try {
    let total = 0
    let qCount
    
    if (isNumeric) {
      qCount = query(
        colRef,
        where('storeId', '==', storeId),
        where('barcode', '>=', term),
        where('barcode', '<=', term + '\uf8ff')
      )
    } else {
      // Tenta busca pelo nameLower
      // IMPORTANTE: Isso exige índice composto (storeId, nameLower). 
      // Se falhar (catch), tentaremos um fallback mais simples.
      qCount = query(
        colRef,
        where('storeId', '==', storeId),
        orderBy('nameLower'),
        startAt(lower),
        endAt(lower + '\uf8ff')
      )
    }

    const snapCount = await getCountFromServer(qCount)
    total = snapCount.data().count
    
    const targetIndex = (page - 1) * pageSize
    let qData = query(qCount, limit(targetIndex + pageSize))
    
    const snap = await getDocs(qData)
    const allDocs = snap.docs
    const pageDocs = allDocs.slice(targetIndex, targetIndex + pageSize)
    const products = pageDocs.map(d => ({ id: d.id, ...d.data() }))
    
    return { products, total }
  } catch (err) {
    console.error('Erro na busca servidor (provável falta de índice):', err)
    // Fallback: Retorna vazio para forçar o uso do Smart Cache no frontend
    // sem travar a interface com erro de índice do Firestore.
    return { products: [], total: 0 }
  }
}

// Helper para garantir nameLower em novos produtos/atualizações
function normalizeProductData(product) {
  return {
    ...product,
    nameLower: (product.name || '').toLowerCase()
  }
}

export async function addProduct(product, storeId){
  if (!storeId) throw new Error('storeId é obrigatório ao criar produto')
  const baseData = {
    // Identificação da loja
    storeId,

    // Básico
    name: product.name ?? 'Novo Produto',
    nameLower: (product.name ?? 'Novo Produto').toLowerCase(),
    active: product.active === false ? false : true,

    // Classificação
    categoryId: product.categoryId ?? null,
    supplier: product.supplier ?? '',

    // Preço e estoque
    cost: product.cost ?? 0,
    salePrice: product.salePrice ?? 0,
    promoPrice: product.promoPrice ?? null,
    priceMin: product.priceMin ?? product.promoPrice ?? product.salePrice ?? 0,
    priceMax: product.priceMax ?? product.salePrice ?? 0,
    barcode: product.barcode ?? '',
    reference: product.reference ?? '',
    validityDate: product.validityDate ?? null, // yyyy-mm-dd

    controlStock: product.controlStock ?? true,
    stockInitial: product.stockInitial ?? 0,
    stockMin: product.stockMin ?? 0,
    stock: product.stock ?? product.stockInitial ?? 0,

    showInCatalog: product.showInCatalog ?? false,
    featured: product.featured ?? false,

    // Variações
    variations: product.variations ?? 0, // manter compatível com listagem
    variationsData: product.variationsData ?? [],

    // Dados adicionais
    description: product.description ?? '',
    commissionPercent: product.commissionPercent ?? 0,
    unit: product.unit ?? 'Unidade',
    allowFraction: product.allowFraction ?? false,
    notes: product.notes ?? '',
    mlQuery: product.mlQuery ?? '',

    // Dados fiscais
    origin: product.origin ?? '',
    ncm: product.ncm ?? '',
    cest: product.cest ?? '',

    // Smartphone
    isSmartphone: !!product.isSmartphone,
    phoneBrand: product.phoneBrand ?? '',
    phoneColor: product.phoneColor ?? '',
    imei1: product.imei1 ?? '',
    imei2: product.imei2 ?? '',
    serialNumber: product.serialNumber ?? '',
    condition: product.condition ?? '',
    warrantyMonths: product.warrantyMonths ?? null,

    // Sincronização
    rootId: product.rootId ?? crypto.randomUUID(),

    // Mídia (desabilitado por enquanto)
    imageUrl: product.imageUrl ?? null,

    createdBy: product.createdBy ?? '',
    lastEditedBy: product.lastEditedBy ?? '',

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const res = await addDoc(colRef, baseData)
  return { id: res.id, ...baseData, createdAt: new Date(), updatedAt: new Date() }
}

export async function updateProduct(id, partial){
  const ref = doc(db, 'products', id)
  const data = { ...partial, updatedAt: serverTimestamp() }
  if (partial.name) {
    data.nameLower = partial.name.toLowerCase()
  }
  // CORREÇÃO: active SEMPRE gravado como boolean (nunca undefined/null)
  if ('active' in data) {
    data.active = data.active === false ? false : true
  }
  await updateDoc(ref, data)
  const out = { ...data, updatedAt: new Date() }
  if ('active' in out) out.active = out.active === false ? false : true
  return out
}

export async function removeProduct(id){
  const ref = doc(db, 'products', id)
  await deleteDoc(ref)
}

function buildUnifiedVariationsForTarget(targetProduct, sourceProduct, partial = {}) {
  const targetVariations = Array.isArray(targetProduct?.variationsData) ? targetProduct.variationsData : []
  const sourceVariations = Array.isArray(sourceProduct?.variationsData) ? sourceProduct.variationsData : []
  const baseVariations = targetVariations.length > 0 ? targetVariations : sourceVariations

  if (baseVariations.length === 0) {
    return partial.variationsData
  }

  const fallbackStock = partial.stock !== undefined
    ? Number(partial.stock ?? 0)
    : Number(sourceProduct?.stock ?? targetProduct?.stock ?? 0)

  const fallbackStockInitial = partial.stockInitial !== undefined
    ? Number(partial.stockInitial ?? 0)
    : undefined

  const fallbackStockMin = partial.stockMin !== undefined
    ? Number(partial.stockMin ?? 0)
    : undefined

  return baseVariations.map((variation, index) => {
    const sourceVariation = sourceVariations[index] || sourceVariations.find(v => v?.name === variation?.name) || {}
    const nextVariation = { ...variation }

    nextVariation.stock = Number(sourceVariation?.stock ?? fallbackStock ?? 0)

    if (fallbackStockInitial !== undefined || sourceVariation?.stockInitial !== undefined) {
      nextVariation.stockInitial = Number(sourceVariation?.stockInitial ?? fallbackStockInitial ?? 0)
    }

    if (fallbackStockMin !== undefined || sourceVariation?.stockMin !== undefined) {
      nextVariation.stockMin = Number(sourceVariation?.stockMin ?? fallbackStockMin ?? 0)
    }

    return nextVariation
  })
}

export function findEquivalentProductInList(sourceProduct, candidateProducts = [], excludedProductId = null) {
  const candidates = Array.isArray(candidateProducts) ? candidateProducts : []
  const activeRootId = String(sourceProduct?.rootId || '').trim()
  if (activeRootId) {
    const matchByRoot = candidates.find(product => product?.id !== excludedProductId && String(product?.rootId || '').trim() === activeRootId)
    if (matchByRoot) return matchByRoot
  }

  const reference = String(sourceProduct?.reference || '').trim()
  if (reference) {
    const matchByReference = candidates.find(product => product?.id !== excludedProductId && String(product?.reference || '').trim() === reference)
    if (matchByReference) return matchByReference
  }

  const name = String(sourceProduct?.name || '').trim()
  if (name) {
    const matchByName = candidates.find(product => product?.id !== excludedProductId && String(product?.name || '').trim() === name)
    if (matchByName) return matchByName
  }

  return null
}

async function findMatchingProductInStore(storeId, { rootId, reference, name }, excludedProductId = null) {
  if (!storeId) return null

  if (rootId) {
    const qRoot = query(colRef, where('storeId', '==', storeId), where('rootId', '==', rootId))
    const snapRoot = await getDocs(qRoot)
    const match = snapRoot.docs.find(d => d.id !== excludedProductId)
    if (match) return { id: match.id, ...match.data() }
  }

  const trimmedReference = String(reference || '').trim()
  if (trimmedReference) {
    const qRef = query(colRef, where('storeId', '==', storeId), where('reference', '==', trimmedReference))
    const snapRef = await getDocs(qRef)
    const match = snapRef.docs.find(d => d.id !== excludedProductId)
    if (match) return { id: match.id, ...match.data() }
  }

  const trimmedName = String(name || '').trim()
  if (trimmedName) {
    const qName = query(colRef, where('storeId', '==', storeId), where('name', '==', trimmedName))
    const snapName = await getDocs(qName)
    const match = snapName.docs.find(d => d.id !== excludedProductId)
    if (match) return { id: match.id, ...match.data() }
  }

  return null
}

export async function syncUnifiedStockAcrossStores(sourceProduct, storeId, partial = {}) {
  if (!sourceProduct?.id || !storeId) return { synced: false, updatedStores: 0 }

  const currentStore = await getStoreById(storeId)
  if (!currentStore?.ownerId || !currentStore?.syncStockTogether) {
    return { synced: false, updatedStores: 0 }
  }

  let activeRootId = sourceProduct.rootId
  if (!activeRootId) {
    activeRootId = crypto.randomUUID()
    await updateProduct(sourceProduct.id, { rootId: activeRootId })
  }

  const allStores = await listStoresByOwner(currentStore.ownerId)
  const otherStores = allStores.filter(store => store.id !== storeId)
  if (otherStores.length === 0) {
    return { synced: false, updatedStores: 0 }
  }

  const sourceWithRootId = { ...sourceProduct, ...partial, rootId: activeRootId }
  let updatedStores = 0

  for (const store of otherStores) {
    const targetProduct = await findMatchingProductInStore(store.id, {
      rootId: activeRootId,
      reference: sourceProduct.reference,
      name: sourceProduct.name
    }, sourceProduct.id)

    if (!targetProduct) continue

    const syncPayload = { rootId: activeRootId }

    if (partial.stock !== undefined) {
      syncPayload.stock = Number(partial.stock ?? 0)
    }
    if (partial.stockInitial !== undefined) {
      syncPayload.stockInitial = Number(partial.stockInitial ?? 0)
    }
    if (partial.stockMin !== undefined) {
      syncPayload.stockMin = Number(partial.stockMin ?? 0)
    }

    if (partial.variationsData !== undefined || Array.isArray(targetProduct?.variationsData)) {
      syncPayload.variationsData = buildUnifiedVariationsForTarget(targetProduct, sourceWithRootId, partial)
    }

    await updateProduct(targetProduct.id, syncPayload)
    updatedStores += 1
  }

  return { synced: updatedStores > 0, updatedStores }
}

export async function getAvailableProductReference(storeId, desiredReference, excludedProductId = null) {
  const baseReference = String(desiredReference || '').trim()
  if (!storeId || !baseReference) return baseReference

  const allProducts = await getAllProducts(storeId)
  const existingReferences = new Set(
    allProducts
      .filter(product => product.id !== excludedProductId)
      .map(product => String(product.reference || '').trim())
      .filter(Boolean)
  )

  if (!existingReferences.has(baseReference)) {
    return baseReference
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  for (let round = 0; round < 100; round += 1) {
    for (const letter of alphabet) {
      const prefix = round === 0 ? letter : `${letter}${round}`
      const candidate = `${prefix}${baseReference}`
      if (!existingReferences.has(candidate)) {
        return candidate
      }
    }
  }

  return `${Date.now()}${baseReference}`
}

export async function getNextProductReference(storeId) {
  try {
    const q = query(colRef, where('storeId', '==', storeId))
    const snapshot = await getDocs(q)
    
    if (snapshot.empty) return '1'

    let maxRef = 0

    snapshot.docs.forEach(doc => {
      const data = doc.data()
      if (data.reference) {
        const num = parseInt(data.reference, 10)
        if (!isNaN(num) && num > maxRef) {
          maxRef = num
        }
      }
    })

    return (maxRef + 1).toString()
  } catch (error) {
    console.error("Error getting next reference:", error)
    return '1'
  }
}

// ======================================================================
// 💠 FUNÇÃO CENTRAL DE AJUSTE DE ESTOQUE (SEM RACE CONDITION!)
// ======================================================================
//
// Problema anterior: NewSaleModal, ServiceOrdersPage e SaleDetailModal
// faziam:
//   const cur = Number(realProduct.stock || 0)   ← VALOR DE CACHE LOCAL
//   await updateProduct(pId, { stock: cur - qty }) ← SEM TRANSACTION
// Resultado: 2 usuários ao mesmo tempo vendendo produto com stock=10
//            → AMBOS gravam stock=5 → FICA 5, deveria ser 0.
//            Perda de estoque / overselling.
//
// Solução (abaixo): usa runTransaction nativo do Firestore (atomicidade,
// lock otimista). DENTRO da transaction, o stock é LIDO DIRETAMENTE
// do servidor em tempo REAL (não de cache local). Se 2 transactions
// tentarem escrever ao mesmo tempo, Firestore re-executa automaticamente
// a transação perdedora com o valor novo do servidor — garantindo
// resultado CORRETO (sem corrida, sem overselling, sem perda de estoque).
//
// Parâmetros:
//   productId         : string (obrigatório)
//   delta             : number — +N = adicionar estoque (estorno/cancelamento/entrada)
//                                 -N = remover estoque (venda/OS/baixa)
//   opts.variationName: string opcional — nome da variação (se for produto com variações)
//   opts.allowNegative: bool — default false (não permite estoque negativo).
//
// Retorna: Promise<{
//   productId, ok: true,
//   finalStock: number,            — estoque final do produto principal
//   finalVariationsData?: any[],   — se houver variações, array final atualizado
//   patch: { stock, variationsData? }
// }>
export async function adjustProductStockTransactionally(productId, delta, opts = {}) {
  if (!productId) throw new Error('productId é obrigatório (adjustProductStockTransactionally)')
  const d = Number(delta || 0)
  if (d === 0) {
    return { productId, ok: true, finalStock: 0, delta: 0, patch: {} }
  }
  const variationName = opts?.variationName || null
  const allowNegative = !!opts?.allowNegative

  const ref = doc(db, 'products', productId)

  const result = await runTransaction(db, async (txn) => {
    const snap = await txn.get(ref)
    if (!snap.exists()) {
      throw new Error(`Produto ${productId} não encontrado no Firestore`)
    }
    const data = snap.data() || {}
    const hasVars = Array.isArray(data.variationsData) && data.variationsData.length > 0

    // ------------------------------------------------------------
    // 1) Lê estoque REAL do servidor (não de cache!)
    // ------------------------------------------------------------
    let currentStock = Number(data.stock ?? (Number(data.stockInitial ?? 0)))
    let variationsData = hasVars ? data.variationsData.map(v => ({ ...v })) : null

    // ------------------------------------------------------------
    // 2) Aplica delta
    // ------------------------------------------------------------
    let newStock = currentStock + d
    let newVars = variationsData
    let finalStock = newStock

    if (hasVars) {
      if (variationName) {
        // Produto com variações + operação específica de uma variação
        const idx = newVars.findIndex(v => String(v?.name) === String(variationName))
        if (idx < 0) {
          // Variação não existe → joga no estoque geral e grava warning
          console.warn(`[adjustStock] variação "${variationName}" não encontrada no produto ${productId}. Ajustando estoque geral.`)
        } else {
          // Variação existe: ajusta estoque DELA e também do produto principal.
          const v = newVars[idx]
          // Variação tem PRÓPRIO controle de estoque? (usa stock/v.stock se tiver)
          const vCurrent = Number(v.stock ?? (Number(v.stockInitial ?? Number(currentStock))))
          let vNext = vCurrent + d
          if (!allowNegative && vNext < 0) vNext = 0
          newVars = newVars.map((vv, i) => i === idx ? { ...vv, stock: vNext } : vv)
        }
      } else {
        // Produto com variações, mas sem nome de variação (ajuste geral):
        // Atualiza TODAS as variações para o mesmo valor final newStock (comportamento
        // antigo do sistema, para manter compatibilidade).
        if (!allowNegative && newStock < 0) newStock = 0
        finalStock = newStock
        newVars = newVars.map(vv => ({ ...vv, stock: finalStock }))
      }
    }

    if (!allowNegative && newStock < 0) newStock = 0
    finalStock = newStock

    // ------------------------------------------------------------
    // 3) Escreve atomicamente no Firestore (transaction.update)
    // ------------------------------------------------------------
    const patch = {
      stock: finalStock,
      updatedAt: serverTimestamp(),
    }
    if (newVars) patch.variationsData = newVars
    if ('active' in data) patch.active = data.active === false ? false : true

    txn.update(ref, patch)

    return {
      ok: true,
      productId,
      delta: d,
      finalStock,
      finalVariationsData: newVars,
      patch,
    }
  })

  return result
}

// ====================================================================
// editProductManualStockDeltaTransactionally
// ====================================================================
// Usado SOMENTE quando o usuário EDITA um produto EXISTENTE na tela
// de cadastro (NewProductModal modo edição).
//
// A diferença entre ela e adjustProductStockTransactionally é que aqui
// nós aplicamos DELTAS baseados no que o USUÁRIO VIU QUANDO ABRIU O
// MODAL, gravados em refs. Se 2 pessoas abrem o mesmo produto com
// estoque 0, e uma digita 3 (delta +3) e outra digita 5 (delta +5),
// no servidor fica 0 + 3 + 5 = 8. Nunca mais "último que salvar vence".
//
// Entrada:
//   productId  : string
//   deltas     : {
//     stock          : number (delta = novo digitado - original que apareceu)
//     stockInitial   : number delta
//     stockMin       : number delta
//     variations     : Array<{ idx?: number, name?: string, stock, stockInitial, stockMin }>
//                      (idx preferencial, usa name como fallback de match)
//   }
//   opts       : { allowNegative?: boolean = false }
//
// Retorna: Promise<{ ok, finalStock, finalStockInitial, finalStockMin,
//                    finalVariationsData, patch }>
// ====================================================================
export async function editProductManualStockDeltaTransactionally(productId, deltas = {}, opts = {}) {
  if (!productId) throw new Error('productId obrigatório (editProductManualStockDeltaTransactionally)')
  const allowNegative = !!opts?.allowNegative

  const dStock         = Number(deltas?.stock ?? 0)
  const dStockInitial  = Number(deltas?.stockInitial ?? 0)
  const dStockMin      = Number(deltas?.stockMin ?? 0)
  const varDeltas      = Array.isArray(deltas?.variations) ? deltas.variations : []

  // Se não tem absolutamente nenhum delta para aplicar, sair rápido
  if (
    dStock === 0 && dStockInitial === 0 && dStockMin === 0 &&
    varDeltas.every(v => (Number(v?.stock||0) === 0 && Number(v?.stockInitial||0) === 0 && Number(v?.stockMin||0) === 0))
  ) {
    return { ok: true, skipped: true, patch: {} }
  }

  const ref = doc(db, 'products', productId)

  const result = await runTransaction(db, async (txn) => {
    const snap = await txn.get(ref)
    if (!snap.exists()) throw new Error(`Produto ${productId} não existe no servidor`)
    const data = snap.data() || {}

    // ----------------------------------------------------------------
    // 1) Lê valores REAIS do servidor (não de cache!)
    // ----------------------------------------------------------------
    const hasVars = Array.isArray(data.variationsData) && data.variationsData.length > 0
    let curStock        = Number(data.stock ?? 0)
    let curStockInitial = Number(data.stockInitial ?? 0)
    let curStockMin     = Number(data.stockMin ?? 0)
    let variationsData  = hasVars ? data.variationsData.map(v => ({ ...v })) : []

    // ----------------------------------------------------------------
    // 2) Aplica deltas no estoque principal
    // ----------------------------------------------------------------
    let newStock        = curStock + dStock
    let newStockInitial = curStockInitial + dStockInitial
    let newStockMin     = curStockMin + dStockMin
    if (!allowNegative) {
      newStock        = Math.max(0, newStock)
      newStockInitial = Math.max(0, newStockInitial)
      newStockMin     = Math.max(0, newStockMin)
    }

    // ----------------------------------------------------------------
    // 3) Aplica deltas nas variações (se existirem)
    // ----------------------------------------------------------------
    let newVars = null
    if (hasVars && varDeltas.length > 0) {
      newVars = variationsData
      varDeltas.forEach(vd => {
        // Prioridade de match: idx exato > nome exato
        let matchIdx = -1
        if (typeof vd.idx === 'number' && vd.idx >= 0 && vd.idx < newVars.length) {
          matchIdx = vd.idx
        } else if (vd.name) {
          matchIdx = newVars.findIndex(vv => vv.name === vd.name)
        }
        if (matchIdx < 0) return
        const target = newVars[matchIdx]
        const nVs = Number(target.stock ?? 0) + Number(vd.stock ?? 0)
        const nVi = Number(target.stockInitial ?? 0) + Number(vd.stockInitial ?? 0)
        const nVm = Number(target.stockMin ?? 0) + Number(vd.stockMin ?? 0)
        target.stock = allowNegative ? nVs : Math.max(0, nVs)
        target.stockInitial = allowNegative ? nVi : Math.max(0, nVi)
        target.stockMin = allowNegative ? nVm : Math.max(0, nVm)
      })
    }

    // ----------------------------------------------------------------
    // 4) Estratégia: ESTOQUE UNIFICADO (nunca separado). Após deltas,
    //    propagar stock principal para TODAS as variações, e vice-
    //    versa (maior valor = referência).
    // ----------------------------------------------------------------
    if (hasVars && newVars) {
      const varMaxStock = Math.max(...newVars.map(v => Number(v?.stock ?? 0)), newStock)
      const varMaxInit  = Math.max(...newVars.map(v => Number(v?.stockInitial ?? 0)), newStockInitial)
      const varMaxMin   = Math.max(...newVars.map(v => Number(v?.stockMin ?? 0)), newStockMin)
      newStock        = varMaxStock
      newStockInitial = varMaxInit
      newStockMin     = varMaxMin
      newVars = newVars.map(vv => ({
        ...vv,
        stock: newStock,
        stockInitial: newStockInitial,
        stockMin: newStockMin,
      }))
    }

    // ----------------------------------------------------------------
    // 5) Monta patch final + grava atomicamente na transaction
    // ----------------------------------------------------------------
    const patch = {
      stock: newStock,
      stockInitial: newStockInitial,
      stockMin: newStockMin,
      updatedAt: serverTimestamp(),
    }
    if (newVars) patch.variationsData = newVars
    if ('active' in data) patch.active = data.active === false ? false : true

    txn.update(ref, patch)

    return {
      ok: true,
      productId,
      finalStock: newStock,
      finalStockInitial: newStockInitial,
      finalStockMin: newStockMin,
      finalVariationsData: newVars,
      patch,
    }
  })

  return result
}
