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
import fs from 'fs'
import path from 'path'

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

async function chooseStoreInteractive() {
  const storesSnap = await getDocs(collection(db, 'stores'))
  const stores = storesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  if (stores.length === 0) {
    console.log('❌ Nenhuma loja encontrada.')
    process.exit(1)
  }

  console.log('\nLojas disponíveis:')
  stores.forEach((s, i) => console.log(`${i + 1}. ${s.name || '(sem nome)'} [${s.id}]`))

  const input = (await question('\nSelecione pelo número ou cole o storeId: ')).trim()
  if (!input) throw new Error('Loja não informada')
  if (/^\d+$/.test(input)) {
    const store = stores[parseInt(input, 10) - 1]
    if (!store) throw new Error('Loja inválida')
    return store
  }
  const byId = stores.find(s => s.id === input)
  return byId || { id: input, name: input }
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

async function main() {
  console.log('==========================================')
  console.log(' ZERAR ESTOQUE DE PRODUTOS DE UMA LOJA ')
  console.log('==========================================')
  console.log('→ ESTRATÉGIA DE ESTOQUE: UNIFICADO (não separado por variação)')
  console.log('   → Produto PRINCIPAL e TODAS as suas variações recebem o MESMO valor.')
  console.log('   → Alinha com o padrão do fix_unified_stock_cli (corrige divergências).')
  console.log('→ Zera: stock, stockInitial, stockMin (produto + cada variação)')
  console.log('→ NÃO apaga produtos, NÃO altera nome/preço/categoria/ativo.')
  console.log('→ Backup JSON é salvo ANTES de qualquer alteração.\n')

  try {
    await signInAnonymously(auth)
    console.log('✔ Autenticado.')
  } catch (e) {
    console.error('❌ Falha na autenticação:', e.code)
    process.exit(1)
  }

  const store = await chooseStoreInteractive()
  console.log(`\n✔ Loja selecionada: ${store.name || '(sem nome)'} [${store.id}]`)

  const products = await getAllProductsByStore(store.id)
  if (products.length === 0) {
    console.log('❌ Nenhum produto encontrado nesta loja.')
    rl.close()
    process.exit(0)
  }

  // =====================================================================
  // BACKUP: salva JSON dos valores ATUAIS de estoque ANTES de qualquer mudança
  // (para permitir rollback manual se necessário)
  // =====================================================================
  const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  const backupFileName = `backup_stock_${store.id}_${ts}.json`
  const backupPath = path.resolve(process.cwd(), 'scripts', backupFileName)

  const backupEntries = products.map(p => {
    const hasVars = Array.isArray(p.variationsData) && p.variationsData.length > 0
    return {
      id: p.id,
      name: p.name || '',
      stockBefore:        Number(p.stock        ?? (Number(p.stockInitial ?? 0))),
      stockInitialBefore: Number(p.stockInitial ?? 0),
      stockMinBefore:     Number(p.stockMin     ?? 0),
      variationsDataBefore: hasVars ? p.variationsData.map(v => ({
        name:          v?.name || '',
        stock:         Number(v?.stock         ?? (Number(v?.stockInitial ?? 0))),
        stockInitial:  Number(v?.stockInitial ?? 0),
        stockMin:      Number(v?.stockMin     ?? 0),
      })) : null
    }
  })

  fs.writeFileSync(backupPath, JSON.stringify(backupEntries, null, 2), 'utf-8')
  console.log(`💾 Backup de estoque salvo em: scripts/${backupFileName}`)

  // Resumo prévio
  let totalStockBefore = 0
  let productsWithStock = 0
  let productsWithVariations = 0
  for (const p of products) {
    const cur = Number(p.stock ?? (Number(p.stockInitial ?? 0)))
    if (cur > 0) {
      totalStockBefore += cur
      productsWithStock++
    }
    if (Array.isArray(p.variationsData) && p.variationsData.length > 0) {
      productsWithVariations++
    }
  }
  console.log(`\n📊 Resumo:`)
  console.log(`   Total de produtos:              ${products.length}`)
  console.log(`   Produtos com estoque > 0:       ${productsWithStock}`)
  console.log(`   Soma do estoque (principal):    ${totalStockBefore}`)
  console.log(`   Produtos com variações:         ${productsWithVariations}`)

  const confirm1 = await question(`\n⚠️  TEM CERTEZA que deseja ZERAR TODO o estoque (principal + variações) dos ${products.length} produtos da loja acima?\nDigite exatamente ZERAR para confirmar: `)
  if (confirm1.trim() !== 'ZERAR') {
    console.log('❌ Cancelado. Backup salvo pode ser apagado se não for necessário.')
    rl.close()
    process.exit(0)
  }

  const confirm2 = await question(`\n🔴 ÚLTIMA CONFIRMAÇÃO: escreva SIM para prosseguir e zerar tudo: `)
  if (confirm2.trim().toLowerCase() !== 'sim') {
    console.log('❌ Cancelado.')
    rl.close()
    process.exit(0)
  }

  // =====================================================================
  // Aplicação em lote (writeBatch de 400 em 400 — limite Firestore = 500)
  // =====================================================================
  console.log('\n🔄 Zerando estoques em lotes...')
  const BATCH_SIZE = 400
  let processed = 0
  let updated = 0

  for (let offset = 0; offset < products.length; offset += BATCH_SIZE) {
    const chunk = products.slice(offset, offset + BATCH_SIZE)
    const batch = writeBatch(db)
    let batchOps = 0

    for (const p of chunk) {
      processed++
      // ==================================================================
      // ESTRATÉGIA: ESTOQUE UNIFICADO (NÃO separado por variação)
      // ==================================================================
      // Alinhado com fix_unified_stock_cli.mjs:
      //   - Produto PRINCIPAL (stock, stockInitial, stockMin) = 0
      //   - TODAS as variações (v.stock, v.stockInitial, v.stockMin) = 0
      //   - TODOS recebem o MESMO valor → mantém consistência.
      // ==================================================================
      const patch = {
        stock: 0,
        stockInitial: 0,
        stockMin: 0,
        updatedAt: serverTimestamp(),
      }
      if (Array.isArray(p.variationsData) && p.variationsData.length > 0) {
        patch.variationsData = p.variationsData.map(v => ({
          ...v,
          stock: 0,
          stockInitial: 0,
          stockMin: 0,
        }))
      }
      batch.update(doc(db, 'products', p.id), patch)
      batchOps++
      updated++
    }

    if (batchOps > 0) {
      await batch.commit()
    }
    process.stdout.write(`\rProcessados: ${processed}/${products.length} | Zerados: ${updated}`)
  }

  console.log(`\n\n✅ Concluído com sucesso!`)
  console.log(`   Produtos processados:    ${processed}`)
  console.log(`   Produtos com estoque=0:  ${updated}`)
  console.log(`   Backup (rollback):       scripts/${backupFileName}`)
  console.log(`\n💡 Dica: invalidar cache local dos usuários (botão "Atualizar" na página Produtos) para refletir imediatamente.`)

  rl.close()
  setTimeout(() => process.exit(0), 500)
}

main().catch(e => {
  console.error('\n❌ Erro fatal:', e?.message || e)
  process.exit(1)
})
