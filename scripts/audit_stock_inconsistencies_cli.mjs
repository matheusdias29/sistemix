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
  if (Number.isNaN(d.getTime())) return null
  return d
}

const safeNumber = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return n
}

const uniqueNumbers = (arr) => {
  const set = new Set()
  arr.forEach(v => set.add(safeNumber(v)))
  return Array.from(set.values())
}

const csvEscape = (v) => {
  const s = String(v ?? '')
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

const formatDateTime = (d) => {
  const dd = toDate(d)
  return dd ? dd.toLocaleString('pt-BR') : ''
}

async function chooseStoreInteractive() {
  const storesSnapshot = await getDocs(collection(db, 'stores'))
  const stores = storesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }))

  if (!stores.length) {
    console.log('❌ Nenhuma loja encontrada.')
    process.exit(1)
  }

  console.log('\nLojas disponíveis:')
  stores.forEach((s, idx) => {
    const name = s.name || '(sem nome)'
    console.log(`${idx + 1}. ${name}  [${s.id}]`)
  })

  const input = (await question('\nSelecione pelo número OU cole o storeId: ')).trim()
  if (!input) {
    console.log('❌ Entrada vazia.')
    process.exit(1)
  }

  if (/^\d+$/.test(input)) {
    const i = parseInt(input, 10) - 1
    const selected = stores[i]
    if (!selected) {
      console.log('❌ Loja inválida.')
      process.exit(1)
    }
    return selected
  }

  const byId = stores.find(s => s.id === input)
  if (byId) return byId

  console.log('⚠️ storeId não encontrado na lista, vou usar mesmo assim.')
  return { id: input, name: input }
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

async function getAllStockMovementsByProduct(productId, max = 2000) {
  const out = []
  const BATCH_SIZE = 400
  let lastDoc = null

  while (true) {
    let q = query(collection(db, 'stock_movements'), where('productId', '==', productId), limit(BATCH_SIZE))
    if (lastDoc) {
      q = query(collection(db, 'stock_movements'), where('productId', '==', productId), startAfter(lastDoc), limit(BATCH_SIZE))
    }
    const snap = await getDocs(q)
    if (snap.empty) break
    snap.docs.forEach(d => out.push({ id: d.id, ...d.data() }))
    lastDoc = snap.docs[snap.docs.length - 1]
    if (out.length >= max) break
  }

  out.sort((a, b) => {
    const ta = toDate(a.createdAt)?.getTime() || toDate(a.date)?.getTime() || 0
    const tb = toDate(b.createdAt)?.getTime() || toDate(b.date)?.getTime() || 0
    return tb - ta
  })
  return out
}

