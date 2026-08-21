import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from './firebase'
import { getAllProducts } from '../services/products'
import { getAllClients } from '../services/clients'

const productsMap = new Map() // storeId -> array
const clientsMap = new Map()  // storeId -> array
const prodSubs = new Map()    // storeId -> Set(callback)
const cliSubs = new Map()     // storeId -> Set(callback)
const liveUnsubs = new Map()  // storeId -> { prod?: fn, cli?: fn }

// ============================================================
// STORAGE HÍBRIDO COMPARTILHADO:
// localStorage (<4MB) ou IndexedDB fallback (inline, SEM lib).
// Usado por ProductsPage, ClientsPage, e agora TAMBÉM pelos fluxos
// de Venda / OS / Estorno para ATUALIZAR o cache em disco NA HORA
// (evita que a página Produtos apareça com estoque velho após uma
// movimentação, mesmo que cache tenha <10min e não chame o servidor).
// ============================================================
export const LOCALSTORAGE_MAX_BYTES = 4 * 1024 * 1024 // 4 MB

let _idbPromise = null
const openIDB = () => {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('no indexedDB'))
  if (_idbPromise) return _idbPromise
  _idbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open('sistemix_cache', 1)
      req.onupgradeneeded = () => { try { req.result.createObjectStore('kv') } catch {} }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error || new Error('idb open failed'))
    } catch (e) { reject(e) }
  })
  return _idbPromise
}
const idbGet = async (key) => {
  const db = await openIDB()
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('kv', 'readonly')
      const req = tx.objectStore('kv').get(key)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => resolve(null)
    } catch { resolve(null) }
  })
}
const idbSet = async (key, value) => {
  const db = await openIDB()
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction('kv', 'readwrite')
      tx.objectStore('kv').put(value, key)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => reject(tx.error || new Error('idb set failed'))
    } catch (e) { reject(e) }
  })
}
export const storageGet = async (key) => {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      try { return JSON.parse(raw) } catch {}
    }
  } catch {}
  try { return await idbGet(key) } catch { return null }
}
export const storageSet = async (key, value) => {
  if (typeof window === 'undefined') return false
  try {
    const serialized = JSON.stringify(value)
    if (serialized.length <= LOCALSTORAGE_MAX_BYTES * 2) {
      try { localStorage.setItem(key, serialized); return true } catch {}
    }
  } catch {}
  try { return await idbSet(key, value) } catch { return false }
}

// Chave do cache persistente de PRODUTOS (igual a ProductsPage.jsx) — userId + storeId
const productsCacheKey = (storeId, userId) => `sistemix:products:u${String(userId || 'anon')}:s${String(storeId || 'default')}`

// Atualiza o cache em DISCO de produtos com vários patches (fire and forget).
// patches: [{ productId, patch: { stock, variationsData, active, ... } }]
// Ao final, atualiza savedAt = Date.now() para refletir que o disco foi alterado
// e dispara storage event nas outras abas (atualização instantânea cross-aba).
export const applyProductsPatchesToDiskCache = async (storeId, userId, patches) => {
  if (!Array.isArray(patches) || patches.length === 0) return
  if (!storeId) return
  try {
    const key = productsCacheKey(storeId, userId)
    const hit = await storageGet(key)
    // Se não tem cache válido salvo ainda: não precisa atualizar (não existe nada stale)
    if (!hit || !Array.isArray(hit?.data)) return
    let changed = false
    const newData = hit.data.map(p => {
      if (!p || !p.id) return p
      const match = patches.find(x => x && x.productId === p.id)
      if (!match) return p
      changed = true
      const np = { ...p, ...(match.patch || {}) }
      if (match.patch?.variationsData) np.variationsData = match.patch.variationsData
      return np
    })
    if (!changed) return
    const updatedEntry = {
      ...hit,
      data: newData,
      savedAt: Date.now(),
      totalCount: newData.length,
    }
    // Fire and forget — salvo em disco, storage event sincroniza outras abas.
    await storageSet(key, updatedEntry).catch(() => {})
  } catch (e) {
    // Não é erro fatal — próximo sync do ProductsPage arruma
    console.warn('applyProductsPatchesToDiskCache skip:', e?.message || e)
  }
}

// Upsert: substitui ou insere o OBJETO COMPLETO no cache de disco.
// Use em NewProductModal após updateProduct sucesso — pois editou nome/preço/imagem/estoque etc (tudo).
// items: [{ id: ... , ...todosCamposProduto }]
export const upsertProductsToDiskCache = async (storeId, userId, items) => {
  if (!Array.isArray(items) || items.length === 0) return
  if (!storeId) return
  try {
    const key = productsCacheKey(storeId, userId)
    const hit = await storageGet(key)
    // Se não tem cache salvo ainda nao importa — o carregamento do ProductsPage vai chamar Firestore.
    if (!hit || !Array.isArray(hit?.data)) return
    let changed = false
    const existing = [...hit.data]
    for (const newItem of items) {
      if (!newItem || !newItem.id) continue
      const idx = existing.findIndex(p => p && p.id === newItem.id)
      const cleaned = pickProductFields({ ...newItem, id: newItem.id })
      if (idx >= 0) {
        // Mantem o resto de campos do original que podem ser úteis (ex: rootId, stockInitial etc — mas só substituímos)
        existing[idx] = { ...existing[idx], ...cleaned }
        changed = true
      } else {
        // Se não existia, adiciona (raro, possível criado por outro fluxo)
        existing.push(cleaned)
        changed = true
      }
    }
    if (!changed) return
    const updatedEntry = {
      ...hit,
      data: existing,
      savedAt: Date.now(),
      totalCount: existing.length,
    }
    await storageSet(key, updatedEntry).catch(() => {})
  } catch (e) {
    console.warn('upsertProductsToDiskCache skip:', e?.message || e)
  }
}

