import React, { useState, useMemo } from 'react'
import ProductsFilterModal from './ProductsFilterModal'
import SelectVariationModal from './SelectVariationModal'

const EAN_L = {
  '0': '0001101',
  '1': '0011001',
  '2': '0010011',
  '3': '0111101',
  '4': '0100011',
  '5': '0110001',
  '6': '0101111',
  '7': '0111011',
  '8': '0110111',
  '9': '0001011',
}
const EAN_G = {
  '0': '0100111',
  '1': '0110011',
  '2': '0011011',
  '3': '0100001',
  '4': '0011101',
  '5': '0111001',
  '6': '0000101',
  '7': '0010001',
  '8': '0001001',
  '9': '0010111',
}
const EAN_R = {
  '0': '1110010',
  '1': '1100110',
  '2': '1101100',
  '3': '1000010',
  '4': '1011100',
  '5': '1001110',
  '6': '1010000',
  '7': '1000100',
  '8': '1001000',
  '9': '1110100',
}
const EAN_PARITY = {
  '0': 'LLLLLL',
  '1': 'LLGLGG',
  '2': 'LLGGLG',
  '3': 'LLGGGL',
  '4': 'LGLLGG',
  '5': 'LGGLLG',
  '6': 'LGGGLL',
  '7': 'LGLGLG',
  '8': 'LGLGGL',
  '9': 'LGGLGL',
}

const CODE128_PATTERNS = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112',
]

function money(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function computeEan13CheckDigit(twelveDigits) {
  const s = String(twelveDigits || '').replace(/\D/g, '').slice(0, 12)
  if (s.length !== 12) return null
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const d = Number(s[i])
    const pos = i + 1
    sum += (pos % 2 === 0) ? (d * 3) : d
  }
  const cd = (10 - (sum % 10)) % 10
  return String(cd)
}

function buildEan13Bits(digits) {
  const d = String(digits || '').replace(/\D/g, '')
  let full = d
  if (full.length === 12) {
    const cd = computeEan13CheckDigit(full)
    if (cd == null) return null
    full = full + cd
  }
  if (full.length !== 13) return null
  const first = full[0]
  const parity = EAN_PARITY[first]
  if (!parity) return null
  let bits = '101'
  for (let i = 1; i <= 6; i++) {
    const ch = full[i]
    const p = parity[i - 1]
    bits += (p === 'G' ? EAN_G[ch] : EAN_L[ch]) || ''
  }
  bits += '01010'
  for (let i = 7; i <= 12; i++) {
    const ch = full[i]
    bits += EAN_R[ch] || ''
  }
  bits += '101'
  if (bits.length !== 95) return null
  return { bits, text: full }
}

