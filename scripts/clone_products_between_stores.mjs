import { initializeApp } from 'firebase/app'
import { initializeFirestore, collection, getDocs, query, where, writeBatch, serverTimestamp, doc } from 'firebase/firestore'
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
  console.log('\n🚀 === CLONAR PRODUTOS ENTRE LOJAS (CLI) ===')
  
  try {
    await signInAnonymously(auth)
    console.log('✔ Autenticado.')
  } catch (e) {
    console.error('❌ Falha na autenticação:', e.code)
    process.exit(1)
  }

  // Listar lojas
  const storesSnap = await getDocs(collection(db, 'stores'))
  const stores = storesSnap.docs.map(d => ({ id: d.id, name: d.data().name }))
  
  if (stores.length < 2) {
    console.log('❌ É necessário pelo menos duas lojas no sistema para realizar a clonagem.')
    process.exit(1)
  }

  console.log('\nLojas disponíveis:')
  stores.forEach((s, i) => console.log(`${i + 1}. ${s.name} (ID: ${s.id})`))

  const fromIdx = await question('\nSelecione a loja de ORIGEM (número): ')
  const storeFrom = stores[parseInt(fromIdx) - 1]
  if (!storeFrom) {
    console.log('❌ Seleção de origem inválida.')
    process.exit(1)
  }

  const toIdx = await question('Selecione a loja de DESTINO (número): ')
  const storeTo = stores[parseInt(toIdx) - 1]
  if (!storeTo) {
    console.log('❌ Seleção de destino inválida.')
    process.exit(1)
  }

  if (storeFrom.id === storeTo.id) {
    console.log('❌ A loja de origem não pode ser a mesma de destino.')
    process.exit(1)
  }

  console.log(`\n➡ Origem: ${storeFrom.name}`)
  console.log(`➡ Destino: ${storeTo.name}`)
  console.log('ℹ Todos os produtos serão clonados com status INATIVO.\n')

  const confirm = await question('Deseja prosseguir com a clonagem? (s/n): ')
  if (confirm.toLowerCase() !== 's') {
    console.log('Operação cancelada.')
    process.exit(0)
  }

  // Buscar produtos da origem
  console.log('\n⏳ Buscando produtos da loja de origem...')
  const qProducts = query(collection(db, 'products'), where('storeId', '==', storeFrom.id))
  const productsSnap = await getDocs(qProducts)
  
  if (productsSnap.empty) {
    console.log('❌ Nenhum produto encontrado na loja de origem.')
    process.exit(0)
  }

  const products = productsSnap.docs.map(d => ({ ...d.data() }))
  console.log(`✔ ${products.length} produtos encontrados. Iniciando clonagem...`)

  let count = 0
  let batch = writeBatch(db)
  const productsRef = collection(db, 'products')

  for (const productData of products) {
    // Preparar dados para o clone
    const clonedProduct = {
      ...productData,
      storeId: storeTo.id,
      active: false, // Forçar inativo
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      // Caso existam referências a IDs específicos da loja original, 
      // como categorias ou fornecedores, eles serão mantidos como strings.
      // Se a loja de destino não tiver os mesmos IDs de categoria, 
      // os produtos ficarão sem categoria válida na UI até serem editados.
    }

    // Remover o ID do documento original se ele estiver nos dados (não queremos sobrescrever docs)
    delete clonedProduct.id

    const newDocRef = doc(productsRef)
    batch.set(newDocRef, clonedProduct)
    
    count++
    
    // Firestore batch limit is 500 operations
    if (count % 500 === 0) {
      console.log(`   ...enviando lote (${count}/${products.length})...`)
      await batch.commit()
      batch = writeBatch(db)
    }
  }

  // Commit final
  if (count % 500 !== 0) {
    await batch.commit()
  }

  console.log(`\n✅ SUCESSO! ${count} produtos clonados para a loja "${storeTo.name}" como inativos.`)
  rl.close()
  process.exit(0)
}

main().catch(err => {
  console.error('\n❌ Erro crítico no script:', err)
  process.exit(1)
})
