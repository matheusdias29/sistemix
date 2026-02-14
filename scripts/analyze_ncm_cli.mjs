import * as XLSX from 'xlsx'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function normalizeHeader(s){
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g,'')
}

function onlyDigits(v){
  return String(v || '').replace(/\D/g, '')
}

function findCol(headers, candidates){
  const hs = headers.map(normalizeHeader)
  for (let i=0;i<hs.length;i++){
    for (const c of candidates){
      if (hs[i] === c) return i
    }
  }
  for (let i=0;i<hs.length;i++){
    for (const c of candidates){
      if (hs[i].includes(c)) return i
    }
  }
  return -1
}

try {
  const fs = await import('fs')
  const excelPath = path.resolve(__dirname, '../src/assets/produtos.xlsx')
  const fileBuffer = fs.readFileSync(excelPath)
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1 })
  if (!raw || raw.length === 0) {
    fs.writeFileSync(path.resolve(__dirname, 'ncm_report.txt'), 'Planilha vazia\n', 'utf8')
    process.exit(0)
  }
  const headers = raw[0]
  const rows = raw.slice(1)
  const ncmIdx = findCol(headers, ['ncm','codigoncm','codncm'])
  if (ncmIdx === -1){
    fs.writeFileSync(path.resolve(__dirname, 'ncm_report.txt'), 'Coluna NCM não encontrada.\nCabeçalhos: ' + headers.join(' | ') + '\n', 'utf8')
    process.exit(1)
  }
  let total = 0
  let filled = 0
  const unique = new Map()
  for (const r of rows){
    if (!r || r.length === 0) continue
    total++
    const ncmDigits = onlyDigits(r[ncmIdx])
    if (ncmDigits){
      filled++
      unique.set(ncmDigits, (unique.get(ncmDigits)||0)+1)
    }
  }
  const uniqueCount = unique.size
  const top = Array.from(unique.entries()).sort((a,b)=>b[1]-a[1]).slice(0,10)
  let out = ''
  out += `Linhas totais: ${total}\n`
  out += `Linhas com NCM preenchido: ${filled}\n`
  out += `NCMs distintos: ${uniqueCount}\n`
  out += 'Top 10 NCM por frequência:\n'
  top.forEach(([n,f],i)=>{ out += `${i+1}. ${n} - ${f}\n` })
  fs.writeFileSync(path.resolve(__dirname, 'ncm_report.txt'), out, 'utf8')
  process.exit(0)
} catch (e){
  try {
    const fs = await import('fs')
    const outPath = path.resolve(__dirname, 'ncm_report.txt')
    fs.writeFileSync(outPath, `Erro: ${e.message}\n`, 'utf8')
  } catch {}
  process.exit(1)
}
