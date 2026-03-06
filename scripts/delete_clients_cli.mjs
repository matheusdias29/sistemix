import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import {
  collection,
  documentId,
  getDocs,
  initializeFirestore,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  writeBatch
} from 'firebase/firestore'
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

const args = new Set(process.argv.slice(2))
if (args.has('--help') || args.has('-h')) {
  console.log(`Uso:
  node scripts/delete_clients_cli.mjs

O script lista as lojas, você escolhe uma, e ele deleta TODOS os documentos da coleção "clients" dessa loja.`)
  process.exit(0)
}

const app = initializeApp(firebaseConfig)
const dbId = process.env.FIRESTORE_DB_ID || 'sistemix'
const db = initializeFirestore(app, { ignoreUndefinedProperties: true }, dbId)
console.log(`Usando Firestore databaseId: ${dbId}`)
const auth = getAuth(app)

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (text) => new Promise((resolve) => rl.question(text, resolve))

async function main() {
  console.log('=== Deletar TODOS os clientes (CLI) ===')

  try {
    console.log('Autenticando...')
    await signInAnonymously(auth)
    console.log('Autenticado como convidado (Anônimo).')
  } catch (error) {
    console.warn('Aviso: Autenticação anônima falhou ou não está habilitada.', error?.code)
    console.log('Tentando prosseguir sem autenticação...')
  }

  console.log('\nBuscando lojas...')
  const storesSnapshot = await getDocs(collection(db, 'stores'))
  const stores = storesSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))

  if (stores.length === 0) {
    console.log('Nenhuma loja encontrada.')
    rl.close()
    setTimeout(() => process.exit(1), 100)
    return
  }

  console.log('\nLojas disponíveis:')
  stores.forEach((store, index) => {
    console.log(`${index + 1}. ${store.name || '(sem nome)'} (ID: ${store.id})`)
  })

  const storeIndex = await question('\nSelecione o número da loja para DELETAR todos os clientes: ')
  const selectedStore = stores[parseInt(storeIndex) - 1]

  if (!selectedStore) {
    console.log('Loja inválida.')
    rl.close()
    setTimeout(() => process.exit(1), 100)
    return
  }

  console.log(`\nLoja selecionada: ${selectedStore.name || '(sem nome)'} (ID: ${selectedStore.id})`)
  const confirm = await question('ATENÇÃO: isso vai DELETAR permanentemente todos os clientes desta loja. Digite DELETAR para confirmar: ')
  if (String(confirm).trim().toUpperCase() !== 'DELETAR') {
    console.log('Cancelado.')
    rl.close()
    setTimeout(() => process.exit(0), 100)
    return
  }

  const BATCH_SIZE = 400
  let deleted = 0
  let lastDoc = null

  console.log('\nDeletando...')
  while (true) {
    let q = query(
      collection(db, 'clients'),
      where('storeId', '==', selectedStore.id),
      orderBy(documentId()),
      limit(BATCH_SIZE)
    )

    if (lastDoc) {
      q = query(q, startAfter(lastDoc))
    }

    const snap = await getDocs(q)
    if (snap.empty) break

    const batch = writeBatch(db)
    for (const d of snap.docs) batch.delete(d.ref)
    await batch.commit()

    deleted += snap.size
    lastDoc = snap.docs[snap.docs.length - 1]
    console.log(`Progresso: ${deleted} clientes deletados...`)
  }

  console.log(`\nConcluído! Total deletado: ${deleted} clientes.`)
  rl.close()
  setTimeout(() => process.exit(0), 100)
}

main().catch((err) => {
  console.error('Erro inesperado:', err)
  rl.close()
  setTimeout(() => process.exit(1), 100)
})