function buildEan13Svg(digits, { height = 48, quiet = 10 } = {}) {
  const r = buildEan13Bits(digits)
  if (!r) return null
  const pattern = '0'.repeat(quiet) + r.bits + '0'.repeat(quiet)
  const totalWidth = pattern.length
  const rects = []
  let x = 0
  while (x < totalWidth) {
    if (pattern[x] === '1') {
      let start = x
      while (x < totalWidth && pattern[x] === '1') x++
      rects.push({ x: start, w: x - start })
    } else {
      x++
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height}" preserveAspectRatio="none">${rects.map(r => `<rect x="${r.x}" y="0" width="${r.w}" height="${height}" fill="#000"/>`).join('')}</svg>`
  return { svg, text: r.text }
}

function code128ValueForChar(ch) {
  const code = ch.charCodeAt(0)
  if (code < 32 || code > 127) return null
  return code - 32
}

function buildCode128Bits(text) {
  const s = String(text || '')
  if (!s) return null
  const codes = []
  for (let i = 0; i < s.length; i++) {
    const c = code128ValueForChar(s[i])
    if (c == null) return null
    codes.push(c)
  }
  const start = 104
  let checksum = start
  for (let i = 0; i < codes.length; i++) {
    checksum += codes[i] * (i + 1)
  }
  checksum = checksum % 103
  const fullCodes = [start, ...codes, checksum, 106]
  let bits = ''
  for (let i = 0; i < fullCodes.length; i++) {
    const code = fullCodes[i]
    const pat = CODE128_PATTERNS[code]
    if (!pat) return null
    let isBar = true
    for (let j = 0; j < pat.length; j++) {
      const w = Number(pat[j])
      bits += (isBar ? '1' : '0').repeat(w)
      isBar = !isBar
    }
  }
  return bits
}

function buildCode128Svg(text, { height = 48, quiet = 10 } = {}) {
  const bits = buildCode128Bits(text)
  if (!bits) return null
  const pattern = '0'.repeat(quiet) + bits + '0'.repeat(quiet)
  const totalWidth = pattern.length
  const rects = []
  let x = 0
  while (x < totalWidth) {
    if (pattern[x] === '1') {
      let start = x
      while (x < totalWidth && pattern[x] === '1') x++
      rects.push({ x: start, w: x - start })
    } else {
      x++
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height}" preserveAspectRatio="none">${rects.map(r => `<rect x="${r.x}" y="0" width="${r.w}" height="${height}" fill="#000"/>`).join('')}</svg>`
  return { svg, text: String(text || '') }
}

function pickPriceFromItem(item) {
  const v = item?.variation
  if (v) {
    const promo = v.promoPrice != null ? Number(v.promoPrice) : null
    const sale = Number(v.salePrice ?? v.price ?? 0)
    const min = Number(v.priceMin ?? 0)
    if (promo && !isNaN(promo)) return promo
    if (sale && !isNaN(sale)) return sale
    if (min && !isNaN(min)) return min
    return 0
  }
  const p = item?.product || {}
  const promo = p.promoPrice != null ? Number(p.promoPrice) : null
  const sale = Number(p.salePrice ?? 0)
  const min = Number(p.priceMin ?? 0)
  if (promo && !isNaN(promo)) return promo
  if (sale && !isNaN(sale)) return sale
  if (min && !isNaN(min)) return min
  return 0
}

function pickBarcodeText(item) {
  const p = item?.product || {}
  const raw = String(p.barcode || p.reference || p.code || '').trim()
  return raw
}

function buildBarcodeSvgByBestFit(text) {
  const digits = String(text || '').replace(/\D/g, '')
  if (digits.length === 12 || digits.length === 13) {
    const e = buildEan13Svg(digits, { height: 52, quiet: 10 })
    if (e) return { kind: 'ean13', svg: e.svg, text: e.text }
  }
  const c = buildCode128Svg(String(text || ''), { height: 52, quiet: 10 })
  if (c) return { kind: 'code128', svg: c.svg, text: c.text }
  return null
}

function formatPricingLabel(name) {
  const raw = String(name || '').trim()
  if (!raw) return ''
  return raw.replace(/^\s*\d+\s*[-–]\s*/g, '').trim().toUpperCase()
}

export default function ProductLabelsPage({ 
  products = [], 
  categories = [], 
  suppliers = [], 
  onBack 
}) {
  const [query, setQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState({})
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedItems, setSelectedItems] = useState([]) // { product, variation?, qty }
  const PRESETS = useMemo(() => ([
    {
      id: 'pimaco_a4248',
      displayName: 'Pimaco A4248 (96 etiquetas por folha)',
      type: 'grid',
      page: { wMm: 210, hMm: 297 },
      grid: { across: 6, down: 16 },
      label: { wMm: 31.0, hMm: 17.0 },
      pitch: { xMm: 33.0, yMm: 17.0 },
      margin: { topMm: 12.5, leftMm: 7.0 },
      border: true,
      style: {
        padXmm: 1.0,
        padYmm: 1.0,
        rowGapMm: 1.2,
        namePx: 6.5,
        subPx: 6.0,
        refPx: 6.2,
        pricePx: 10.5,
        barcodeTopMm: 1.0,
        barcodeHpx: 10,
        barcodeTextPx: 6.2,
        subTopMm: 0.2,
        refTopMm: 0.2,
      },
    },
    {
      id: 'pimaco_a4251',
      displayName: 'Pimaco A4251 (65 etiquetas por folha)',
      type: 'grid',
      page: { wMm: 210, hMm: 297 },
      grid: { across: 5, down: 13 },
      label: { wMm: 38.2, hMm: 21.2 },
      pitch: { xMm: 40.7, yMm: 21.2 },
      margin: { topMm: 10.7, leftMm: 4.5 },
      border: true,
      style: {
        padXmm: 1.2,
        padYmm: 1.2,
        rowGapMm: 1.5,
        namePx: 7.5,
        subPx: 7.0,
        refPx: 7.0,
        pricePx: 13.0,
        barcodeTopMm: 1.2,
        barcodeHpx: 12,
        barcodeTextPx: 7.0,
        subTopMm: 0.3,
        refTopMm: 0.3,
      },
    },
    {
      id: 'pimaco_a4256',
      displayName: 'Pimaco A4256 (33 etiquetas por folha)',
      type: 'grid',
      page: { wMm: 210, hMm: 297 },
      grid: { across: 3, down: 11 },
      label: { wMm: 63.5, hMm: 25.4 },
      pitch: { xMm: 66.1, yMm: 25.4 },
      margin: { topMm: 8.8, leftMm: 7.2 },
      border: true,
      style: {
        padXmm: 2.0,
        padYmm: 2.0,
        rowGapMm: 2.0,
        namePx: 10.5,
        subPx: 9.0,
        refPx: 9.0,
        pricePx: 18.0,
        barcodeTopMm: 1.8,
        barcodeHpx: 18,
        barcodeTextPx: 9.0,
        subTopMm: 0.4,
        refTopMm: 0.4,
      },
    },
    {
      id: 'pimaco_62580',
      displayName: 'Pimaco 62580/OFFC180 (30 etiquetas por folha)',
      type: 'grid',
      page: { wMm: 215.9, hMm: 279.4 },
      grid: { across: 3, down: 10 },
      label: { wMm: 66.7, hMm: 25.4 },
      pitch: { xMm: 69.8, yMm: 25.4 },
      margin: { topMm: 12.7, leftMm: 4.8 },
      border: true,
      style: {
        padXmm: 2.0,
        padYmm: 2.0,
        rowGapMm: 2.0,
        namePx: 10.5,
        subPx: 9.0,
        refPx: 9.0,
        pricePx: 18.0,
        barcodeTopMm: 1.8,
        barcodeHpx: 18,
        barcodeTextPx: 9.0,
        subTopMm: 0.4,
        refTopMm: 0.4,
      },
    },
    {
      id: 'pimaco_6089',
      displayName: 'Pimaco 6089 (60 etiquetas por folha)',
      type: 'grid',
      page: { wMm: 215.9, hMm: 279.4 },
      grid: { across: 4, down: 15 },
      label: { wMm: 44.4, hMm: 16.9 },
      pitch: { xMm: 47.5, yMm: 16.9 },
      margin: { topMm: 12.7, leftMm: 14.5 },
      border: true,
      style: {
        padXmm: 1.2,
        padYmm: 1.0,
        rowGapMm: 1.2,
        namePx: 7.0,
        subPx: 6.5,
        refPx: 6.5,
        pricePx: 12.0,
        barcodeTopMm: 1.0,
        barcodeHpx: 10,
        barcodeTextPx: 6.5,
        subTopMm: 0.2,
        refTopMm: 0.2,
      },
    },
    {
      id: 'termica_40',
      displayName: 'Térmica 40mm (gôndola)',
      type: 'thermal',
      page: { wMm: 40, hMm: null },
      label: { wMm: 40, hMm: 26 },
      margin: { topMm: 0, leftMm: 0 },
      border: true,
      style: {
        padXmm: 1.5,
        padYmm: 1.5,
        rowGapMm: 1.5,
        namePx: 9.0,
        subPx: 8.0,
        refPx: 8.0,
        pricePx: 16.0,
        barcodeTopMm: 1.2,
        barcodeHpx: 16,
        barcodeTextPx: 8.0,
        subTopMm: 0.3,
        refTopMm: 0.3,
      },
    },
    {
      id: 'termica_80',
      displayName: 'Térmica 80mm (produto)',
      type: 'thermal',
      page: { wMm: 80, hMm: null },
      label: { wMm: 80, hMm: 30 },
      margin: { topMm: 0, leftMm: 0 },
      border: true,
      style: {
        padXmm: 2.0,
        padYmm: 2.0,
        rowGapMm: 2.0,
        namePx: 11.0,
        subPx: 10.0,
        refPx: 10.0,
        pricePx: 18.0,
        barcodeTopMm: 1.8,
        barcodeHpx: 22,
        barcodeTextPx: 10.0,
        subTopMm: 0.4,
        refTopMm: 0.4,
      },
    },
  ]), [])
  const [labelModel, setLabelModel] = useState('pimaco_a4248')
  
  // Variation Modal
  const [varModalOpen, setVarModalOpen] = useState(false)
  const [targetProduct, setTargetProduct] = useState(null)
  const filteredProducts = useMemo(() => {
    let res = products.filter(p => (p.name || '').toLowerCase().includes(query.trim().toLowerCase()))

    // Apply filters
    if (activeFilters.categoryId) {
       res = res.filter(p => p.categoryId === activeFilters.categoryId)
    }
    if (activeFilters.supplier) {
       res = res.filter(p => p.supplier === activeFilters.supplier)
    }
    if (activeFilters.origin) {
       res = res.filter(p => String(p.origin) === String(activeFilters.origin))
    }
    if (activeFilters.ncm) {
       res = res.filter(p => (p.ncm || '').includes(activeFilters.ncm))
    }
    if (activeFilters.cest) {
       res = res.filter(p => (p.cest || '').includes(activeFilters.cest))
    }
    if (activeFilters.validityStart) {
       res = res.filter(p => p.validityDate && p.validityDate >= activeFilters.validityStart)
    }
    if (activeFilters.validityEnd) {
       res = res.filter(p => p.validityDate && p.validityDate <= activeFilters.validityEnd)
    }
    if (activeFilters.lowStock) {
       res = res.filter(p => {
          const s = Number(p.stock||0)
          const m = Number(p.stockMin||0)
          return s <= m
       })
    }
    if (activeFilters.noStock) {
       res = res.filter(p => Number(p.stock||0) === 0)
    }

    // Status
    const fActive = activeFilters.filterActive ?? true 
    const fInactive = activeFilters.filterInactive ?? false 
    
    if (Object.keys(activeFilters).length > 0) {
        if (fActive && !fInactive) {
           res = res.filter(p => (p.active ?? true) === true)
        } else if (!fActive && fInactive) {
           res = res.filter(p => (p.active ?? true) === false)
        } else if (!fActive && !fInactive) {
           res = []
        }
    }

    return res
  }, [products, query, activeFilters])

  const handleAdd = (product) => {
    // Check variations
    if (product.variationsData && product.variationsData.length > 0) {
      setTargetProduct(product)
      setVarModalOpen(true)
      return
    }

    // If exists, increment quantity
    if (selectedItems.find(i => i.product.id === product.id)) {
      setSelectedItems(selectedItems.map(i => 
        i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i
      ))
      return
    }
    
    setSelectedItems([...selectedItems, { product, qty: 1 }])
  }

  const handleVariationSelect = (variation) => {
    if (!targetProduct) return
    
    const uid = `${targetProduct.id}-${variation.name}` 
    
    // If exists, increment quantity
    if (selectedItems.find(i => (i.uid || i.product.id) === uid)) {
      setSelectedItems(selectedItems.map(i => 
        (i.uid || i.product.id) === uid ? { ...i, qty: i.qty + 1 } : i
      ))
      setVarModalOpen(false)
      setTargetProduct(null)
      return
    }

    const newItem = { 
       product: targetProduct, 
       variation, 
       qty: 1,
       uid
    }
    
    setSelectedItems([...selectedItems, newItem])
    setVarModalOpen(false)
    setTargetProduct(null)
  }

  const handleRemove = (uid) => {
    setSelectedItems(selectedItems.filter(i => (i.uid || i.product.id) !== uid))
  }

  const handleQtyChange = (uid, val) => {
    const qty = parseInt(val) || 0
    setSelectedItems(selectedItems.map(i => (i.uid || i.product.id) === uid ? { ...i, qty } : i))
  }

  const totalLabels = selectedItems.reduce((acc, curr) => acc + curr.qty, 0)
  
  const handleGenerate = () => {
    if (!selectedItems || selectedItems.length === 0) return
    const expanded = []
    selectedItems.forEach(it => {
      const n = Math.max(0, parseInt(it.qty, 10) || 0)
      for (let i = 0; i < n; i++) expanded.push(it)
    })
    if (expanded.length === 0) return

    const preset = PRESETS.find(p => p.id === labelModel) || PRESETS[0]
    const style = preset.style || {}
    const padXmm = typeof style.padXmm === 'number' ? style.padXmm : 2
    const padYmm = typeof style.padYmm === 'number' ? style.padYmm : 2
    const rowGapMm = typeof style.rowGapMm === 'number' ? style.rowGapMm : 2
    const barcodeTopMm = typeof style.barcodeTopMm === 'number' ? style.barcodeTopMm : 1.5
    const namePx = typeof style.namePx === 'number' ? style.namePx : 11
    const subPx = typeof style.subPx === 'number' ? style.subPx : 9
    const refPx = typeof style.refPx === 'number' ? style.refPx : 9
    const pricePx = typeof style.pricePx === 'number' ? style.pricePx : 18
    const barcodeHpx = typeof style.barcodeHpx === 'number' ? style.barcodeHpx : 22
    const barcodeTextPx = typeof style.barcodeTextPx === 'number' ? style.barcodeTextPx : 10
    const subTopMm = typeof style.subTopMm === 'number' ? style.subTopMm : 0.4
    const refTopMm = typeof style.refTopMm === 'number' ? style.refTopMm : 0.4
    const perPage = preset.type === 'grid'
      ? (preset.grid.across * preset.grid.down)
      : 1

    const pages = []
    if (preset.type === 'grid') {
      for (let i = 0; i < expanded.length; i += perPage) pages.push(expanded.slice(i, i + perPage))
    } else {
      for (let i = 0; i < expanded.length; i++) pages.push([expanded[i]])
    }

    const labelHtml = (it, idx) => {
      const name = String(it?.product?.name || '').trim() || 'Produto'
      const price = pickPriceFromItem(it)
      const barcodeText = pickBarcodeText(it)
      const barcode = buildBarcodeSvgByBestFit(barcodeText)
      const barcodeSvg = barcode?.svg || ''
      const barcodeNum = barcode?.text || barcodeText || ''
      const ref = String(it?.product?.reference || '').trim()
      const pricingLabel = formatPricingLabel(it?.variation?.name)
      const priceText = money(price)
      return `
        <div class="label" data-i="${idx}">
          <div class="label-row">
            <div class="label-left">
              <div class="label-name">${escapeHtml(name)}</div>
              ${pricingLabel ? `<div class="label-sub">${escapeHtml(pricingLabel)}</div>` : ''}
              ${ref ? `<div class="label-ref">REF: ${escapeHtml(ref)}</div>` : ''}
            </div>
            <div class="label-price">${escapeHtml(priceText)}</div>
          </div>
          <div class="label-barcode">
            ${barcodeSvg ? `<div class="barcode-svg">${barcodeSvg}</div>` : ''}
            ${barcodeNum ? `<div class="barcode-text">${escapeHtml(barcodeNum)}</div>` : ''}
          </div>
        </div>
      `
    }
    
    const sheetsHtml = pages.map((pageItems, pageIdx) => {
      const items = pageItems.map((it, idx) => labelHtml(it, pageIdx * 10000 + idx)).join('')
      return `<div class="sheet">${items}</div>`
    }).join('')

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>Etiquetas</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 0; font-family: Arial, sans-serif; color: #000; }
            .sheet { page-break-after: always; }
            .label-row { display: grid; grid-template-columns: 1fr auto; gap: ${rowGapMm}mm; align-items: start; }
            .label-left { min-width: 0; }
            .label-name { font-weight: 900; line-height: 1.15; text-transform: uppercase; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
            .label-sub { margin-top: ${subTopMm}mm; font-weight: 800; line-height: 1.15; text-transform: uppercase; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
            .label-ref { margin-top: ${refTopMm}mm; font-weight: 800; letter-spacing: 0.3px; }
            .label-price { font-weight: 900; white-space: nowrap; }
            .barcode-svg { margin-top: ${barcodeTopMm}mm; }
            .barcode-svg svg { width: 100%; display: block; }
            .barcode-text { font-weight: 800; letter-spacing: 0.6px; text-align: left; margin-top: 1mm; }
            ${preset.type === 'grid' ? `
              @page { size: ${preset.page.wMm}mm ${preset.page.hMm}mm; margin: 0; }
              .sheet {
                width: ${preset.page.wMm}mm;
                height: ${preset.page.hMm}mm;
                margin: 0 auto;
                padding-top: ${preset.margin.topMm}mm;
                padding-left: ${preset.margin.leftMm}mm;
                display: grid;
                grid-template-columns: repeat(${preset.grid.across}, ${preset.label.wMm}mm);
                grid-auto-rows: ${preset.label.hMm}mm;
                column-gap: ${Math.max(0, (preset.pitch.xMm - preset.label.wMm))}mm;
                row-gap: ${Math.max(0, (preset.pitch.yMm - preset.label.hMm))}mm;
                align-content: start;
                justify-content: start;
              }
              .label {
                width: ${preset.label.wMm}mm;
                height: ${preset.label.hMm}mm;
                border: ${preset.border ? '1px solid #cfcfcf' : '1px solid transparent'};
                padding: ${padYmm}mm ${padXmm}mm;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                overflow: hidden;
              }
              .label-name { font-size: ${namePx}px; }
              .label-sub { font-size: ${subPx}px; }
              .label-ref { font-size: ${refPx}px; }
              .label-price { font-size: ${pricePx}px; }
              .barcode-svg svg { height: ${barcodeHpx}px; }
              .barcode-text { font-size: ${barcodeTextPx}px; }
            ` : `
              @page { size: ${preset.page.wMm}mm auto; margin: 0; }
              .sheet {
                width: ${preset.page.wMm}mm;
                margin: 0 auto;
                padding: 0;
              }
              .label {
                width: ${preset.label.wMm}mm;
                height: ${preset.label.hMm}mm;
                border: ${preset.border ? '1px solid #000' : '1px solid transparent'};
                padding: ${padYmm}mm ${padXmm}mm;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                page-break-after: always;
                overflow: hidden;
              }
              .label-name { font-size: ${namePx}px; }
              .label-sub { font-size: ${subPx}px; }
              .label-ref { font-size: ${refPx}px; }
              .label-price { font-size: ${pricePx}px; }
              .barcode-svg svg { height: ${barcodeHpx}px; }
              .barcode-text { font-size: ${barcodeTextPx}px; }
            `}
          </style>
        </head>
        <body>
          ${sheetsHtml}
          <script>
            var __didPrint = false;
            function __tryPrint() {
              if (__didPrint) return;
              __didPrint = true;
              try { window.focus(); } catch (e) {}
              try { window.print(); } catch (e) {}
            }
            window.onload = function() { setTimeout(__tryPrint, 200); };
            setTimeout(__tryPrint, 1200);
          </script>
        </body>
      </html>
    `

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)
    const doc = iframe.contentWindow.document
    doc.open()
    doc.write(html)
    doc.close()
    try { iframe.contentWindow.focus() } catch {}
    const cleanup = () => { try { iframe.remove() } catch {} }
    try { iframe.contentWindow.onafterprint = () => setTimeout(cleanup, 50) } catch {}
    setTimeout(cleanup, 8000)
  }

  function escapeHtml(input) {
    return String(input || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
  }

  return (
    <div className="flex flex-col h-full animate-fadeIn">
      {/* Header / Top Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 w-full md:w-auto">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded text-gray-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          )}
          <div className="relative flex-1 md:w-80">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
               </svg>
            </span>
            <input 
              type="text"
              placeholder="Pesquisar..."
              className="w-full pl-9 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setFilterOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-700 bg-white"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filtros
          </button>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex flex-col text-sm text-gray-500">
            <span className="text-xs">Modelo</span>
            <select 
              className="border-none bg-transparent font-medium text-gray-700 focus:ring-0 p-0 cursor-pointer"
              value={labelModel}
              onChange={e => setLabelModel(e.target.value)}
            >
              {PRESETS.map(p => (
                <option key={p.id} value={p.id}>{p.displayName}</option>
              ))}
            </select>
          </div>
          <button onClick={handleGenerate} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium shadow-sm transition-colors">
            Gerar
          </button>
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0 overflow-hidden">
        
        {/* Left: Product Selection */}
        <div className="bg-white rounded-lg shadow border flex flex-col min-h-0">
          <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">
              {filteredProducts.length} produtos encontrados
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10 text-xs text-gray-500 uppercase font-medium">
                <tr>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredProducts.map(product => (
                  <tr 
                    key={product.id} 
                    className="hover:bg-gray-50 group cursor-pointer"
                    onClick={() => handleAdd(product)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800 flex items-center gap-2">
                        {product.name}
                        {product.variationsData && product.variationsData.length > 0 && (
                          <span className="text-xs text-gray-500 font-normal">
                             {product.variationsData.length} variações
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">Estoque: {product.stock || 0}</div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                       {product.salePrice ? Number(product.salePrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        className="p-1 rounded hover:bg-green-100 text-green-600 transition-colors"
                        title="Adicionar"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan="3" className="px-4 py-8 text-center text-gray-500">
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Selected for Labels */}
        <div className="bg-white rounded-lg shadow border flex flex-col min-h-0">
          <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
             <span className="text-sm font-medium text-gray-600">
               {selectedItems.length} produtos selecionados, {totalLabels} etiquetas pendentes
             </span>
             {selectedItems.length > 0 && (
               <button 
                 onClick={() => setSelectedItems([])}
                 className="text-red-500 hover:text-red-700"
                 title="Limpar tudo"
               >
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                 </svg>
               </button>
             )}
          </div>

          <div className="flex-1 overflow-y-auto">
             <table className="w-full text-left border-collapse">
               <thead className="bg-gray-50 sticky top-0 z-10 text-xs text-gray-500 uppercase font-medium">
                 <tr>
                   <th className="px-4 py-3">Descrição</th>
                   <th className="px-4 py-3 text-right w-32">Nº etiquetas</th>
                   <th className="px-4 py-3 w-10"></th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 text-sm">
                 {selectedItems.map((item) => (
                   <tr key={item.uid || item.product.id} className="hover:bg-gray-50">
                     <td className="px-4 py-3">
                       <div className="font-medium text-gray-800">
                         {item.product.name}
                         {item.variation && (
                           <span className="text-gray-500 ml-1">- {item.variation.name}</span>
                         )}
                       </div>
                     </td>
                     <td className="px-4 py-3 text-right">
                       <input 
                         type="number"
                         min="1"
                         className="w-20 text-right border rounded px-2 py-1 focus:ring-green-500 focus:border-green-500"
                         value={item.qty}
                         onChange={(e) => handleQtyChange(item.uid || item.product.id, e.target.value)}
                       />
                     </td>
                     <td className="px-4 py-3 text-right">
                       <button 
                         onClick={() => handleRemove(item.uid || item.product.id)}
                         className="p-1 rounded hover:bg-red-50 text-red-500 transition-colors"
                         title="Remover"
                       >
                         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                         </svg>
                       </button>
                     </td>
                   </tr>
                 ))}
                 {selectedItems.length === 0 && (
                   <tr>
                     <td colSpan="3" className="px-4 py-8 text-center text-gray-500">
                       Nenhum produto selecionado.
                     </td>
                   </tr>
                 )}
               </tbody>
             </table>
          </div>
        </div>
      </div>

      <ProductsFilterModal 
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={filters => {
          setActiveFilters(filters)
          setFilterOpen(false)
        }}
        initialFilters={activeFilters}
        categories={categories}
        suppliers={suppliers}
      />

      <SelectVariationModal
        open={varModalOpen}
        onClose={() => { setVarModalOpen(false); setTargetProduct(null); }}
        product={targetProduct}
        onChoose={handleVariationSelect}
      />
    </div>
  )
}
