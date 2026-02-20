import { initializeApp } from 'firebase/app'
import { initializeFirestore, collection, getDocs, query, where, limit, startAfter, writeBatch } from 'firebase/firestore'
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

async function main() {
  console.log('=== Inativar todos os produtos (CLI) ===')
  try {
    await signInAnonymously(auth)
    console.log('✔ Autenticado.')
  } catch (e) {
    console.error('❌ Falha na autenticação:', e.code)
    process.exit(1)
  }

  const storesSnap = await getDocs(collection(db, 'stores'))
  const stores = storesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  if (stores.length === 0) {
    console.log('❌ Nenhuma loja encontrada.')
    process.exit(1)
  }

  console.log('\nLojas disponíveis:')
  stores.forEach((s, i) => console.log(`${i + 1}. ${s.name}`))
  const idx = await question('\nSelecione a loja (número): ')
  const store = stores[parseInt(idx) - 1]
  if (!store) {
    console.log('❌ Loja inválida.')
    process.exit(1)
  }
  console.log(`✔ Loja: ${store.name}`)

  const confirm = await question(`\nIsto irá definir active = false para TODOS os produtos da loja ${store.name}. Continuar? (s/n): `)
  if (confirm.toLowerCase() !== 's') {
    console.log('Cancelado.')
    process.exit(0)
  }

  console.log('\n🔄 Iniciando processamento...')
  const BATCH_SIZE = 400
  let totalChecked = 0
  let totalUpdated = 0
  let lastDoc = null

  while (true) {
    let qy = query(
      collection(db, 'products'),
      where('storeId', '==', store.id),
      limit(BATCH_SIZE)
    )
    if (lastDoc) {
      qy = query(
        collection(db, 'products'),
        where('storeId', '==', store.id),
        startAfter(lastDoc),
        limit(BATCH_SIZE)
      )
    }

    const snap = await getDocs(qy)
    if (snap.empty) break

    const batch = writeBatch(db)
    let ops = 0

    for (const d of snap.docs) {
      const data = d.data()
      totalChecked++
      if (data?.active !== false) {
        batch.update(d.ref, { active: false, updatedAt: new Date() })
        ops++
        totalUpdated++
      }
    }

    if (ops > 0) {
      await batch.commit()
    }

    process.stdout.write(`\rVerificados: ${totalChecked} | Atualizados (active=false): ${totalUpdated}`)
    lastDoc = snap.docs[snap.docs.length - 1]
  }

  console.log(`\n\n✅ Concluído.`)
  console.log(`Total verificados: ${totalChecked}`)
  console.log(`Total atualizados: ${totalUpdated}`)

  rl.close()
  setTimeout(() => process.exit(0), 500)
}

main().catch(e => {
  console.error('Erro fatal:', e)
  process.exit(1)
})

