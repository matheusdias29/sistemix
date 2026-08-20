import { initializeApp } from 'firebase/app'
import { initializeFirestore, collection, getDocs, query, limit } from 'firebase/firestore'
import { getAuth, signInAnonymously } from 'firebase/auth'

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

const JUL_1_2026 = new Date(2026, 6, 1)  // mês 6 = julho
const AGO_31_2026 = new Date(2026, 7, 31, 23, 59, 59)

function isSale(o) {
  const status = String(o.status || '').toLowerCase()
  const type = String(o.type || '').toLowerCase()
  return (
    type === 'sale' ||
    status.includes('venda') ||
    status.includes('cliente final') ||
    status.includes('cliente lojista')
  )
}

function isOS(o) {
  const status = String(o.status || '').toLowerCase()
  const type = String(o.type || '').toLowerCase()
  return (
    type === 'service_order' ||
    status.includes('os ') ||
    status.includes('o.s.') ||
    status.includes('finalizada') ||
    status.includes('iniciado')
  )
}

function toDateAny(raw) {
  if (!raw) return null
  try {
    if (typeof raw.toDate === 'function') return raw.toDate()
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

function inPeriod(d) {
  return d && d >= JUL_1_2026 && d <= AGO_31_2026
}

async function main() {
  console.log('=== SCAN DE TODAS AS LOJAS (jul/ago 2026) ===')
  console.log(`Banco: ${dbId}\n`)
  try {
    await signInAnonymously(auth)
    console.log('✔ Autenticado.\n')
  } catch (e) {
    console.error('❌ auth:', e.code)
    process.exit(1)
  }

  const storesSnap = await getDocs(query(collection(db, 'stores'), limit(50)))
  const stores = storesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  console.log(`Total de lojas: ${stores.length}\n`)

  let bestStore = null
  let bestScore = 0

  for (const s of stores) {
    try {
      const ordersSnap = await getDocs(query(collection(db, `stores/${s.id}/orders`), limit(500)))
      const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }))

      let salesCount = 0
      let osCount = 0
      let salesTotal = 0
      let osProductTotal = 0
      let osCountFinalizadas = 0
      let sampledSaleItem = null

      for (const o of orders) {
        const d = toDateAny(o.createdAt) || toDateAny(o.updatedAt) || toDateAny(o.date)
        if (!inPeriod(d)) continue

        if (isSale(o)) {
          salesCount++
          salesTotal += Number(o.valor ?? o.total ?? o.totalProducts ?? 0)
          if (!sampledSaleItem && Array.isArray(o.products) && o.products.length > 0) {
            sampledSaleItem = {
              keys: Object.keys(o.products[0]).join(','),
              sample: Object.fromEntries(Object.entries(o.products[0]).slice(0, 12))
            }
          }
        }
        if (isOS(o)) {
          osCount++
          osProductTotal += Number(o.totalProducts ?? o.totalProductsValue ?? 0)
          const st = String(o.status || '').toLowerCase()
          if (st.includes('finalizada')) osCountFinalizadas++
        }
      }

      const score = (salesCount >= 40 && salesCount <= 60 ? 10 : 0) +
                    (osCount >= 60 && osCount <= 85 ? 10 : 0) +
                    (salesTotal >= 10000 ? 5 : 0) +
                    (osProductTotal >= 7000 ? 5 : 0)

      if (salesCount > 0 || osCount > 0) {
        console.log(`[${s.id}] "${s.name || '?'}": vendas=${salesCount}  OS=${osCount}  R$Vendas=${salesTotal.toFixed(0)}  R$OS.products=${osProductTotal.toFixed(0)}  FINALIZADAS=${osCountFinalizadas}`)
      }
      if (score > bestScore) {
        bestScore = score
        bestStore = { store: s, salesCount, osCount, salesTotal, osProductTotal, sampledSaleItem, osCountFinalizadas }
      }

    } catch (e) {
      // loja sem coleção orders ou erro — skip
    }
  }

  console.log('\n\n==============================\nMELHOR LOJA ENCONTRADA:')
  if (bestStore) {
    const s = bestStore.store
    console.log(`id=${s.id}  name="${s.name}"`)
    console.log(`vendas no período = ${bestStore.salesCount}  (alvo = 49)`)
    console.log(`OS no período     = ${bestStore.osCount}     (alvo = 71)`)
    console.log(`OS finalizadas    = ${bestStore.osCountFinalizadas}`)
    console.log(`R$ vendas         = ${bestStore.salesTotal.toFixed(2)}  (alvo = 12786.80)`)
    console.log(`R$ OS.products    = ${bestStore.osProductTotal.toFixed(2)}  (alvo = 8135.10)`)
    if (bestStore.sampledSaleItem) {
      console.log('\n1º item de venda (keys): ' + bestStore.sampledSaleItem.keys)
      console.log(JSON.stringify(bestStore.sampledSaleItem.sample, null, 2))
    }

    // Inspeciona 3 produtos / variações + detalhes de 1 venda
    try {
      const pSnap = await getDocs(query(collection(db, `stores/${s.id}/products`), limit(5)))
      const prods = pSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      console.log(`\nProdutos cadastrados (lim 5): ${prods.length}`)
      for (const p of prods.slice(0, 3)) {
        console.log(`\nPRODUTO id=${p.id}  name="${p.name || '?'}"`)
        console.log(`  keys: ${Object.keys(p).sort().join(',')}`)
        for (const k of Object.keys(p).sort()) {
          if (/cost|preco|purchase|price|valor|name|id/i.test(k)) {
            const v = p[k]
            const label = Array.isArray(v)
              ? `(array len=${v.length})  -> ${JSON.stringify(v.slice(0, 20)).slice(0, 180)}`
              : typeof v === 'object' && v ? JSON.stringify(v).slice(0, 150) : v
            console.log(`  ${k}: ${label}`)
          }
        }
        if (Array.isArray(p.variationsData) && p.variationsData.length > 0) {
          const v = p.variationsData[0]
          console.log(`  1a VARIAÇÃO (keys: ${Object.keys(v).join(',')})`)
          for (const k of Object.keys(v)) {
            if (/cost|preco|purchase|price|valor|name|label|stock|active|promo|sale/i.test(k)) {
              console.log(`    ${k}: ${k === 'name' || k === 'label' ? String(v[k]).slice(0, 120) : v[k]}`)
            }
          }
        }
      }
    } catch (e) {
      console.log(`produtos err: ${e.code}`)
    }
  } else {
    console.log('nenhuma loja com dados no período...')
  }
}

main().catch(e => {
  console.error('ERR:', e.code || e.message, e)
  process.exit(1)
})