function analyzeProductStock(product) {
  const productStock = safeNumber(product.stock ?? 0)
  const productStockInitial = safeNumber(product.stockInitial ?? 0)
  const productUpdatedAt = toDate(product.updatedAt) || toDate(product.createdAt)
  const variations = Array.isArray(product.variationsData) ? product.variationsData : []

  const varNames = variations.map((v, idx) => {
    const name = String(v?.name || v?.label || '').trim()
    return name || `Precificação ${idx + 1}`
  })
  const varStocks = variations.map(v => safeNumber(v?.stock ?? 0))
  const varStockInitials = variations.map(v => safeNumber(v?.stockInitial ?? 0))
  const varStockMins = variations.map(v => safeNumber(v?.stockMin ?? 0))

  const uniqueVarStocks = uniqueNumbers(varStocks)
  const anyVarDiffFromProduct = variations.some(v => safeNumber(v?.stock ?? 0) !== productStock)
  const hasMultipleActiveStockValues = uniqueVarStocks.length > 1

  const v5 = variations.length >= 5 ? variations[4] : null
  const v5Stock = v5 ? safeNumber(v5.stock ?? 0) : 0
  const sumWithout5 = variations.reduce((acc, v, idx) => (idx === 4 ? acc : acc + safeNumber(v?.stock ?? 0)), 0)
  const legacyStockInP5 = variations.length >= 5 && v5Stock !== 0 && productStock === sumWithout5 && v5Stock !== productStock
  const v5Divergence = variations.length >= 5 && safeNumber(v5?.stock ?? 0) !== productStock

  const issues = []
  if (hasMultipleActiveStockValues) issues.push('MULTI_STOCK_VARIATIONS')
  if (anyVarDiffFromProduct) issues.push('VARIATION_STOCK_DIFFERS_FROM_PRODUCT')
  if (legacyStockInP5) issues.push('LEGACY_STOCK_IN_PRICING_5')
  else if (v5Divergence) issues.push('PRICING_5_DIVERGES')
  if (productStockInitial !== productStock && productStockInitial !== 0) issues.push('STOCK_INITIAL_DIFFERS')
  if (uniqueNumbers(varStockInitials).length > 1) issues.push('MULTI_STOCK_INITIAL_VARIATIONS')
  if (uniqueNumbers(varStockMins).length > 1) issues.push('MULTI_STOCK_MIN_VARIATIONS')

  return {
    productId: product.id,
    productName: product.name || '',
    productUpdatedAt,
    productStock,
    productStockInitial,
    variationsCount: variations.length,
    uniqueVarStocks,
    varNames,
    varStocks,
    varStockInitials,
    varStockMins,
    v5Stock,
    sumWithout5,
    legacyStockInP5,
    issues
  }
}

function buildReportRows({ storeId, storeName, analyzedProducts, movementsByProduct, recentCutoff }) {
  const rows = []
  const cutoffTime = recentCutoff ? recentCutoff.getTime() : 0

  analyzedProducts.forEach(p => {
    const updatedAtStr = formatDateTime(p.productUpdatedAt)
    const isRecent = p.productUpdatedAt ? p.productUpdatedAt.getTime() >= cutoffTime : false
    const base = {
      storeId,
      storeName,
      productId: p.productId,
      productName: p.productName,
      issues: p.issues.join('|'),
      updatedAt: updatedAtStr,
      updatedAfterCutoff: isRecent ? 'SIM' : 'NÃO',
      productStock: p.productStock,
      productStockInitial: p.productStockInitial,
      variationsCount: p.variationsCount,
      uniqueVariationStocks: p.uniqueVarStocks.join('|'),
      variationStocks: JSON.stringify(p.varStocks),
      variationStockInitials: JSON.stringify(p.varStockInitials),
      variationStockMins: JSON.stringify(p.varStockMins),
      v5Stock: p.v5Stock,
      sumWithout5: p.sumWithout5,
      legacyStockInP5: p.legacyStockInP5 ? 'SIM' : 'NÃO',
    }

    const movs = movementsByProduct.get(p.productId) || []
    if (!movs.length) {
      rows.push({
        ...base,
        movementDate: '',
        movementType: '',
        movementQty: '',
        movementReason: '',
        movementRef: '',
        movementDesc: '',
        movementUser: '',
      })
      return
    }

    movs.forEach(m => {
      rows.push({
        ...base,
        movementDate: formatDateTime(m.createdAt || m.date),
        movementType: m.type || '',
        movementQty: safeNumber(m.quantity ?? 0),
        movementReason: m.reason || '',
        movementRef: m.referenceNumber || m.referenceId || '',
        movementDesc: m.description || '',
        movementUser: m.userName || m.userId || '',
      })
    })
  })

  return rows
}

async function exportCsv(rows, filePath) {
  if (!rows.length) {
    fs.writeFileSync(filePath, 'sem_dados\n', 'utf8')
    return
  }
  const headers = Object.keys(rows[0])
  const lines = []
  lines.push(headers.map(csvEscape).join(','))
  rows.forEach(r => {
    lines.push(headers.map(h => csvEscape(r[h])).join(','))
  })
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
}

