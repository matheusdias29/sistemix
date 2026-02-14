import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from './firebase'
import { getAllProducts } from '../services/products'
import { getAllClients } from '../services/clients'

const productsMap = new Map() // storeId -> array
const clientsMap = new Map()  // storeId -> array
const prodSubs = new Map()    // storeId -> Set(callback)
const cliSubs = new Map()     // storeId -> Set(callback)
const liveUnsubs = new Map()  // storeId -> { prod?: fn, cli?: fn }

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
