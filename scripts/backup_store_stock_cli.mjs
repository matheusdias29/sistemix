import { initializeApp } from 'firebase/app'
import {
  initializeFirestore,
  collection,
  getDocs,
  query,
  where,
  limit,
  startAfter,
  doc,
  getDoc,
} from 'firebase/firestore'
import { getAuth, signInAnonymously } from 'firebase/auth'
import readline from 'readline'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const firebaseConfig = {
  apiKey: "AIzaSyDm61fcXbemFSUIiTEATy47SBD5PvsCpaI",
  authDomain: "sixtemix.firebaseapp.com",
  projectId: "sixtemix",
  storageBucket: "sixtemix.firebasestorage.app",
  messagingSenderId: "322849102175",
  appId: "1:322849102175:web:a3aef88707c94ff257beea",
  measurementId: "G-W3XDS34DZ8"
}

const app = initializeApp(firebaseConfig)
const dbId = process.env.FIRESTORE_DB_ID || 'sistemix'
const db = initializeFirestore(app, { ignoreUndefinedProperties: true }, dbId)
const auth = getAuth(app)

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (q) => new Promise((resolve) => rl.question(q, resolve))

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const toDate = (v) => {
  if (!v) return null
  if (v?.toDate) return v.toDate()
  if (v?.seconds) return new Date(v.seconds * 1000)
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

function serializeFirestore(value) {
  if (Array.isArray(value)) return value.map(serializeFirestore)
  if (value && typeof value === 'object') {
    if (value?.toDate) {
      const d = value.toDate()
      return d instanceof Date ? d.toISOString() : value
    }
    if (value?.seconds != null && value?.nanoseconds != null) {
      return new Date(value.seconds * 1000).toISOString()
    }
    const out = {}
    Object.entries(value).forEach(([k, v]) => {
      out[k] = serializeFirestore(v)
    })
    return out
  }
  return value
}

async function chooseStoreInteractive(defaultStoreId = '') {
  const storesSnap = await getDocs(collection(db, 'stores'))
  const stores = storesSnap.docs.map(d => ({ id: d.id, ...d.data() }))

  if (!stores.length) {
    console.log('❌ Nenhuma loja encontrada.')
    process.exit(1)
  }

  console.log('\nLojas disponíveis:')
  stores.forEach((s, i) => console.log(`${i + 1}. ${s.name || '(sem nome)'} [${s.id}]`))

  if (defaultStoreId) {
    const found = stores.find(s => s.id === defaultStoreId)
    if (found) return found
  }

  const input = (await question(`\nSelecione pelo número ou storeId${defaultStoreId ? ` (enter = ${defaultStoreId})` : ''}: `)).trim() || defaultStoreId
  if (!input) {
    console.log('❌ Loja não informada.')
    process.exit(1)
  }
  if (/^\d+$/.test(input)) {
    const store = stores[parseInt(input, 10) - 1]
    if (!store) {
      console.log('❌ Loja inválida.')
      process.exit(1)
    }
    return store
  }
  return stores.find(s => s.id === input) || { id: input, name: input }
}

async function getAllByStore(collectionName, storeId) {
  const out = []
  const BATCH_SIZE = 400
  let lastDoc = null

  while (true) {
    let q = query(collection(db, collectionName), where('storeId', '==', storeId), limit(BATCH_SIZE))
    if (lastDoc) {
      q = query(collection(db, collectionName), where('storeId', '==', storeId), startAfter(lastDoc), limit(BATCH_SIZE))
    }
    const snap = await getDocs(q)
    if (snap.empty) break
    snap.docs.forEach(d => out.push({ id: d.id, ...d.data() }))
    lastDoc = snap.docs[snap.docs.length - 1]
    process.stdout.write(`\r${collectionName}: ${out.length}`)
  }
  process.stdout.write('\n')
  return out
}

async function getStore(storeId) {
  const ref = doc(db, 'stores', storeId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

function summarizeProducts(products) {
  const summary = {
    total: products.length,
    active: 0,
    withVariations: 0,
    inconsistentVariationStocks: 0,
    negativeStock: 0,
  }

  products.forEach(p => {
    if (p.active !== false) summary.active += 1
    const vars = Array.isArray(p.variationsData) ? p.variationsData : []
    if (vars.length) summary.withVariations += 1

    const pStock = Number(p.stock || 0)
    const unique = new Set(vars.map(v => Number(v?.stock || 0)))
    if (unique.size > 1 || vars.some(v => Number(v?.stock || 0) !== pStock)) {
      summary.inconsistentVariationStocks += 1
    }
    if (pStock < 0) summary.negativeStock += 1
  })

  return summary
}

async function main() {
  console.log('=== Backup de Estoque / Produtos da Loja (CLI) ===')

  try {
    await signInAnonymously(auth)
    console.log('✔ Autenticado.')
  } catch (e) {
    console.error('❌ Falha na autenticação:', e?.code || e?.message || e)
    process.exit(1)
  }

  const argStoreId = process.argv.find(a => a.startsWith('--store='))?.split('=')[1] || ''
  const argOutputPath = process.argv.find(a => a.startsWith('--output='))?.split('=')[1] || ''
  const selectedStore = await chooseStoreInteractive(argStoreId)
  const storeId = selectedStore.id

  console.log(`\n✔ Loja selecionada: ${selectedStore.name || storeId} (${storeId})`)
  console.log('\n🔄 Carregando dados...')

  const store = await getStore(storeId)
  const products = await getAllByStore('products', storeId)
  const categories = await getAllByStore('categories', storeId)
  const suppliers = await getAllByStore('suppliers', storeId)

  const backup = {
    generatedAt: new Date().toISOString(),
    storeId,
    store: serializeFirestore(store),
    summary: summarizeProducts(products),
    counts: {
      products: products.length,
      categories: categories.length,
      suppliers: suppliers.length,
    },
    products: serializeFirestore(products),
    categories: serializeFirestore(categories),
    suppliers: serializeFirestore(suppliers),
  }

  const defaultName = `backup_store_stock_${storeId}_${new Date().toISOString().slice(0, 10)}.json`
  const defaultPath = path.resolve(__dirname, defaultName)
  const outputPath = argOutputPath || (await question(`\nCaminho do backup (enter para padrão: ${defaultPath}): `)).trim() || defaultPath

  fs.writeFileSync(outputPath, JSON.stringify(backup, null, 2), 'utf8')
  console.log(`\n✅ Backup salvo em: ${outputPath}`)
  console.log(`Resumo: ${backup.summary.total} produtos | ${backup.summary.inconsistentVariationStocks} com divergência de estoque`)

  rl.close()
  process.exit(0)
}

main().catch((e) => {
  console.error('Erro fatal:', e)
  try { rl.close() } catch {}
  process.exit(1)
})