async function exportJson(data, filePath) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
}

function buildJsonReport({ storeId, storeName, recentCutoff, analyzedProducts, movementsByProduct }) {
  const cutoffTime = recentCutoff ? recentCutoff.getTime() : 0

  const products = analyzedProducts.map(p => {
    const updatedAt = p.productUpdatedAt || null
    const updatedAfterCutoff = updatedAt ? (updatedAt.getTime() >= cutoffTime) : false

    const maxVar = p.varStocks.length ? Math.max(...p.varStocks) : 0
    const minVar = p.varStocks.length ? Math.min(...p.varStocks) : 0

    const wrongPlaces = []
    for (let i = 0; i < p.varStocks.length; i++) {
      const vStock = safeNumber(p.varStocks[i])
      if (vStock !== p.productStock) {
        wrongPlaces.push({
          index: i + 1,
          name: p.varNames?.[i] || `Precificação ${i + 1}`,
          stock: vStock,
          expectedProductStock: p.productStock
        })
      }
    }

    const movs = movementsByProduct.get(p.productId) || []
    const lastMov = movs.length ? movs[0] : null

    return {
      productId: p.productId,
      productName: p.productName,
      issues: p.issues,
      updatedAt: updatedAt ? updatedAt.toISOString() : null,
      updatedAtBr: formatDateTime(updatedAt),
      updatedAfterCutoff,
      productStock: p.productStock,
      productStockInitial: p.productStockInitial,
      variationsCount: p.variationsCount,
      uniqueVariationStocks: p.uniqueVarStocks,
      maxVariationStock: maxVar,
      minVariationStock: minVar,
      v5Stock: p.v5Stock,
      sumWithout5: p.sumWithout5,
      legacyStockInP5: !!p.legacyStockInP5,
      wrongPlaces,
      lastMovement: lastMov
        ? {
            date: (toDate(lastMov.createdAt || lastMov.date) || null)?.toISOString?.() || null,
            dateBr: formatDateTime(lastMov.createdAt || lastMov.date),
            type: lastMov.type || null,
            quantity: safeNumber(lastMov.quantity ?? 0),
            reason: lastMov.reason || null,
            reference: lastMov.referenceNumber || lastMov.referenceId || null,
            description: lastMov.description || null,
            user: lastMov.userName || lastMov.userId || null
          }
        : null
    }
  })

  const totals = {
    inconsistent: analyzedProducts.length,
    multiStockVariations: analyzedProducts.filter(p => p.issues.includes('MULTI_STOCK_VARIATIONS')).length,
    legacyStockInPricing5: analyzedProducts.filter(p => p.issues.includes('LEGACY_STOCK_IN_PRICING_5')).length,
    updatedAfterCutoff: analyzedProducts.filter(p => (p.productUpdatedAt ? p.productUpdatedAt.getTime() >= cutoffTime : false)).length,
  }

  return {
    generatedAt: new Date().toISOString(),
    storeId,
    storeName,
    recentCutoff: recentCutoff ? recentCutoff.toISOString() : null,
    totals,
    products,
  }
}

