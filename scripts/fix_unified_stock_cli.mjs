import { initializeApp } from 'firebase/app'
import {
  initializeFirestore,
  collection,
  getDocs,
  query,
  where,
  limit,
  startAfter,
  writeBatch,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { getAuth, signInAnonymously } from 'firebase/auth'
import readline from 'readline'

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

const safeNumber = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

async function chooseStoreInteractive(defaultStoreId = '') {
  const storesSnap = await getDocs(collection(db, 'stores'))
  const stores = storesSnap.docs.map(d => ({ id: d.id, ...d.data() }))

  console.log('\nLojas disponíveis:')
  stores.forEach((s, i) => console.log(`${i + 1}. ${s.name || '(sem nome)'} [${s.id}]`))

  if (defaultStoreId) {
    const found = stores.find(s => s.id === defaultStoreId)
    if (found) return found
  }

  const input = (await question(`\nSelecione pelo número ou storeId${defaultStoreId ? ` (enter = ${defaultStoreId})` : ''}: `)).trim() || defaultStoreId
  if (!input) throw new Error('Loja não informada')
  if (/^\d+$/.test(input)) {
    const store = stores[parseInt(input, 10) - 1]
    if (!store) throw new Error('Loja inválida')
    return store
  }
  return stores.find(s => s.id === input) || { id: input, name: input }
}

async function getAllProductsByStore(storeId) {
  const out = []
  const BATCH_SIZE = 400
  let lastDoc = null

  while (true) {
    let q = query(collection(db, 'products'), where('storeId', '==', storeId), limit(BATCH_SIZE))
    if (lastDoc) {
      q = query(collection(db, 'products'), where('storeId', '==', storeId), startAfter(lastDoc), limit(BATCH_SIZE))
    }
    const snap = await getDocs(q)
    if (snap.empty) break
    snap.docs.forEach(d => out.push({ id: d.id, ...d.data() }))
    lastDoc = snap.docs[snap.docs.length - 1]
    process.stdout.write(`\rProdutos carregados: ${out.length}`)
  }
  process.stdout.write('\n')
  return out
}

function analyzeAndBuildUpdate(product) {
  const variations = Array.isArray(product.variationsData) ? product.variationsData : []
  if (!variations.length) return null

  const productStock = safeNumber(product.stock ?? 0)
  const productStockInitial = safeNumber(product.stockInitial ?? 0)
  const productStockMin = safeNumber(product.stockMin ?? 0)

  const variationStocks = variations.map(v => safeNumber(v?.stock ?? 0))
  const variationInitials = variations.map(v => safeNumber(v?.stockInitial ?? 0))
  const variationMins = variations.map(v => safeNumber(v?.stockMin ?? 0))

  const normalizedStock = Math.max(0, productStock, ...variationStocks)
  const normalizedStockInitial = Math.max(0, productStockInitial)
  const normalizedStockMin = Math.max(0, productStockMin)

  const needsFix =
    variationStocks.some(v => v !== normalizedStock) ||
    variationInitials.some(v => v !== normalizedStockInitial) ||
    variationMins.some(v => v !== normalizedStockMin) ||
    productStock !== normalizedStock ||
    productStockInitial < 0 ||
    productStockMin < 0

  if (!needsFix) return null

  return {
    id: product.id,
    name: product.name || '',
    before: {
      productStock,
      productStockInitial,
      productStockMin,
      variationStocks,
      variationInitials,
      variationMins,
    },
    update: {
      stock: normalizedStock,
      stockInitial: normalizedStockInitial,
      stockMin: normalizedStockMin,
      variationsData: variations.map(v => ({
        ...v,
        stock: normalizedStock,
        stockInitial: normalizedStockInitial,
        stockMin: normalizedStockMin,
      })),
      updatedAt: serverTimestamp(),
    }
  }
}

async function main() {
  console.log('=== Corretor de Estoque Unificado (CLI) ===')
  console.log('Este script sincroniza o estoque do produto e de todas as precificações/variações.')

  try {
    await signInAnonymously(auth)
    console.log('✔ Autenticado.')
  } catch (e) {
    console.error('❌ Falha na autenticação:', e?.code || e?.message || e)
    process.exit(1)
  }

  const argStoreId = process.argv.find(a => a.startsWith('--store='))?.split('=')[1] || ''
  const autoYes = process.argv.includes('--yes')
  const store = await chooseStoreInteractive(argStoreId)
  const storeId = store.id
  console.log(`\n✔ Loja selecionada: ${store.name || storeId} (${storeId})`)

  console.log('\n🔄 Carregando produtos...')
  const products = await getAllProductsByStore(storeId)
  const fixes = products.map(analyzeAndBuildUpdate).filter(Boolean)

  console.log('\n=== Prévia ===')
  console.log(`Produtos totais: ${products.length}`)
  console.log(`Produtos que serão corrigidos: ${fixes.length}`)

  fixes.slice(0, 20).forEach((f, idx) => {
    console.log(
      `${idx + 1}. ${f.name || '(sem nome)'} [${f.id}] ` +
      `stock ${f.before.productStock} -> ${f.update.stock} | ` +
      `vars ${JSON.stringify(f.before.variationStocks)}`
    )
  })

  if (!fixes.length) {
    console.log('\n✅ Nada para corrigir.')
    rl.close()
    process.exit(0)
  }

  const confirm1 = autoYes ? 's' : (await question('\nDeseja continuar com a correção? (s/n): ')).trim().toLowerCase()
  if (confirm1 !== 's') {
    console.log('Cancelado.')
    rl.close()
    process.exit(0)
  }

  const confirm2 = autoYes ? 's' : (await question('ATENÇÃO: isso vai alterar o banco. Confirmar novamente? (s/n): ')).trim().toLowerCase()
  if (confirm2 !== 's') {
    console.log('Cancelado.')
    rl.close()
    process.exit(0)
  }

  let updated = 0
  const BATCH_SIZE = 350
  for (let i = 0; i < fixes.length; i += BATCH_SIZE) {
    const slice = fixes.slice(i, i + BATCH_SIZE)
    const batch = writeBatch(db)
    slice.forEach(f => {
      batch.update(doc(db, 'products', f.id), f.update)
    })
    await batch.commit()
    updated += slice.length
    process.stdout.write(`\rCorrigidos: ${updated}/${fixes.length}`)
  }
  process.stdout.write('\n')

  console.log('\n✅ Correção concluída.')
  console.log(`Produtos corrigidos: ${updated}`)
  rl.close()
  process.exit(0)
}

main().catch((e) => {
  console.error('Erro fatal:', e)
  try { rl.close() } catch {}
  process.exit(1)
})
