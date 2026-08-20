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

const D_2026_05_01 = new Date(2026, 4, 1)
const D_2026_08_31 = new Date(2026, 7, 31, 23, 59, 59)

function isSale(o) {
  const s = String(o.status || '').toLowerCase()
  const t = String(o.type || '').toLowerCase()
  return t === 'sale' || s.includes('venda') || s.includes('cliente final') || s.includes('cliente lojista')
}

function isOS(o) {
  const s = String(o.status || '').toLowerCase()
  const t = String(o.type || '').toLowerCase()
  return (
    t === 'service_order' ||
    s.includes('os ') ||
    s.includes('o.s.') ||
    s.includes('finalizada') ||
    s.includes('iniciado')
  )
}

function toD(raw) {
  if (!raw) return null
  try {
    if (typeof raw.toDate === 'function') return raw.toDate()
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

function okPeriod(d) {
  return d && d >= D_2026_05_01 && d <= D_2026_08_31
}

function truncate(v, n = 160) {
  if (v === undefined || v === null) return v
  if (Array.isArray(v)) return `(array len=${v.length}) -> ` + JSON.stringify(v.slice(0, 30)).slice(0, n)
  if (typeof v === 'object') return JSON.stringify(v).slice(0, n)
  return v
}

async function scanStoreById(storeId, storeName) {
  console.log(`\n--- ANALISANDO LOJA: id=${storeId}  name="${storeName}" ---`)

  // =============== PRODUTOS ===============
  let prodKeys = new Set()
  let sampleProd = null
  try {
    const pSnap = await getDocs(query(collection(db, `stores/${storeId}/products`), limit(8)))
    const pl = pSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    for (const p of pl) Object.keys(p).forEach(k => prodKeys.add(k))
    console.log(`produtos (lim 8): ${pl.length}`)
    console.log(`chaves de produto: ${[...prodKeys].sort().join(', ')}`)
    if (pl.length > 0) {
      sampleProd = pl[0]
      console.log(`\nPRODUTO 1: id=${sampleProd.id}  name="${sampleProd.name || '?'}"`)
      for (const k of [...prodKeys].sort()) {
        if (/name|id|cost|preco|purchase|price|valor|category|salePrice|promoPrice/i.test(k)) {
          console.log(`  ${k}: ${truncate(sampleProd[k], 200)}`)
        }
      }
      if (Array.isArray(sampleProd.variationsData) && sampleProd.variationsData.length > 0) {
        const v = sampleProd.variationsData[0]
        console.log(`  var[0] keys: ${Object.keys(v).join(', ')}`)
        for (const k of Object.keys(v)) {
          if (/cost|preco|purchase|price|valor|name|label|promo|sale|stock|active|purchasePrice|costPrice/i.test(k)) {
            console.log(`    var.${k}: ${truncate(v[k], 160)}`)
          }
        }
      }
    }
  } catch (e) {
    console.log('produtos ERR:', e.code || e.message)
  }

  // =============== ORDERS ===============
  let osKeys = new Set()
  let orderItemKeys = new Set()
  let sampledSaleItem = null
  let sampledOsItem = null
  try {
    const oSnap = await getDocs(query(collection(db, `stores/${storeId}/orders`), limit(300)))
    const ol = oSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    console.log(`\norders (lim 300): ${ol.length}`)

    let totalSales = 0, salesCount = 0, salesSum = 0
    let osCount = 0, osProductSum = 0, osFinished = 0
    for (const o of ol) {
      const d = toD(o.createdAt) || toD(o.updatedAt) || toD(o.date)
      if (!okPeriod(d)) continue
      Object.keys(o).forEach(k => osKeys.add(k))
      if (Array.isArray(o.products)) {
        for (const p of o.products) Object.keys(p).forEach(k => orderItemKeys.add(k))
      }

      if (isSale(o)) {
        salesCount++
        salesSum += Number(o.valor ?? o.total ?? o.totalProducts ?? 0)
        if (!sampledSaleItem && Array.isArray(o.products) && o.products.length > 0) {
          sampledSaleItem = {
            orderId: o.id,
            orderStatus: o.status,
            orderType: o.type,
            itemKeys: Object.keys(o.products[0]).join(','),
            sample: Object.fromEntries(Object.entries(o.products[0]).slice(0, 20)),
            orderTotal: o.total,
            orderValor: o.valor,
            orderTotalProducts: o.totalProducts,
          }
        }
      }
      if (isOS(o)) {
        osCount++
        osProductSum += Number(o.totalProducts ?? o.totalProductsValue ?? 0)
        if (String(o.status || '').toLowerCase().includes('finalizada')) osFinished++
        if (!sampledOsItem && Array.isArray(o.products) && o.products.length > 0) {
          sampledOsItem = {
            orderId: o.id,
            status: o.status,
            itemKeys: Object.keys(o.products[0]).join(','),
            sample: Object.fromEntries(Object.entries(o.products[0]).slice(0, 20)),
          }
        }
      }
    }
    totalSales = salesSum
    console.log(`chaves de order: ${[...osKeys].sort().join(', ')}`)
    console.log(`chaves de ITEM (products[i]): ${[...orderItemKeys].sort().join(', ')}`)
    console.log('')
    console.log(`VENDAS período:  count=${salesCount}   R$=${totalSales.toFixed(2)}`)
    console.log(`OS período:      count=${osCount}   osProductSum=${osProductSum.toFixed(2)}   finalizadas=${osFinished}`)

    if (sampledSaleItem) {
      console.log('\nAMOSTRA 1 VENDA (primeira do período com produto):')
      console.log(`  orderId=${sampledSaleItem.orderId} status=${sampledSaleItem.orderStatus} type=${sampledSaleItem.orderType}`)
      console.log(`  total=${sampledSaleItem.orderTotal}  valor=${sampledSaleItem.orderValor}  totalProducts=${sampledSaleItem.orderTotalProducts}`)
      console.log(`  item keys: ${sampledSaleItem.itemKeys}`)
      console.log(`  item sample: ${JSON.stringify(sampledSaleItem.sample, null, 2)}`)
    }
    if (sampledOsItem) {
      console.log('\nAMOSTRA 1 OS (primeira com produtos):')
      console.log(`  orderId=${sampledOsItem.orderId} status=${sampledOsItem.status}`)
      console.log(`  item keys: ${sampledOsItem.itemKeys}`)
      console.log(`  item sample: ${JSON.stringify(sampledOsItem.sample, null, 2)}`)
    }

  } catch (e) {
    console.log('orders ERR:', e.code || e.message, String(e).slice(0, 300))
  }
}

async function main() {
  console.log('=== DIAG COST (single store) ===')
  console.log('Banco: ' + dbId)
  try {
    await signInAnonymously(auth)
    console.log('✔ Autenticado.\n')
  } catch (e) {
    console.error('❌ auth:', e.code)
    process.exit(1)
  }

  const target = process.env.LOJA_ID || 'DPyMoNNrkdgOKWOK2FR0'   // default = loja 19 (lok MANUTENÇÕES)
  const name = process.env.LOJA_NAME || 'Lokatell Manutenções e Distribuidora'
  await scanStoreById(target, name)
}

main().catch(e => {
  console.error('\nERR:', e.code || e.message)
  console.error(e)
  process.exit(1)
})