async function main() {
  console.log('=== Auditoria de Estoque / Precificação (CLI) ===')

  try {
    await signInAnonymously(auth)
    console.log('✔ Autenticado.')
  } catch (e) {
    console.error('❌ Falha na autenticação:', e?.code || e?.message || e)
    process.exit(1)
  }

  const store = await chooseStoreInteractive()
  const storeId = store.id
  const storeName = store.name || store.id
  console.log(`\n✔ Loja selecionada: ${storeName} (${storeId})`)

  const recentDays = 30
  const recentCutoff = new Date()
  recentCutoff.setDate(recentCutoff.getDate() - recentDays)
  console.log(`ℹ️ Destaque de alterações recentes: últimos ${recentDays} dias (desde ${recentCutoff.toLocaleDateString('pt-BR')}).`)

  console.log('\n🔄 Carregando produtos da loja...')
  const products = await getAllProductsByStore(storeId)
  console.log(`✔ Produtos carregados: ${products.length}`)

  const analyzed = products.map(analyzeProductStock)
  const inconsistent = analyzed.filter(p => p.issues.length > 0)

  const multiStock = inconsistent.filter(p => p.issues.includes('MULTI_STOCK_VARIATIONS'))
  const legacyP5 = inconsistent.filter(p => p.issues.includes('LEGACY_STOCK_IN_PRICING_5'))

  console.log('\n=== Resultados ===')
  console.log(`Produtos com inconsistências: ${inconsistent.length}`)
  console.log(`- Com múltiplos estoques nas variações: ${multiStock.length}`)
  console.log(`- Com legado de estoque na Precificação 5: ${legacyP5.length}`)

  if (!inconsistent.length) {
    console.log('\n✅ Nenhuma inconsistência encontrada.')
    rl.close()
    process.exit(0)
  }

  const shouldLoadMovements = (await question('\nBuscar movimentações de estoque para produtos inconsistentes? (s/n): ')).trim().toLowerCase() === 's'
  const movementsByProduct = new Map()

  if (shouldLoadMovements) {
    console.log('\n🔄 Carregando movimentações (stock_movements)...')
    for (let i = 0; i < inconsistent.length; i++) {
      const p = inconsistent[i]
      const movs = await getAllStockMovementsByProduct(p.productId, 2000)
      movementsByProduct.set(p.productId, movs)
      process.stdout.write(`\rMovimentações carregadas: ${i + 1}/${inconsistent.length}`)
    }
    process.stdout.write('\n')
  } else {
    inconsistent.forEach(p => movementsByProduct.set(p.productId, []))
  }

  const reportRows = buildReportRows({
    storeId,
    storeName,
    analyzedProducts: inconsistent,
    movementsByProduct,
    recentCutoff
  })

  const jsonExport = (await question('\nGerar arquivo JSON com todos os produtos inconsistentes? (s/n): ')).trim().toLowerCase()
  if (jsonExport === 's') {
    const defaultName = `stock_audit_${storeId}_${new Date().toISOString().slice(0, 10)}.json`
    const defaultPath = path.resolve(__dirname, defaultName)
    const outPath = (await question(`Caminho do JSON (enter para padrão: ${defaultPath}): `)).trim() || defaultPath
    const jsonData = buildJsonReport({
      storeId,
      storeName,
      recentCutoff,
      analyzedProducts: inconsistent,
      movementsByProduct
    })
    await exportJson(jsonData, outPath)
    console.log(`✔ JSON gerado em: ${outPath}`)
  }

  const exportNow = (await question('\nExportar relatório em CSV? (s/n): ')).trim().toLowerCase()
  if (exportNow === 's') {
    const defaultName = `stock_audit_${storeId}_${new Date().toISOString().slice(0, 10)}.csv`
    const defaultPath = path.resolve(__dirname, defaultName)
    const outPath = (await question(`Caminho do CSV (enter para padrão: ${defaultPath}): `)).trim() || defaultPath
    await exportCsv(reportRows, outPath)
    console.log(`✔ CSV gerado em: ${outPath}`)
  }

  console.log('\n📌 Top 20 produtos inconsistentes:')
  inconsistent
    .slice(0, 20)
    .forEach((p, idx) => {
      console.log(
        `${idx + 1}. ${p.productName || '(sem nome)'} [${p.productId}] ` +
        `estoque=${p.productStock} ` +
        `vStocks=${p.uniqueVarStocks.join('|')} ` +
        `issues=${p.issues.join('|')}`
      )
    })

  rl.close()
  process.exit(0)
}

main().catch(e => {
  console.error('Erro fatal:', e)
  try { rl.close() } catch {}
  process.exit(1)
})
