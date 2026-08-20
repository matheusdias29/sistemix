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

const D_2026_05_01 = new Date(2026, 4, 1)
const D_2026_08_31 = new Date(2026, 7, 31, 23, 59, 59)

function toD(raw) {
  if (!raw) return null
  try {
    if (typeof raw.toDate === 'function') return raw.toDate()
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? null : d
  } catch { return null }
}
function okP(d) { return d && d >= D_2026_05_01 && d <= D_2026_08_31 }

async function tryDb(dbIdLabel) {
  const app = initializeApp(firebaseConfig, `app-${Math.random().toString(36).slice(2, 8)}`)
  const opts = { ignoreUndefinedProperties: true }
  const db = (dbIdLabel === '(default)')
    ? initializeFirestore(app, opts)   // sem 3º arg = banco default
    : initializeFirestore(app, opts, dbIdLabel)
  const auth = getAuth(app)
  await signInAnonymously(auth)

  const storesSnap = await getDocs(query(collection(db, 'stores'), limit(50)))
  const stores = storesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  console.log(`\n${'='.repeat(70)}`)
  console.log(`DB-ID="${dbIdLabel}"  -> total lojas=${stores.length}`)
  console.log('='.repeat(70))

  for (const s of stores) {
    try {
      const oSnap = await getDocs(query(collection(db, `stores/${s.id}/orders`), limit(300)))
      const ol = oSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      let salesC = 0, salesR$ = 0, osC = 0, osProdR$ = 0, osFim = 0
      for (const o of ol) {
        if (!okP(toD(o.createdAt) || toD(o.updatedAt) || toD(o.date))) continue
        const st = String(o.status || '').toLowerCase()
        const tp = String(o.type || '').toLowerCase()
        if (tp === 'sale' || st.includes('venda') || st.includes('cliente final') || st.includes('cliente lojista')) {
          salesC++
          salesR$ += Number(o.valor ?? o.total ?? o.totalProducts ?? 0)
        }
        if (tp === 'service_order' || st.includes('os ') || st.includes('o.s.') || st.includes('finalizada') || st.includes('iniciado')) {
          osC++
          osProdR$ += Number(o.totalProducts ?? o.totalProductsValue ?? 0)
          if (st.includes('finalizada')) osFim++
        }
      }
      if (salesC > 0 || osC > 0) {
        console.log(`  [${s.id}] "${s.name || '?'}"  -> vendas=${salesC} R$${salesR$.toFixed(2)} | OS=${osC} R$prod=${osProdR$.toFixed(2)} finalizadas=${osFim}`)
        if (salesC >= 40 && salesC <= 60 && osC >= 60 && osC <= 90) {
          console.log(`  👆 LOJA CANDIDATA!!!`)
        }
      }
    } catch (e) { /* skip */ }
  }
}

async function main() {
  for (const dbid of ['(default)', 'sistemix', 'sixtemix', 'sistemix-db', 'production', 'main']) {
    try {
      await tryDb(dbid)
    } catch (e) {
      console.log(`DB ${dbid} ERR: ${e.code || e.message}`)
    }
  }
}
main().catch(e => { console.error('FATAL:', e.code || e.message, e); process.exit(1) })
