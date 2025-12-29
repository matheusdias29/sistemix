import React, { useState, useEffect } from 'react'
import { addProduct, updateProduct, getNextProductReference } from '../services/products'
import VariationsModal from './VariationsModal'
import NewCategoryModal from './NewCategoryModal'
import NewSupplierModal from './NewSupplierModal'
import SelectCategoryModal from './SelectCategoryModal'
import SelectSupplierModal from './SelectSupplierModal'

export default function NewProductModal({ open, onClose, isEdit=false, product=null, categories=[], suppliers=[], storeId, user }){
  const [name, setName] = useState('')
  const [priceMin, setPriceMin] = useState('0')
  const [priceMax, setPriceMax] = useState('0')
  const [stock, setStock] = useState('0')
  const [variations, setVariations] = useState('0')
  // Novos campos do pop-up
  const [tab, setTab] = useState('cadastro')
  const [categoryId, setCategoryId] = useState('')
  const [supplier, setSupplier] = useState('')
  const [cost, setCost] = useState('0')
  const [salePrice, setSalePrice] = useState('0')
  const [promoPrice, setPromoPrice] = useState('')
  const [barcode, setBarcode] = useState('')
  const [reference, setReference] = useState('')
  const [validityDate, setValidityDate] = useState('')
  const [controlStock, setControlStock] = useState(true)
  const [stockMin, setStockMin] = useState('0')
  const [showInCatalog, setShowInCatalog] = useState(false)
  const [featured, setFeatured] = useState(false)
  const [description, setDescription] = useState('')
  const [commissionPercent, setCommissionPercent] = useState('0')
  const [unit, setUnit] = useState('Unidade')
  const [allowFraction, setAllowFraction] = useState(false)
  const [notes, setNotes] = useState('')
  const [origin, setOrigin] = useState('')
  const [ncm, setNcm] = useState('')
  const [cest, setCest] = useState('')
  const [variationsData, setVariationsData] = useState([])
  const [varModalOpen, setVarModalOpen] = useState(false)
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [catSelectOpen, setCatSelectOpen] = useState(false)
  const [newCatOpen, setNewCatOpen] = useState(false)
  // Fornecedor: estados do seletor e modal
  const [supSelectOpen, setSupSelectOpen] = useState(false)
  const [newSupOpen, setNewSupOpen] = useState(false)
  const [isSmartphone, setIsSmartphone] = useState(false)
  const [phoneBrand, setPhoneBrand] = useState('')
  const [phoneColor, setPhoneColor] = useState('')
  const [imei1, setImei1] = useState('')
  const [imei2, setImei2] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [condition, setCondition] = useState('')
  const [warrantyMonths, setWarrantyMonths] = useState(null)
  
  // Novos tipos
  const [isParts, setIsParts] = useState(false)
  const [isAccessories, setIsAccessories] = useState(false)
  const [isSundries, setIsSundries] = useState(false)

  // Variation Config
  const [variationMode, setVariationMode] = useState('4V')
  const VAR_NAMES_3V = [
    '1 - PREÇO P/ CLIENTE FINAL',
    '2 - PREÇO P/ LOJISTA LEVAR',
    '3 - PREÇO P/ LOJISTA INSTALADA NA LOJA'
  ]
  const VAR_NAMES_4V = [
    '1- VALOR DO PRODUTO',
    '2-VALOR PARCELADO 7X ATÉ 12X CARTÃO CREDITO',
    '3-VALOR PARCELADO 13X ATÉ 18X CARTÃO CREDITO',
    '4-VALOR P/LOJISTA LEVAR Á VISTA'
  ]
  const VAR_NAMES_5V = [
    ...VAR_NAMES_4V,
    '5-VALOR P/INSTALAR NA LOJA'
  ]

  const generateVariations = (mode, currentVars = []) => {
    let targetNames = VAR_NAMES_4V
    if (mode === '5V') targetNames = VAR_NAMES_5V
    else if (mode === '3V') targetNames = VAR_NAMES_3V
    
    return targetNames.map(name => {
      const existing = currentVars.find(v => v.name === name)
      if (existing) return existing
      return {
        name,
        cost: 0,
        salePrice: 0,
        promoPrice: null,
        barcode: '',
        reference: '',
        validityDate: null,
        stockInitial: 0,
        stockMin: 0,
        stock: 0,
        active: true
      }
    })
  }

  // Pré-carregar dados ao editar um produto
  useEffect(() => {
    if(open){
      if(isEdit && product){
        setTab('cadastro')
        setName(product.name || '')
        setCategoryId(product.categoryId || '')
        setSupplier(product.supplier || '')
        setCost(String(product.cost ?? 0))
        setSalePrice(String(product.salePrice ?? 0))
        setPromoPrice(product.promoPrice != null ? String(product.promoPrice) : '')
        setBarcode(product.barcode || '')
        setReference(product.reference || '')
        setValidityDate(product.validityDate || '')
        setControlStock(!!product.controlStock)
        setStock(String(product.stock ?? 0))
        setStockMin(String(product.stockMin ?? 0))
        setShowInCatalog(!!product.showInCatalog)
        setFeatured(!!product.featured)
        setVariations(String(product.variations ?? 0))
        
        const vData = Array.isArray(product.variationsData) ? product.variationsData : []
        // Detecção do modo baseado nos nomes das variações
        const has5th = vData.some(v => v.name === '5-VALOR P/INSTALAR NA LOJA')
        const has3rd = vData.some(v => v.name === '3 - PREÇO P/ LOJISTA INSTALADA NA LOJA')
        
        let initialMode = '4V'
        if (has5th) initialMode = '5V'
        else if (has3rd) initialMode = '3V'
        
        setVariationMode(initialMode)
        setVariationsData(vData)

        setDescription(product.description || '')
        setCommissionPercent(String(product.commissionPercent ?? 0))
        setUnit(product.unit || 'Unidade')
        setAllowFraction(!!product.allowFraction)
        setNotes(product.notes || '')
        setOrigin(product.origin || '')
        setNcm(product.ncm || '')
        setCest(product.cest || '')
        setActive(!!product.active)
        setError('')
        setIsSmartphone(!!product.isSmartphone)
        setPhoneBrand(product.phoneBrand || '')
        setPhoneColor(product.phoneColor || '')
        setImei1(product.imei1 || '')
        setImei2(product.imei2 || '')
        setSerialNumber(product.serialNumber || '')
        setCondition(product.condition || '')
        setWarrantyMonths(product.warrantyMonths ?? null)
        setIsParts(!!product.isParts)
        setIsAccessories(!!product.isAccessories)
        setIsSundries(!!product.isSundries)
      } else {
        // Modo Novo Produto
        setVariationMode('4V')
        setVariationsData(generateVariations('4V', []))
      }
    }
  }, [open, isEdit, product])

  const makeVarFromProduct = () => ({
    name: 'var 1',
    cost: parseFloat(cost) || 0,
    salePrice: parseFloat(salePrice) || 0,
    promoPrice: promoPrice ? (parseFloat(promoPrice) || 0) : null,
    barcode: barcode.trim(),
    reference: reference.trim(),
    validityDate: validityDate || null,
    stockInitial: parseInt(stock, 10) || 0,
    stockMin: parseInt(stockMin, 10) || 0,
    stock: parseInt(stock, 10) || 0,
    active: !!active,
  })

  if(!open) return null

  const close = () => {
    if (saving) return
    onClose && onClose()
    // reset state when closing
    setTab('cadastro')
    setName('')
    setCategoryId('')
    setSupplier('')
    setCost('0')
    setSalePrice('0')
    setPromoPrice('')
    setBarcode('')
    setReference('')
    setValidityDate('')
    setControlStock(true)
    setStock('0')
    setStockMin('0')
    setShowInCatalog(false)
    setFeatured(false)
    setVariations('0')
    setVariationsData([])
    setDescription('')
    setCommissionPercent('0')
    setUnit('Unidade')
    setAllowFraction(false)
    setNotes('')
    setOrigin('')
    setNcm('')
    setCest('')
    setActive(true)
    setError('')
    setCatSelectOpen(false)
    setNewCatOpen(false)
    setSupSelectOpen(false)
    setNewSupOpen(false)
    setIsSmartphone(false)
    setPhoneBrand('')
    setPhoneColor('')
    setImei1('')
    setImei2('')
    setSerialNumber('')
    setCondition('')
    setWarrantyMonths(null)
    setIsParts(false)
    setIsAccessories(false)
    setIsSundries(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if(!name.trim()){
      setError('Informe o nome do produto.')
      return
    }
    setSaving(true)
    try{
      let finalReference = reference.trim()
      if (!finalReference) {
        finalReference = await getNextProductReference(storeId)
      }

      const sale = parseFloat(salePrice) || 0
      const promo = promoPrice ? (parseFloat(promoPrice) || 0) : null

      const hasVars = variationsData.length > 0
      const priceCandidates = hasVars
        ? variationsData.map(v => (v.promoPrice != null ? (parseFloat(v.promoPrice) || 0) : (parseFloat(v.salePrice) || 0)))
        : [promo ?? sale]
      const salePrices = hasVars
        ? variationsData.map(v => parseFloat(v.salePrice) || 0)
        : [sale]
      const priceMinAgg = Math.min(...priceCandidates)
      const priceMaxAgg = Math.max(...salePrices)
      const stockAgg = hasVars
        ? variationsData.reduce((s, v)=> s + (parseInt(v.stock, 10) || 0), 0)
        : (parseInt(stock, 10) || 0)
      const stockInitialAgg = hasVars
        ? variationsData.reduce((s, v)=> s + ((parseInt(v.stockInitial, 10) || (parseInt(v.stock, 10) || 0))), 0)
        : (parseInt(stock, 10) || 0)
      const variationsCount = hasVars ? variationsData.length : (parseInt(variations) || 0)

      const data = {
        name: name.trim(),
        categoryId: categoryId || null,
        supplier: supplier.trim(),
        cost: parseFloat(cost) || 0,
        salePrice: hasVars ? priceMaxAgg : sale,
        promoPrice: hasVars ? null : promo,
        priceMin: hasVars ? priceMinAgg : (promo ?? sale),
        priceMax: hasVars ? priceMaxAgg : sale,
        barcode: barcode.trim(),
        reference: finalReference,
        validityDate: validityDate || null,
        controlStock: !!controlStock,
        stockInitial: stockInitialAgg,
        stockMin: parseInt(stockMin, 10) || 0,
        stock: stockAgg,
        showInCatalog: !!showInCatalog,
        featured: !!featured,
        variations: variationsCount,
        variationsData,
        description: description.trim(),
        commissionPercent: parseFloat(commissionPercent) || 0,
        unit,
        allowFraction: !!allowFraction,
        notes: notes.trim(),
        origin,
        ncm: ncm.trim(),
        cest: cest.trim(),
        active: !!active,
        isSmartphone: !!isSmartphone,
        phoneBrand: phoneBrand.trim(),
        phoneColor: phoneColor.trim(),
        imei1: imei1.trim(),
        imei2: imei2.trim(),
        serialNumber: serialNumber.trim(),
        condition: condition || '',
        warrantyMonths: warrantyMonths != null ? Number(warrantyMonths) : null,
        isParts: !!isParts,
        isAccessories: !!isAccessories,
        isSundries: !!isSundries,
        lastEditedBy: user?.name || 'Desconhecido',
      }
      if(isEdit && product?.id){
        await updateProduct(product.id, data)
      } else {
        data.createdBy = user?.name || 'Desconhecido'
        await addProduct(data, storeId)
      }
      close()
    }catch(err){
      console.error(err)
      const code = err?.code || 'unknown'
      const msg = err?.message || 'Sem detalhes.'
      setError(`Erro ao salvar: ${code}. ${msg}`)
    }finally{
      setSaving(false)
    }
  }


  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[980px] max-w-[98vw]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">{isEdit ? 'Editar produto' : 'Novo produto'}</h3>
          <button onClick={close} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="px-4 pt-3 border-b flex items-center gap-6 text-sm">
          <button onClick={()=>setTab('cadastro')} className={`pb-2 ${tab==='cadastro' ? 'text-green-600 border-b-2 border-green-600 font-semibold' : 'text-gray-600'}`}>Cadastro</button>
          <button onClick={isEdit ? ()=>setTab('estoque') : undefined} className={`pb-2 ${tab==='estoque' ? 'text-green-600 border-b-2 border-green-600 font-semibold' : 'text-gray-600'} ${isEdit ? '' : 'opacity-50 cursor-not-allowed'}`}>Estoque</button>
        </div>
        <form onSubmit={handleSubmit}><div className="p-4"><div className="max-h-[70vh] overflow-y-auto space-y-4 pr-1">
          {error && <div className="text-sm text-red-600">{error}</div>}

{tab==='cadastro' ? (
  <>
    <div>
      <div className="font-semibold mb-2">Dados do produto</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 order-2 md:order-none">
          <input value={name} onChange={e=>setName(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" placeholder="Nome do produto" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Categoria</label>
              <button type="button" onClick={()=>setCatSelectOpen(true)} className="mt-1 w-full border rounded px-3 py-2 text-sm text-left">
                {categories.find(c=>c.id===categoryId)?.name || 'Selecionar categoria'}
              </button>
            </div>
            <div>
              <label className="text-xs text-gray-600">Fornecedor</label>
              <button type="button" onClick={()=>setSupSelectOpen(true)} className="mt-1 w-full border rounded px-3 py-2 text-sm text-left">
                {supplier || 'Selecionar fornecedor'}
              </button>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <span className="text-sm">Smarthphone</span>
                <button type="button" onClick={()=>setIsSmartphone(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${isSmartphone ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${isSmartphone ? 'translate-x-4' : 'translate-x-1'}`}></span>
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm">Peças</span>
                <button type="button" onClick={()=>setIsParts(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${isParts ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${isParts ? 'translate-x-4' : 'translate-x-1'}`}></span>
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm">Acessórios</span>
                <button type="button" onClick={()=>setIsAccessories(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${isAccessories ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${isAccessories ? 'translate-x-4' : 'translate-x-1'}`}></span>
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm">Diversos</span>
                <button type="button" onClick={()=>setIsSundries(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${isSundries ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${isSundries ? 'translate-x-4' : 'translate-x-1'}`}></span>
                </button>
              </div>
            </div>
            {(isSmartphone || isParts || isAccessories || isSundries) && (
              <div className="mt-3 space-y-3">
                {isSmartphone && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs text-gray-600">Marca do celular</label>
                        <input value={phoneBrand} onChange={e=>setPhoneBrand(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" placeholder="Ex.: Samsung" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Cor</label>
                        <input value={phoneColor} onChange={e=>setPhoneColor(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" placeholder="Ex.: Preto" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Número de série</label>
                        <input value={serialNumber} onChange={e=>setSerialNumber(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-600">IMEI 1</label>
                        <input value={imei1} onChange={e=>setImei1(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">IMEI 2</label>
                        <input value={imei2} onChange={e=>setImei2(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <div className="text-xs text-gray-600 mb-1">Condição</div>
                  <div className="flex items-center gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="condicao" checked={condition==='novo'} onChange={()=>setCondition('novo')} />
                      <span>Novo</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="condicao" checked={condition==='vitrine'} onChange={()=>setCondition('vitrine')} />
                      <span>Vitrine</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="condicao" checked={condition==='usado'} onChange={()=>setCondition('usado')} />
                      <span>Usado</span>
                    </label>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">Garantia</div>
                  <div className="flex items-center gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="garantia" checked={warrantyMonths===3} onChange={()=>setWarrantyMonths(3)} />
                      <span>3m</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="garantia" checked={warrantyMonths===6} onChange={()=>setWarrantyMonths(6)} />
                      <span>6m</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="garantia" checked={warrantyMonths===12} onChange={()=>setWarrantyMonths(12)} />
                      <span>12m</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="order-first md:order-none">
          <div className="h-32 border rounded flex items-center justify-center text-gray-400 text-sm">Sem imagem</div>
          <button type="button" disabled className="mt-2 px-3 py-2 border rounded text-xs text-gray-400">Adicionar fotos</button>
        </div>
      </div>
    </div>

    <div className={`${variationsData.length >= 2 ? 'hidden' : ''}`}>
      <div className="font-semibold mb-2">Preço e estoque</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-gray-600">Custo</label>
          <input type="number" step="0.01" value={cost} onChange={e=>setCost(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-600">Preço de venda</label>
          <input type="number" step="0.01" value={salePrice} onChange={e=>setSalePrice(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-600">Preço promocional</label>
          <input type="number" step="0.01" value={promoPrice} onChange={e=>setPromoPrice(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="mt-2">
        <button type="button" onClick={()=>{ const c=parseFloat(cost)||0; const com=parseFloat(commissionPercent)||0; const r=c*(1+(com/100)); setSalePrice(String(r.toFixed(2))); }} className="text-xs text-green-700">Calcular preço de venda</button>
      </div>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-gray-600">Código de barras</label>
          <input value={barcode} onChange={e=>setBarcode(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-600">Código do produto</label>
          <input value={reference} onChange={e=>setReference(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" placeholder="Automático se vazio" />
        </div>
        <div>
          <label className="text-xs text-gray-600">Validade</label>
          <input type="date" value={validityDate} onChange={e=>setValidityDate(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-gray-600">Estoque inicial</label>
          <input type="number" value={stock} onChange={e=>setStock(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-600">Estoque mínimo (alerta)</label>
          <input type="number" value={stockMin} onChange={e=>setStockMin(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm mt-1">
            {/* Switch: Cadastro Ativo */}
            <span>Cadastro Ativo</span>
            <button type="button" onClick={()=>setActive(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${active ? 'bg-green-500' : 'bg-gray-300'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${active ? 'translate-x-4' : 'translate-x-1'}`}></span>
            </button>
          </label>
        </div>
      </div>
      <div className="mt-3 flex flex-col md:flex-row gap-4 md:gap-8 text-sm">
        {/* Switches: Controlar estoque / Exibir no catálogo / Destacar produto */}
        <div className="flex items-center gap-2">
          <span>Controlar estoque</span>
          <button type="button" onClick={()=>setControlStock(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${controlStock ? 'bg-green-500' : 'bg-gray-300'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${controlStock ? 'translate-x-4' : 'translate-x-1'}`}></span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span>Exibir no catálogo</span>
          <button type="button" onClick={()=>setShowInCatalog(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${showInCatalog ? 'bg-green-500' : 'bg-gray-300'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${showInCatalog ? 'translate-x-4' : 'translate-x-1'}`}></span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span>Destacar produto</span>
          <button type="button" onClick={()=>setFeatured(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${featured ? 'bg-green-500' : 'bg-gray-300'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${featured ? 'translate-x-4' : 'translate-x-1'}`}></span>
          </button>
        </div>
      </div>

    </div>

    <div>
      <div className="flex items-center gap-4 mb-3">
        <span className="text-sm font-medium text-gray-700">Quantidade de Precificações:</span>
        <div className="flex items-center bg-gray-100 rounded-lg p-1 border">
          <button 
            type="button" 
            onClick={() => { setVariationMode('3V'); setVariationsData(generateVariations('3V', variationsData)); }}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${variationMode === '3V' ? 'bg-white text-green-700 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
          >
            3V
          </button>
          <button 
            type="button" 
            onClick={() => { setVariationMode('4V'); setVariationsData(generateVariations('4V', variationsData)); }}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${variationMode === '4V' ? 'bg-white text-green-700 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
          >
            4V
          </button>
          <button 
            type="button" 
            onClick={() => { setVariationMode('5V'); setVariationsData(generateVariations('5V', variationsData)); }}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${variationMode === '5V' ? 'bg-white text-green-700 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
          >
            5V
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">Precificações</div>
        <button type="button" onClick={()=> setVarModalOpen(true)} className="px-3 py-2 border rounded text-sm">Gerenciar precificações</button>
      </div>
      {/* Mobile list */}
      <div className="md:hidden">
        <div className="text-xs text-gray-600">{variationsData.length} precificações</div>
        <div className="mt-2 border rounded overflow-hidden">
          {variationsData.map((v, idx) => (
            <div key={idx} className="px-3 py-3 border-b last:border-0">
              <div className="grid grid-cols-[1fr_auto_auto] items-start gap-3">
                <div>
                  <div className="text-sm font-medium leading-tight truncate" title={v.name}>{v.name || '-'}</div>
                  {(idx === 0 || idx === 4) && (
                    <div className="mt-1 text-xs text-gray-600">
                      <span>Estoque: {v.stock ?? 0}</span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 pt-[1px]">{(v.reference || '').trim() ? v.reference : ''}</div>
                <div className="text-right">
                  <div className="text-base font-semibold leading-tight">{((v.promoPrice ?? v.salePrice) ?? 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</div>
                  <div className="text-xs text-gray-600">Custo: {(v.cost ?? 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</div>
                </div>
              </div>
            </div>
          ))}
          {variationsData.length === 0 && (
            <div className="px-3 py-6 text-sm text-gray-500">Nenhuma variação adicionada ainda.</div>
          )}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <div className="text-xs text-gray-600">{variationsData.length} precificações</div>
        <div className="mt-2 border rounded overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-3 py-2 text-xs text-gray-500 border-b">
            <div>Nome</div>
            <div className="text-right">Custo</div>
            <div className="text-right">Preço</div>
            <div className="text-right">Estoque Min.</div>
            <div className="text-right">Estoque</div>
          </div>
          {variationsData.map((v, idx) => (
            <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-3 py-2 border-b last:border-0 text-sm">
              <div className="truncate" title={v.name}>{v.name || '-'}</div>
              <div className="text-right">{(v.cost ?? 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</div>
              <div className="text-right">{(v.salePrice ?? 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</div>
              <div className="text-right">{(idx === 0 || idx === 4) ? (v.stockMin ?? 0) : ''}</div>
              <div className={`text-right ${(v.stock ?? 0) > 0 ? '' : 'text-red-600'}`}>{(idx === 0 || idx === 4) ? (v.stock ?? 0) : ''}</div>
            </div>
          ))}
          {variationsData.length === 0 && (
            <div className="px-3 py-6 text-sm text-gray-500">Nenhuma variação adicionada ainda.</div>
          )}
        </div>
      </div>

      <div className="font-semibold mb-2">Dados adicionais</div>
      <textarea value={description} onChange={e=>setDescription(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" placeholder="Descrição do produto" rows={3} />
      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-gray-600">Comissão (%)</label>
          <input type="number" step="0.01" value={commissionPercent} onChange={e=>setCommissionPercent(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-600">Unidade de venda</label>
          <select value={unit} onChange={e=>setUnit(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm">
            <option>Unidade</option>
            <option>Caixa</option>
            <option>Pacote</option>
            <option>Metro</option>
          </select>
        </div>
        <div className="flex items-end">
          {/* Switch: Permite vender fracionado */}
          <div className="flex items-center gap-2 text-sm">
            <span>Permite vender fracionado</span>
            <button type="button" onClick={()=>setAllowFraction(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${allowFraction ? 'bg-green-500' : 'bg-gray-300'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${allowFraction ? 'translate-x-4' : 'translate-x-1'}`}></span>
            </button>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <label className="text-xs text-gray-600">Observações internas</label>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" rows={2} />
      </div>
      <div className="mt-3">
        <div className="font-semibold mb-2">Dados Fiscais</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-600">Origem da mercadoria</label>
            <select value={origin} onChange={e=>setOrigin(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm">
              <option value="">Selecionar...</option>
              <option value="0">0 - Nacional</option>
              <option value="1">1 - Estrangeira - Importação direta</option>
              <option value="2">2 - Estrangeira - Adquirida no mercado interno</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">NCM</label>
            <input value={ncm} onChange={e=>setNcm(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-600">CEST</label>
            <input value={cest} onChange={e=>setCest(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
          </div>
        </div>
      </div>
    </div>
  </>
) : (
  <>
    <div className="font-semibold mb-2">Estoque</div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="text-xs text-gray-600">Estoque inicial</label>
        <input type="number" value={stock} onChange={e=>setStock(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-xs text-gray-600">Estoque mínimo (alerta)</label>
        <input type="number" value={stockMin} onChange={e=>setStockMin(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
      </div>
    </div>
    <div className="mt-3 flex items-center gap-8 text-sm">
      <div className="flex items-center gap-2">
        <span>Controlar estoque</span>
        <button type="button" onClick={()=>setControlStock(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${controlStock ? 'bg-green-500' : 'bg-gray-300'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${controlStock ? 'translate-x-4' : 'translate-x-1'}`}></span>
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span>Exibir no catálogo</span>
        <button type="button" onClick={()=>setShowInCatalog(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${showInCatalog ? 'bg-green-500' : 'bg-gray-300'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${showInCatalog ? 'translate-x-4' : 'translate-x-1'}`}></span>
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span>Destacar produto</span>
        <button type="button" onClick={()=>setFeatured(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${featured ? 'bg-green-500' : 'bg-gray-300'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${featured ? 'translate-x-4' : 'translate-x-1'}`}></span>
        </button>
      </div>
    </div>
  </>
)}
</div>
</div>

<div className="px-6 py-3 border-t">
  <label className="flex items-center gap-2 text-sm">
    <span>Cadastro Ativo</span>
    <button type="button" onClick={()=>setActive(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${active ? 'bg-green-500' : 'bg-gray-300'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${active ? 'translate-x-4' : 'translate-x-1'}`}></span>
    </button>
  </label>
 </div>

<div className="flex items-center justify-end gap-3 pt-2 px-6">
  <button type="button" onClick={close} className="px-3 py-2 border rounded text-sm">Cancelar</button>
  <button disabled={saving} type="submit" className="px-3 py-2 rounded text-sm bg-green-600 text-white disabled:opacity-60">Confirmar</button>
</div>
        </form>
        {varModalOpen && (
            <VariationsModal
              open={varModalOpen}
              commissionPercent={commissionPercent}
              initialItems={variationsData.length ? variationsData : [makeVarFromProduct()]}
              defaultReference={reference}
              onClose={()=> setVarModalOpen(false)}
              onConfirm={(items) => {
                setVariationsData(items)
                setVariations(String(items.length))
                if(items.length >= 1){
                  const v1 = items[0]
                  setCost(String(v1.cost ?? 0))
                  setSalePrice(String(v1.salePrice ?? 0))
                  setPromoPrice(v1.promoPrice != null ? String(v1.promoPrice) : '')
                  setBarcode(v1.barcode ?? '')
                  setReference(v1.reference ?? '')
                  setValidityDate(v1.validityDate ?? null)
                  const s = v1.stock ?? v1.stockInitial ?? 0
                  setStock(String(s))
                  setStockMin(String(v1.stockMin ?? 0))
                  setActive(!!v1.active)
                }
                setVarModalOpen(false)
              }}
            />
          )}
          {catSelectOpen && (
            <SelectCategoryModal
              open={catSelectOpen}
              onClose={() => setCatSelectOpen(false)}
              onSelect={(c) => { 
                setCategoryId(c ? c.id : ''); 
                setCatSelectOpen(false); 
              }}
              categories={categories}
              onNew={() => setNewCatOpen(true)}
            />
          )}
          {newCatOpen && (
            <NewCategoryModal
              open={newCatOpen}
              onClose={()=> setNewCatOpen(false)}
              storeId={storeId}
            />
          )}
          {supSelectOpen && (
            <SelectSupplierModal
              open={supSelectOpen}
              onClose={() => setSupSelectOpen(false)}
              onSelect={(s) => { 
                setSupplier(s ? (s.name || '') : ''); 
                setSupSelectOpen(false); 
              }}
              suppliers={suppliers}
              onNew={() => setNewSupOpen(true)}
            />
          )}
          {newSupOpen && (
            <NewSupplierModal
              open={newSupOpen}
              onClose={()=> setNewSupOpen(false)}
              storeId={storeId}
            />
          )}
      </div>
    </div>
  )
}
