import { initializeApp } from 'firebase/app'
import { initializeFirestore, collection, getDocs, query, where, limit, orderBy, doc, updateDoc } from 'firebase/firestore'
import { getAuth, signInAnonymously } from 'firebase/auth'
import readline from 'readline'

// =========== CONFIG FIREBASE ===========
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

// =========== HELPERS GLOBAIS (MESMA LOGICA StatisticsPage.tsx) ===========
function norm(s) {
  if (!s) return ''
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const COST_FIELD_NAMES = [
  'cost', 'purchasePrice', 'costPrice',
  'precoCusto', 'custoCompra', 'custoProduto', 'valorCusto', 'valorCompra',
  'precoCompra', 'custoUnitario', 'custo',
  'priceCost', 'buyPrice', 'buyingPrice',
  'custoTotalUnitario', 'valorUnitarioCompra'
]
const COST_REGEX = /custo|compra|purchase|costprice|buyprice|precocusto/i
const extractCost = (obj) => {
  if (!obj || typeof obj !== 'object') return 0
  for (const key of COST_FIELD_NAMES) {
    const v = Number(obj[key] || 0)
    if (isFinite(v) && v > 0) return v
  }
  for (const k of Object.keys(obj)) {
    if (!COST_REGEX.test(k)) continue
    const val = Number(obj[k] || 0)
    if (isFinite(val) && val > 0) return val
  }
  // nested: obj.product.* etc
  for (const k of Object.keys(obj)) {
    const sub = obj[k]
    if (!sub || typeof sub !== 'object' || Array.isArray(sub)) continue
    for (const key of COST_FIELD_NAMES) {
      const v = Number(sub[key] || 0)
      if (isFinite(v) && v > 0) return v
    }
    for (const sk of Object.keys(sub)) {
      if (!COST_REGEX.test(sk)) continue
      const val = Number(sub[sk] || 0)
      if (isFinite(val) && val > 0) return val
    }
  }
  return 0
}

function stripVariationFromItemName(fullName) {
  const s = String(fullName || '').trim()
  if (!s) return { clean: '', suffix: '' }
  const patterns = [/\s+[-–—|:]+\s+.+$/, /\s+[-–—|:]\S.*$/]
  for (const re of patterns) {
    const m = s.match(re)
    if (m && m.index !== undefined) {
      return {
        clean: s.substring(0, m.index).trim(),
        suffix: s.substring(m.index).trim()
      }
    }
  }
  return { clean: s, suffix: '' }
}

const VARIATION_LIKE_FIELDS = [
  'variationsData', 'variations', 'variacoes', 'varData',
  'precificacoes', 'precificacaoList', 'pricingSpecs', 'pricingSpecifications',
  'especificacoes', 'especificacoesPrecificacao', 'specifications',
  'especificacaoPrecos', 'prices', 'priceList', 'priceOptions', 'variants',
  'itemOptions', 'options', 'specPrices', 'variationPrices',
  'precificacoesAtivas', 'activePricings', 'activeVariations'
]

const getVariationArrays = (prod) => {
  if (!prod || typeof prod !== 'object') return []
  const result = []
  for (const f of VARIATION_LIKE_FIELDS) {
    const arr = prod[f]
    if (Array.isArray(arr) && arr.length > 0) result.push({ field: f, arr })
  }
  // fallback: qualquer array de objetos com nome
  for (const k of Object.keys(prod)) {
    if (VARIATION_LIKE_FIELDS.includes(k)) continue
    const arr = prod[k]
    if (!Array.isArray(arr) || arr.length === 0) continue
    if (arr.some(x => x && typeof x === 'object' && (x.name || x.label || x.titulo))) {
      result.push({ field: k, arr })
    }
  }
  return result
}

function resolveProdCost(prod, variationName, preferedVarId) {
  if (!prod) return { cost: 0, how: 'prod-null' }
  const vName = String(variationName || '').trim()
  const vNameNorm = norm(vName)
  const varArrays = getVariationArrays(prod)

  const tryMatchById = (list) => {
    if (!preferedVarId) return null
    for (const x of list) {
      if (!x || typeof x !== 'object') continue
      for (const k of ['id','_id','originalId','variationId','varId','productId','sku','codigo','cod','code','especificacaoId','precificacaoId']) {
        if (x[k] && String(x[k]) === String(preferedVarId)) return x
      }
    }
    return null
  }
  const tryMatchByNameExact = (list) => {
    if (!vName) return null
    for (const x of list) {
      if (!x || typeof x !== 'object') continue
      const lblA = String(x.name || x.label || x.titulo || '').trim()
      const lblB = norm(x.name || x.label || x.titulo || '')
      if (lblA === vName || lblB === vNameNorm) return x
    }
    return null
  }
  const tryMatchByNameFuzzy = (list) => {
    if (!vName) return null
    for (const x of list) {
      if (!x || typeof x !== 'object') continue
      const lbl = norm(x.name || x.label || x.titulo || '')
      if (lbl && (vNameNorm.includes(lbl) || lbl.includes(vNameNorm))) return x
    }
    return null
  }
  const anyVarWithCost = (list) => {
    for (const x of list) {
      const c = extractCost(x)
      if (c > 0) return c
    }
    return 0
  }

  if (varArrays.length > 0) {
    if (preferedVarId) {
      for (const la of varArrays) {
        const v = tryMatchById(la.arr)
        if (v) {
          const uc = extractCost(v)
          if (uc > 0) return { cost: uc, how: `prec(${la.field})-por-id` }
        }
      }
    }
    if (vName) {
      for (const la of varArrays) {
        const v = tryMatchByNameExact(la.arr)
        if (v) {
          const uc = extractCost(v)
          if (uc > 0) return { cost: uc, how: `prec(${la.field})-nome-exato` }
        }
      }
    }
    if (vName) {
      for (const la of varArrays) {
        const v = tryMatchByNameFuzzy(la.arr)
        if (v) {
          const uc = extractCost(v)
          if (uc > 0) return { cost: uc, how: `prec(${la.field})-nome-fuzzy` }
        }
      }
    }
    for (const la of varArrays) {
      const c = anyVarWithCost(la.arr)
      if (c > 0) return { cost: c, how: `prec(${la.field})-qualquer` }
    }
  }
  const pCost = extractCost(prod)
  if (pCost > 0) return { cost: pCost, how: 'produto-pai' }
  return { cost: 0, how: 'sem-custo' }
}

async function listStores() {
  const q = query(collection(db, 'stores'), orderBy('createdAt', 'desc'), limit(30))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// 500 items max per batch in Firestore; vamos fazer por doc por vez para simplicidade
async function main() {
  const argv = process.argv.slice(2)
  const APPLY_MODE = argv.includes('--apply')
  console.log('=== MIGRAÇÃO DE CUSTOS HISTÓRICOS DE VENDAS/OS ===')
  console.log(`Banco Firestore em uso: ${dbId}`)
  console.log(`Modo: ${APPLY_MODE ? '⛔ APLICAR ALTERAÇÕES (gravação real no Firestore)' : '🧪 DRY-RUN (simulação, sem gravar nada)'}`)
  if (!APPLY_MODE) console.log(`  -> Para realmente gravar, rode: node.exe scripts/migrate_historical_costs.mjs --apply\n`)
  try {
    await signInAnonymously(auth)
    console.log('✔ Autenticado.\n')
  } catch (e) {
    console.error('❌ Falha na autenticação:', e.code, e.message)
    process.exit(1)
  }

  const stores = await listStores()
  if (stores.length === 0) {
    console.log('Nenhuma loja encontrada.')
    process.exit(0)
  }

  console.log('Escolha a loja para migrar os custos:')
  stores.forEach((s, i) => {
    console.log(`  [${i + 1}] id=${s.id}   name="${s.name || 'Sem nome'}"`)
  })
  let storeIdx = stores.findIndex(s =>
    String(s.name || '').toLowerCase().includes('manuten') && String(s.name || '').toLowerCase().includes('lokate')
  )
  if (storeIdx < 0) storeIdx = stores.findIndex(s => String(s.name || '').toLowerCase().includes('lokate'))
  if (storeIdx < 0) storeIdx = 0
  const ans = await question(`\nNúmero da loja [padrão ${storeIdx + 1}]: `)
  const n = parseInt(String(ans || '').trim(), 10)
  if (!isNaN(n) && n >= 1 && n <= stores.length) storeIdx = n - 1
  const store = stores[storeIdx]
  console.log(`\nLoja selecionada [${storeIdx + 1}]: ${store.name} (id=${store.id})\n`)

  // 1. Carregar TODOS os produtos (sem limit)
  process.stdout.write('Carregando TODOS os produtos da loja... ')
  const productsQ = query(collection(db, 'products'), where('storeId', '==', store.id), limit(5000))
  const productsSnap = await getDocs(productsQ)
  const productsArr = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  console.log(`${productsArr.length} produtos carregados.`)
  if (productsArr.length === 0) {
    console.log('⚠ Nenhum produto cadastrado. Cancelando.')
    process.exit(0)
  }

  // Criar indices: ids, nomes, tokens
  const productsIndexed = productsArr.map(p => {
    const ids = [p.id, p.productId, p.originalId, p.codigo, p.cod, p.sku, p.code].filter(Boolean).map(String)
    const varIds = []
    for (const la of getVariationArrays(p)) {
      for (const v of la.arr) {
        if (!v || typeof v !== 'object') continue
        for (const k of ['id','_id','originalId','variationId','varId','productId','sku','codigo','cod','code','especificacaoId','precificacaoId']) {
          if (v[k]) varIds.push(String(v[k]))
        }
      }
    }
    const rawName = String(p.name || '').trim()
    const nameNorm = norm(rawName)
    return {
      prod: p,
      ids,
      varIds,
      nameNorm,
      nameLower: rawName.toLowerCase(),
      tokens: nameNorm.split(/\s+/).filter(t => t.length >= 2)
    }
  })

  // 2. Carregar TODAS as ORDENS (vendas e OS)
  process.stdout.write('Carregando TODAS as ordens da loja... ')
  const ordersQ = query(collection(db, 'orders'), where('storeId', '==', store.id), limit(10000))
  const ordersSnap = await getDocs(ordersQ)
  const orders = ordersSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }))
  console.log(`${orders.length} ordens carregadas.`)

  // =========== FUNÇÕES DE MATCH ============
  function findProdByIdAny(item) {
    for (const f of ['id','productId','originalId','codigo','cod','sku','code','product_id']) {
      const v = item ? item[f] : null
      if (!v) continue
      const s = String(v)
      for (const e of productsIndexed) {
        if (e.ids.includes(s)) return { prod: e.prod, method: `id-${f}=${s}`, varId: undefined }
        if (e.varIds.includes(s)) return { prod: e.prod, method: `varId-${f}=${s}`, varId: s }
      }
      // substring ids (inclusions)
      for (const e of productsIndexed) {
        for (const eid of e.ids) {
          if (eid && s && (eid.includes(s) || s.includes(eid))) return { prod: e.prod, method: `id-${f}-substr`, varId: undefined }
        }
      }
    }
    return null
  }

  function findProdByName(item) {
    const itemName = String(item?.name || '').trim()
    if (!itemName) return null
    const inorm = norm(itemName)
    const ilower = itemName.toLowerCase()
    const stripped = stripVariationFromItemName(itemName)
    const sNorm = stripped.clean ? norm(stripped.clean) : ''
    const sLower = stripped.clean ? stripped.clean.toLowerCase() : ''

    for (const e of productsIndexed) {
      if (e.nameNorm === inorm) return { prod: e.prod, method: 'nome-exato-sem-acentos' }
      if (sNorm && e.nameNorm === sNorm) return { prod: e.prod, method: 'nome-limpo-exato-sem-acentos' }
      if (e.nameLower === ilower) return { prod: e.prod, method: 'nome-exato-lower' }
      if (sLower && e.nameLower === sLower) return { prod: e.prod, method: 'nome-limpo-exato-lower' }
    }
    let best = null
    const tryScore = (prod, method, sc) => {
      if (!prod) return
      if (!best || sc > best.score) best = { prod, method, score: sc }
    }
    for (const e of productsIndexed) {
      if (!e.nameNorm) continue
      if (inorm.includes(e.nameNorm) && e.nameNorm.length >= 4) tryScore(e.prod, 'nome-fwd-includes', e.nameNorm.length)
      if (sNorm && sNorm.includes(e.nameNorm) && e.nameNorm.length >= 4) tryScore(e.prod, 'nome-limpo-fwd-includes', 1000 + e.nameNorm.length)
      if (e.nameNorm.includes(inorm) && inorm.length >= 4) tryScore(e.prod, 'nome-rev-includes', inorm.length)
      if (sNorm && e.nameNorm.includes(sNorm) && sNorm.length >= 4) tryScore(e.prod, 'nome-limpo-rev-includes', 1000 + sNorm.length)
    }
    // TOKENS (2+ palavras, 2+ letras)
    const cands = productsIndexed.map(e => ({
      prod: e.prod, etoks: e.tokens, norm: e.nameNorm
    }))
    for (const nameNormI of [inorm, sNorm].filter(Boolean)) {
      const itokens = nameNormI.split(/\s+/).filter(t => t.length >= 2)
      if (itokens.length === 0) continue
      for (const c of cands) {
        if (c.etoks.length === 0) continue
        let inter = 0
        for (const t of itokens) if (c.etoks.includes(t)) inter++
        if (inter >= 2) tryScore(c.prod, `tokens-2palavras-${inter}`, 2000 + inter * 100)
        else if (inter >= 1 && Math.max(itokens.length, c.etoks.length) <= 3) {
          tryScore(c.prod, `tokens-1palavra-curtos-${inter}`, 1500 + inter * 100)
        }
      }
    }
    for (const e of productsIndexed) {
      if (!e.nameLower || !ilower) continue
      if (ilower.includes(e.nameLower) && e.nameLower.length >= 4) tryScore(e.prod, 'substr-lower-fwd', 500 + e.nameLower.length)
      if (sLower && sLower.includes(e.nameLower) && e.nameLower.length >= 4) tryScore(e.prod, 'substr-lower-limpo-fwd', 1500 + e.nameLower.length)
      if (e.nameLower.includes(ilower) && ilower.length >= 4) tryScore(e.prod, 'substr-lower-rev', 500 + ilower.length)
    }
    return best ? { prod: best.prod, method: best.method } : null
  }

  // =========== PROCESSAR CADA ORDEM ============
  let stats = {
    totalOrders: 0,
    ordersWithProducts: 0,
    ordersChanged: 0,
    itemsTouched: 0,
    itemsNoCostBefore: 0,
    itemsNoCostAfter: 0,
    totalCostMigratedBRL: 0,
    fails: [],
    samples: []
  }

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i]
    if ((i + 1) % 100 === 0 || i === orders.length - 1) {
      process.stdout.write(`Processando ${i + 1}/${orders.length} ordens...\r`)
    }
    stats.totalOrders++
    const items = Array.isArray(order.products) ? order.products : (Array.isArray(order.items) ? order.items : [])
    if (!items || items.length === 0) continue
    stats.ordersWithProducts++

    let orderChanged = false
    const patchItems = [...items]

    for (let idx = 0; idx < patchItems.length; idx++) {
      const item = patchItems[idx] || {}
      const qty = Math.max(0, Number(item.quantity || 0))
      if (qty <= 0) continue
      const costAlready = extractCost(item)
      const costTotalAlready = Number(item.costTotal || 0)
      if (costAlready > 0 || costTotalAlready > 0) continue

      // item sem custo → tentar resolver
      stats.itemsNoCostBefore++
      let unitCost = 0
      let resolveMethod = ''
      let variationName = String(item.variationName || item.variation || item.variacao || '')

      // (A) por ID
      const byId = findProdByIdAny(item)
      if (byId) {
        const r = resolveProdCost(byId.prod, variationName, byId.varId)
        if (r.cost > 0) { unitCost = r.cost; resolveMethod = `${byId.method}→${r.how}` }
      }
      // (B) por NOME
      if (!unitCost) {
        const byName = findProdByName(item)
        if (byName) {
          const r = resolveProdCost(byName.prod, variationName)
          if (r.cost > 0) { unitCost = r.cost; resolveMethod = `${byName.method}→${r.how}` }
        }
      }

      if (unitCost > 0) {
        const newItem = {
          ...item,
          cost: unitCost,
          purchasePrice: unitCost,
          costPrice: unitCost,
          precoCusto: unitCost,
          custo: unitCost,
          custoUnitario: unitCost,
          valorCusto: unitCost,
          costTotal: unitCost * qty
        }
        patchItems[idx] = newItem
        stats.itemsTouched++
        stats.totalCostMigratedBRL += unitCost * qty
        orderChanged = true
        if (stats.samples.length < 8) {
          stats.samples.push({ orderId: order.id, idx, name: item.name, method: resolveMethod, unitCost, qty, costTotal: unitCost * qty })
        }
      } else {
        stats.itemsNoCostAfter++
        stats.fails.push({ orderId: order.id, idx, name: item.name || '?', id: item.id || item.productId || '?' })
      }
    }

    if (orderChanged) {
      stats.ordersChanged++
      const isProductsArr = Array.isArray(order.products)
      const field = isProductsArr ? 'products' : 'items'
      if (APPLY_MODE) {
        try {
          await updateDoc(order.ref, { [field]: patchItems, _costMigratedAt: new Date() })
        } catch (e) {
          console.log(`\n❌ Erro ao atualizar ordem ${order.id}: ${e.code || e.message}`)
        }
      }
    }
  }

  console.log(`\n\n=========================== RESUMO DA MIGRAÇÃO ===========================`)
  console.log(`Ordens processadas:         ${stats.totalOrders}`)
  console.log(`Ordens com items/produtos:  ${stats.ordersWithProducts}`)
  console.log(`Ordens com itens atualizados: ${stats.ordersChanged}`)
  console.log(`Itens sem custo (antes):    ${stats.itemsNoCostBefore}`)
  console.log(`Itens com custo ADICIONADO: ${stats.itemsTouched}`)
  console.log(`Itens ainda SEM custo:      ${stats.itemsNoCostAfter}`)
  console.log(`Valor TOTAL de custo gravado: R$ ${stats.totalCostMigratedBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
  console.log(`==========================================================================`)
  if (stats.samples.length > 0) {
    console.log('\nAmostras de itens atualizados:')
    stats.samples.forEach((s, i) => console.log(`  [${i + 1}] "${s.name}" qtd=${s.qty} unit=R$${s.unitCost.toFixed(2)} total=R$${s.costTotal.toFixed(2)} | via ${s.method} | ordem=${s.orderId}`))
  }
  if (stats.fails.length > 0) {
    console.log(`\n⚠ ${Math.min(stats.fails.length, 10)} primeiros itens SEM custo resolvido:`)
    stats.fails.slice(0, 10).forEach(f => console.log(`  - ordem=${f.orderId} idx=${f.idx} nome="${f.name}" id=${f.id}`))
  }
  if (!APPLY_MODE) {
    console.log(`\n📢 RODEI EM MODO DRY-RUN. Nada foi gravado no Firestore.`)
    console.log(`   Para realmente GRAVAR os custos no banco, execute:`)
    console.log(`       node.exe scripts/migrate_historical_costs.mjs --apply`)
  } else {
    console.log(`\n✅ CONCLUÍDO! Alterações aplicadas no Firestore.`)
    console.log(`   -> Atualize a página Estatísticas no navegador (F5) para ver os custos.`)
  }
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
