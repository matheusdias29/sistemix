import { initializeApp } from 'firebase/app'
import { initializeFirestore, collection, getDocs, query, where, limit, orderBy } from 'firebase/firestore'
import { getAuth, signInAnonymously } from 'firebase/auth'
import readline from 'readline'

const firebaseConfig = {
  apiKey: 'AIzaSyDm61fcXbemFSUIiTEATy47SBD5PvsCpaI',
  authDomain: 'sixtemix.firebaseapp.com',
  projectId: 'sixtemix',
  storageBucket: 'sixtemix.firebasestorage.app',
  messagingSenderId: '322849102175',
  appId: '1:322849102175:web:a3aef88707c94ff257beea',
  measurementId: 'G-W3XDS34DZ8'
}

const app = initializeApp(firebaseConfig)
const dbId = process.env.FIRESTORE_DB_ID || 'sistemix'
const db = initializeFirestore(app, { ignoreUndefinedProperties: true }, dbId)
const auth = getAuth(app)

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (q) => new Promise((resolve) => rl.question(q, resolve))

function print(label, value) {
  if (value === undefined || value === null || value === '') {
    console.log(`  ${label}: (vazio/não existe)`)
    return
  }
  console.log(`  ${label}:`, value)
}

async function listStores() {
  const q = query(collection(db, 'stores'), orderBy('createdAt', 'desc'), limit(30))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

const MONTH_AGO = new Date()
MONTH_AGO.setDate(MONTH_AGO.getDate() - 30)

async function main() {
  console.log('=== Diagnóstico de custos de Vendas/OS ===')
  console.log(`Banco Firestore em uso: ${dbId}`)
  try {
    await signInAnonymously(auth)
    console.log('✔ Autenticado.\n')
  } catch (e) {
    console.error('❌ Falha na autenticação:', e.code)
    process.exit(1)
  }

  const stores = await listStores()
  if (stores.length === 0) {
    console.log('Nenhuma loja encontrada.')
    process.exit(0)
  }

  console.log('Todas as lojas:')
  stores.forEach((s, i) => {
    console.log(`  [${i + 1}] id=${s.id}   name="${s.name || 'Sem nome'}"`)
  })
  console.log('')

  // Tenta encontrar a loja "Lokatell Manutenções" (a da print do usuário)
  let storeIdx = stores.findIndex(s =>
    String(s.name || '').toLowerCase().includes('manuten') && String(s.name || '').toLowerCase().includes('lokate')
  )
  if (storeIdx < 0) storeIdx = stores.findIndex(s => String(s.name || '').toLowerCase().includes('lokate'))
  if (storeIdx < 0) storeIdx = 0
  const store = stores[storeIdx]
  console.log(`Loja selecionada [${storeIdx + 1}]: ${store.name} (id=${store.id})\n`)

  // 1. Amostra de PRODUTOS cadastrados (10 primeiros) — ver TODAS as chaves, não só financeiras
  console.log('================================================================')
  console.log('SEÇÃO 1) AMOSTRA DE PRODUTOS (10 primeiros) para ver TODAS as chaves')
  console.log('================================================================')
  const prodsQ = query(
    collection(db, `stores/${store.id}/products`),
    limit(10)
  )
  const prodSnap = await getDocs(prodsQ)
  const prodList = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }))

  const allProdKeys = new Set()
  for (const p of prodList) Object.keys(p).forEach(k => allProdKeys.add(k))
  console.log('Todas as chaves detectadas em produtos: ' + [...allProdKeys].sort().join(', '))
  console.log('')

  let sampleCount = 0
  for (const p of prodList) {
    if (sampleCount++ >= 3) break
    console.log(`Produto [${sampleCount}]  id=${p.id}`)
    // Printar TODAS as chaves para não perder nenhuma
    for (const k of [...allProdKeys]) {
      const isFinancial = /cost|preco|purchase|price|valor/i.test(k) || k === 'name' || k === 'id'
      if (isFinancial) {
        const v = p[k]
        const label = Array.isArray(v)
          ? `(array com ${v.length} item(ns)) -> ` + JSON.stringify(v.slice(0, 20)).slice(0, 200)
          : typeof v === 'object' && v
          ? JSON.stringify(v).slice(0, 150)
          : v
        print(`  ${k}`, label)
      }
    }
    if (Array.isArray(p.variationsData) && p.variationsData.length > 0) {
      const v = p.variationsData[0]
      const varKeys = Object.keys(v)
      console.log(`  1a. variação (keys: ${varKeys.join(', ')})`)
      for (const k of varKeys) {
        if (/cost|preco|purchase|price|valor|name|label|stock|active/i.test(k)) {
          print(`      ${k}`, k === 'name' || k === 'label' ? String(v[k] || '').slice(0, 150) : v[k])
        }
      }
    }
    console.log('')
  }

  // 2. Amostra de TODAS as VENDAS / OS — SEM FILTRO DE DATA para inspecionar campos REAIS
  console.log('================================================================')
  console.log('SEÇÃO 2) AMOSTRA DE TODAS AS ORDENS (SEM FILTRO) — lim 100')
  console.log('================================================================')

  const ordersQ = query(
    collection(db, `stores/${store.id}/orders`),
    limit(100)
  )
  const ordersSnap = await getDocs(ordersQ)
  const allOrders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  console.log(`Total de orders (lim 100): ${allOrders.length}`)
  console.log(`   com createdAt: ${allOrders.filter(o => !!o.createdAt).length}`)
  console.log(`   com updatedAt: ${allOrders.filter(o => !!o.updatedAt).length}`)
  console.log(`   com date:      ${allOrders.filter(o => !!o.date).length}`)
  console.log('')

  // Mostrar distribuição de status / type
  const statusCounts = new Map()
  const typeCounts = new Map()
  for (const o of allOrders) {
    const s = String(o.status || 'Sem status')
    statusCounts.set(s, (statusCounts.get(s) || 0) + 1)
    const t = String(o.type || 'Sem type')
    typeCounts.set(t, (typeCounts.get(t) || 0) + 1)
  }
  console.log('Distribuição de status:', [...statusCounts.entries()].slice(0, 20).map(([k,v])=>`${k}(${v})`).join(' | '))
  console.log('Distribuição de type:', [...typeCounts.entries()].map(([k,v])=>`${k}(${v})`).join(' | '))
  console.log('')

  let saleCount = 0
  for (const o of allOrders) {
    const status = String(o.status || '').toLowerCase()
    const type = String(o.type || '').toLowerCase()
    const isSale =
      type === 'sale' ||
      status.includes('venda') ||
      status.includes('cliente final') ||
      status.includes('cliente lojista')
    if (!isSale) continue
    if (saleCount++ >= 3) break

    console.log(`Venda [${saleCount}]  id=${o.id}  status="${o.status}"  type="${o.type || '?'}"`)
    print('  total', o.total)
    print('  valor', o.valor)
    print('  totalProducts', o.totalProducts)
    const prod = Array.isArray(o.products) ? o.products : []
    console.log(`  itens (products): ${prod.length}`)
    if (prod.length > 0) {
      for (let idx = 0; idx < Math.min(2, prod.length); idx++) {
        const p = prod[idx]
        const itemKeys = Object.keys(p)
        console.log(`    item #${idx + 1} (keys: ${itemKeys.join(', ')})`)
        for (const k of itemKeys) {
          print(`      ${k}`, k === 'name' ? String(p[k] || '').slice(0, 100) : p[k])
        }
      }
    }
    console.log('')
  }

  // 3. Amostra de ORDENS DE SERVIÇO (últimas 3 do mês)
  console.log('================================================================')
  console.log('SEÇÃO 3) AMOSTRA DE ORDENS DE SERVIÇO (últimas 3 do mês)')
  console.log('================================================================')

  let osCount = 0
  for (const o of allOrders) {
    const status = String(o.status || '').toLowerCase()
    const type = String(o.type || '').toLowerCase()
    const isOS =
      type === 'service_order' ||
      status.includes('os ') ||
      status.includes('o.s.') ||
      status.includes('finalizada') ||
      status.includes('iniciado')
    if (!isOS) continue
    if (osCount++ >= 3) break

    console.log(`OS [${osCount}]  id=${o.id}  status="${o.status}"  type="${o.type || '?'}"`)
    print('  total', o.total)
    print('  valor', o.valor)
    const prod = Array.isArray(o.products) ? o.products : []
    console.log(`  produtos/peças: ${prod.length}`)
    if (prod.length > 0) {
      for (let idx = 0; idx < Math.min(2, prod.length); idx++) {
        const p = prod[idx]
        const itemKeys = Object.keys(p)
        console.log(`    item #${idx + 1} (keys: ${itemKeys.join(', ')})`)
        for (const k of itemKeys) {
          print(`      ${k}`, k === 'name' ? String(p[k] || '').slice(0, 100) : p[k])
        }
      }
    }
    console.log('')
  }

  console.log('\nFim do diagnóstico. Agora basta ver se os itens de venda/OS salvam productId, name, cost, costTotal, purchasePrice...')
  rl.close()
}

main().catch(e => {
  console.error('\nErro no script:', e)
  process.exit(1)
})
