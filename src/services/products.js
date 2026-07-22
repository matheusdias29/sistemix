import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where, deleteDoc, getDocs, getCountFromServer, limit, startAt, endAt, startAfter, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { getStoreById, listStoresByOwner } from './stores'

const colRef = collection(db, 'products')

export function listenProducts(callback, storeId){
  const q = storeId 
    ? query(colRef, where('storeId','==',storeId), orderBy('createdAt', 'desc'), limit(50))
    : query(colRef, orderBy('createdAt', 'desc'), limit(50))
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

export async function getAllProducts(storeId) {
  const all = []
  let lastDoc = null
  const CHUNK_SIZE = 5000 

  try {
    while (true) {
      // REMOVIDO orderBy('name') para evitar necessidade de índice composto com storeId
      // O Firestore permite startAfter sem orderBy explícito (usa o ID do documento por padrão)
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
    console.error('Erro em getAllProducts:', err)
    // Se falhar a busca otimizada, tenta uma busca simples sem limite ou chunks se for pequeno,
    // mas aqui o ideal é retornar o que conseguimos ou erro.
  }
  
  return all
}

export async function getProductsByPage(storeId, page, pageSize) {
  const targetIndex = (page - 1) * pageSize
  // Limit strategy for pagination
  const qBig = query(colRef, where('storeId', '==', storeId), orderBy('createdAt', 'desc'), limit(targetIndex + pageSize))
  const snap = await getDocs(qBig)
  const allDocs = snap.docs
  const pageDocs = allDocs.slice(targetIndex, targetIndex + pageSize)
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
    active: product.active ?? true,

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
  await updateDoc(ref, data)
  return { ...data, updatedAt: new Date() }
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
