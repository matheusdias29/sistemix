import { initializeApp } from 'firebase/app'
import { initializeFirestore, collection, getDocs, query, where, limit, startAfter, writeBatch } from 'firebase/firestore'
import { getAuth, signInAnonymously } from 'firebase/auth'
import * as XLSX from 'xlsx'
import path from 'path'
import { fileURLToPath } from 'url'
import readline from 'readline'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Config Firebase (igual aos outros scripts)
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

function normalizeStr(v) {
  return String(v || '').trim()
}
function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '')
}
function normalizeName(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  console.log('=== Patch de NCM dos Produtos (via Excel) ===')
  try {
    await signInAnonymously(auth)
    console.log('✔ Autenticado.')
  } catch (e) {
    console.error('❌ Falha na autenticação:', e.code)
    process.exit(1)
  }

  // Selecionar loja
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

  // Ler Excel base
  const excelPath = path.resolve(__dirname, '../src/assets/produtos.xlsx')
  console.log(`\n📂 Lendo arquivo: ${excelPath}`)
  let rows = []
  let headers = []
  try {
    const fs = await import('fs')
    if (!fs.existsSync(excelPath)) {
      console.error('❌ Arquivo não encontrado em src/assets/produtos.xlsx')
      process.exit(1)
    }
    const fileBuffer = fs.readFileSync(excelPath)
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1 })
    if (!raw || raw.length === 0) {
      console.error('❌ Planilha vazia ou inválida')
      process.exit(1)
    }
    headers = (raw[0] || []).map(h => String(h || ''))
    rows = raw.slice(1).filter(r => r && r.length > 0)
    console.log(`✔ ${rows.length} linhas encontradas.`)
  } catch (e) {
    console.error('❌ Erro ao ler arquivo:', e.message)
    process.exit(1)
  }

  // Descobrir índices por cabeçalho de forma resiliente
  const normHeader = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g,'')
  const findCol = (names) => {
    const target = headers.map(h => normHeader(h))
    for (let i = 0; i < target.length; i++) {
      for (const nm of names) {
        if (target[i] === nm) return i
      }
    }
    // tentativa por includes (menos estrita)
    for (let i = 0; i < target.length; i++) {
      for (const nm of names) {
        if (target[i].includes(nm)) return i
      }
    }
    return -1
  }

  const barcodeIdx = findCol(['barcode','ean','gtin','codigodebarras','codbarras'])
  const referenceIdx = findCol(['reference','referencia','codigo','codigoproduto','codproduto','cod','ref'])
  const nameIdx = findCol(['name','produto','nome','descricao','descrição','nomeproduto','productname'])
  const ncmIdx = findCol(['ncm','codigoncm','codncm'])

  if (ncmIdx === -1) {
    console.error('❌ Coluna NCM não encontrada pelo cabeçalho da planilha.')
    console.error('Cabeçalhos detectados:', headers.join(' | '))
    process.exit(1)
  }
  if (referenceIdx === -1 && barcodeIdx === -1 && nameIdx === -1) {
    console.error('❌ Não foi possível identificar colunas de referência, nome ou código de barras no arquivo.')
    console.error('Cabeçalhos detectados:', headers.join(' | '))
    process.exit(1)
  }

  // Construir mapas
  const mapByRef = new Map()    // reference -> ncmDigits
  const mapByBarcode = new Map()// barcodeDigits -> ncmDigits
  const mapByName = new Map()   // normalizedName -> ncmDigits
  for (const r of rows) {
    const barcode = barcodeIdx >= 0 ? onlyDigits(r[barcodeIdx]) : ''
    const reference = referenceIdx >= 0 ? normalizeStr(r[referenceIdx]) : ''
    const nameVal = nameIdx >= 0 ? normalizeName(r[nameIdx]) : ''
    const ncmDigits = onlyDigits(r[ncmIdx])
    if (!ncmDigits) continue
    if (reference) mapByRef.set(reference.toLowerCase(), ncmDigits)
    if (barcode) mapByBarcode.set(barcode, ncmDigits)
    if (nameVal) mapByName.set(nameVal, ncmDigits)
  }
  console.log(`\n🔎 Índices construídos: por nome=${mapByName.size}, por referência=${mapByRef.size}, por código de barras=${mapByBarcode.size}`)

  const confirm = await question('\nAplicar patch de NCM em TODOS os produtos da loja? (s/n): ')
  if (confirm.toLowerCase() !== 's') {
    console.log('Cancelado.')
    process.exit(0)
  }

  console.log('\n🚀 Atualizando NCM dos produtos…')
  const READ_SIZE = 500
  let lastDoc = null
  let totalChecked = 0
  let totalPatched = 0

  while (true) {
    let qy = query(collection(db, 'products'), where('storeId', '==', store.id), limit(READ_SIZE))
    if (lastDoc) {
      qy = query(collection(db, 'products'), where('storeId', '==', store.id), startAfter(lastDoc), limit(READ_SIZE))
    }
    const snap = await getDocs(qy)
    if (snap.empty) break

    const batch = writeBatch(db)
    let ops = 0

    for (const d of snap.docs) {
      const data = d.data()
      totalChecked++
      const refStr = normalizeStr(data.reference || '').toLowerCase()
      const barStr = onlyDigits(data.barcode || '')
      const nameStr = normalizeName(data.name || '')

      let newNcm = null
      // Preferência: Nome → Referência → Código de Barras
      if (nameStr && mapByName.has(nameStr)) newNcm = mapByName.get(nameStr)
      else if (refStr && mapByRef.has(refStr)) newNcm = mapByRef.get(refStr)
      else if (barStr && mapByBarcode.has(barStr)) newNcm = mapByBarcode.get(barStr)

      if (!newNcm) continue

      const curNcmDigits = onlyDigits(data.ncm)
      if (curNcmDigits !== newNcm) {
        batch.update(d.ref, { ncm: newNcm, updatedAt: new Date() })
        ops++
        totalPatched++
      }
    }

    if (ops > 0) {
      await batch.commit()
    }

    process.stdout.write(`\rVerificados: ${totalChecked} | Atualizados (NCM): ${totalPatched}`)
    lastDoc = snap.docs[snap.docs.length - 1]
  }

  console.log(`\n\n✅ Concluído.`)
  console.log(`Total verificados: ${totalChecked}`)
  console.log(`Total com NCM atualizado: ${totalPatched}`)

  rl.close()
  setTimeout(() => process.exit(0), 500)
}

main().catch(e => {
  console.error('Erro fatal:', e)
  process.exit(1)
})