function notify(map, subsMap, storeId){
  const list = map.get(storeId) || []
  const subs = subsMap.get(storeId)
  if (subs) subs.forEach(cb => { try { cb(list) } catch{} })
}

export function getProductsCache(storeId){ return productsMap.get(storeId) || null }
export function getClientsCache(storeId){ return clientsMap.get(storeId) || null }

export function subscribeProducts(storeId, cb){
  if (!storeId || !cb) return () => {}
  if (!prodSubs.has(storeId)) prodSubs.set(storeId, new Set())
  prodSubs.get(storeId).add(cb)
  // Emit immediately
  cb(productsMap.get(storeId) || [])
  return () => {
    const set = prodSubs.get(storeId)
    if (set) set.delete(cb)
  }
}

export function subscribeClients(storeId, cb){
  if (!storeId || !cb) return () => {}
  if (!cliSubs.has(storeId)) cliSubs.set(storeId, new Set())
  cliSubs.get(storeId).add(cb)
  cb(clientsMap.get(storeId) || [])
  return () => {
    const set = cliSubs.get(storeId)
    if (set) set.delete(cb)
  }
}

function upsertById(arr, item){
  const idx = arr.findIndex(x => x.id === item.id)
  if (idx >= 0) arr[idx] = { ...arr[idx], ...item }
  else arr.push(item)
}

function pickProductFields(d) {
  return {
    id: d.id,
    name: d.name ?? '',
    nameLower: d.nameLower ?? '',
    reference: d.reference ?? '',
    barcode: d.barcode ?? '',
    salePrice: d.salePrice ?? 0,
    promoPrice: d.promoPrice ?? null,
    priceMin: d.priceMin ?? d.salePrice ?? 0,
    priceMax: d.priceMax ?? d.salePrice ?? 0,
    stock: d.stock ?? 0,
    active: d.active ?? true,
    updatedAt: d.updatedAt ?? null,
    createdBy: d.createdBy ?? '',
    lastEditedBy: d.lastEditedBy ?? '',
    imageUrl: d.imageUrl ?? null,
    featured: d.featured ?? false,
    // para cálculo de preço mostrado
    variationsData: Array.isArray(d.variationsData) ? d.variationsData : [],
    // filtros básicos comumente usados
    categoryId: d.categoryId ?? null,
    supplier: d.supplier ?? '',
  }
}

function pickClientFields(d) {
  return {
    id: d.id,
    name: d.name ?? '',
    code: d.code ?? '',
    whatsapp: d.whatsapp ?? '',
    phone: d.phone ?? '',
    allowCredit: d.allowCredit ?? false,
    birthDate: d.birthDate ?? '',
    active: d.active ?? true,
    updatedAt: d.updatedAt ?? null,
    createdBy: d.createdBy ?? '',
    lastEditedBy: d.lastEditedBy ?? '',
    // auxiliares comuns
    nameLower: d.nameLower ?? '',
  }
}

export async function warmUpStore(storeId){
  if (!storeId) return () => {}
  // Initial bulk fetch
  try {
    const [allProds, allClients] = await Promise.all([
      getAllProducts(storeId),
      getAllClients(storeId)
    ])
    const liteProds = allProds.map(doc => pickProductFields(doc))
    const liteClients = allClients.map(doc => pickClientFields(doc))
    productsMap.set(storeId, liteProds)
    clientsMap.set(storeId, liteClients)
    notify(productsMap, prodSubs, storeId)
    notify(clientsMap, cliSubs, storeId)
  } catch (e) {
    // Non-fatal
    console.warn('Warm-up failed:', e?.message)
  }

  // Live listeners
  // Products
  const qProd = query(collection(db, 'products'), where('storeId', '==', storeId))
  const unsubProd = onSnapshot(qProd, (snap) => {
    const list = productsMap.get(storeId) || []
    snap.docChanges().forEach(ch => {
      const id = ch.doc.id
      if (ch.type === 'removed') {
        const idx = list.findIndex(x => x.id === id)
        if (idx >= 0) list.splice(idx, 1)
      } else {
        upsertById(list, pickProductFields({ id, ...ch.doc.data() }))
      }
    })
    productsMap.set(storeId, list)
    notify(productsMap, prodSubs, storeId)
  }, (err) => console.warn('products live error', err))

  // Clients
  const qCli = query(collection(db, 'clients'), where('storeId', '==', storeId))
  const unsubCli = onSnapshot(qCli, (snap) => {
    const list = clientsMap.get(storeId) || []
    snap.docChanges().forEach(ch => {
      const id = ch.doc.id
      if (ch.type === 'removed') {
        const idx = list.findIndex(x => x.id === id)
        if (idx >= 0) list.splice(idx, 1)
      } else {
        upsertById(list, pickClientFields({ id, ...ch.doc.data() }))
      }
    })
    clientsMap.set(storeId, list)
    notify(clientsMap, cliSubs, storeId)
  }, (err) => console.warn('clients live error', err))

  liveUnsubs.set(storeId, { prod: unsubProd, cli: unsubCli })
  return () => {
    const u = liveUnsubs.get(storeId)
    try { u?.prod && u.prod() } catch {}
    try { u?.cli && u.cli() } catch {}
    liveUnsubs.delete(storeId)
  }
}
