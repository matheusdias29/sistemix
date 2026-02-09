import React, { useState, useEffect } from 'react'
import { addProduct, updateProduct, getNextProductReference } from '../services/products'
import { getStoreById, listStoresByOwner } from '../services/stores'
import { addCategory } from '../services/categories'
import { addSupplier } from '../services/suppliers'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../lib/firebase'
import VariationsModal from './VariationsModal'
import NewCategoryModal from './NewCategoryModal'
import NewSupplierModal from './NewSupplierModal'
import SelectCategoryModal from './SelectCategoryModal'
import SelectSupplierModal from './SelectSupplierModal'

export const ensureSupplierInStore = async (supplierData, targetStoreId) => {
  if (!supplierData || !supplierData.name) return
  try {
    console.log(`[Sync] Verificando fornecedor "${supplierData.name}" na loja ${targetStoreId}...`)
    const supCol = collection(db, 'suppliers')
    // Busca na loja de destino pelo nome do fornecedor original identificado
    const supQuery = query(supCol, where('storeId', '==', targetStoreId), where('name', '==', supplierData.name))
    const supSnap = await getDocs(supQuery)

    if (supSnap.empty) {
      console.log(`[Sync] Fornecedor não encontrado na loja ${targetStoreId}. Criando...`)
      
      // Preparar objeto limpo para criação
      const supplierToCreate = {
        name: supplierData.name,
        whatsapp: supplierData.whatsapp ?? '',
        phone: supplierData.phone ?? '',
        cnpj: supplierData.cnpj ?? '',
        isCompany: supplierData.isCompany ?? false,
        cep: supplierData.cep ?? '',
        address: supplierData.address ?? '',
        number: supplierData.number ?? '',
        complement: supplierData.complement ?? '',
        neighborhood: supplierData.neighborhood ?? '',
        city: supplierData.city ?? '',
        state: supplierData.state ?? '',
        code: supplierData.code ?? '',
        stateRegistration: supplierData.stateRegistration ?? '',
        email: supplierData.email ?? '',
        notes: supplierData.notes ?? '',
        active: true // Forçar ativo na sincronização
      }

      // Não existe na loja de destino, criar cópia
      const newSupId = await addSupplier(supplierToCreate, targetStoreId)
      console.log(`[Sync] Fornecedor criado com sucesso na loja ${targetStoreId}. ID: ${newSupId}`)
    } else {
      console.log(`[Sync] Fornecedor já existe na loja ${targetStoreId}. ID: ${supSnap.docs[0].id}`)
    }
  } catch (supErr) {
    console.error(`[Sync] Erro ao sincronizar fornecedor para loja ${targetStoreId}:`, supErr)
  }
}

export default function NewProductModal({ open, onClose, isEdit=false, product=null, categories=[], suppliers=[], storeId, user, syncProducts=false, canCreateCategory=true, canCreateSupplier=true }){
  const [name, setName] = useState('')
  const [priceMin, setPriceMin] = useState('0')
  const [priceMax, setPriceMax] = useState('0')
  const [stock, setStock] = useState('0')
  const [variations, setVariations] = useState('0')
  // Imagem
  const [imageFile, setImageFile] = useState(null)
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  
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
  const [variationMode, setVariationMode] = useState('4P')
  const VAR_NAMES_3P = [
    '1 - PREÇO P/ CLIENTE FINAL',
    '2 - PREÇO PARCELADO CARTAO CREDITO 7X ATÉ 12X',
    '3 - PREÇO P/ LOJISTA LEVAR',
    '4 - PREÇO MAO DE OBRA P/ INSTALAR NA LOJA'
  ]
  const VAR_NAMES_4P = [
    '1 - PREÇO P/ CLIENTE FINAL',
    '2 - PREÇO CARTÃO CREDITO 7X ATÉ 12X',
    '3 - PREÇO CARTÃO CREDITO 13X ATÉ 18X',
    '4 - PREÇO P/LOJISTA LEVAR Á VISTA'
  ]
  const VAR_NAMES_5P = [
    ...VAR_NAMES_4P,
    '5 - PREÇO P/ LOJISTA INSTALAR NA LOJA'
  ]

  const generateVariations = (mode, currentVars = []) => {
    let targetNames = VAR_NAMES_4P
    if (mode === '5P') targetNames = VAR_NAMES_5P
    else if (mode === '3P') targetNames = VAR_NAMES_3P
    
    const altNameMap = {
      '2 - PREÇO CARTÃO CREDITO 7X ATÉ 12X': [
        '2 - PREÇO PARCELADO CARTAO CREDITO 7X ATÉ 12X',
        '2 - PREÇO PARCELADO 7X ATÉ 12X CARTÃO CREDITO'
      ],
      '3 - PREÇO CARTÃO CREDITO 13X ATÉ 18X': [
        '3 - PREÇO PARCELADO 13X ATÉ 18X CARTÃO CREDITO'
      ],
      '5 - PREÇO P/ LOJISTA INSTALAR NA LOJA': [
        '5 - PREÇO MAO DE OBRA P/INSTALAR NA LOJA',
        '5-PREÇO P/INSTALAR NA LOJA',
        '5-VALOR P/INSTALAR NA LOJA'
      ]
    }

    return targetNames.map(name => {
      // Try to find exact match
      let existing = currentVars.find(v => v.name === name)
      
      // Handle specific rename for item 1 in 4P/5P
      if (!existing && name === '1 - PREÇO P/ CLIENTE FINAL') {
         const possibleOldNames = ['1- PREÇO DO PRODUTO', '1- VALOR DO PRODUTO']
         const oldVar = currentVars.find(v => possibleOldNames.includes(v.name))
         if (oldVar) {
             existing = { ...oldVar, name: name }
         }
      }

      // If not found, try alternative names configured for this slot
      if (!existing && altNameMap[name]) {
        const candidates = altNameMap[name]
        const old = currentVars.find(v => candidates.includes(v.name))
        if (old) {
          existing = { ...old, name }
        }
      }

      // If still not found, try to find legacy "VALOR" name and migrate it
      if (!existing && name.includes('PREÇO')) {
        const legacyName = name.replace('PREÇO', 'VALOR')
        const legacy = currentVars.find(v => v.name === legacyName)
        if (legacy) {
          existing = { ...legacy, name: name }
        }
      }
      
      // Also check by index if possible (fragile but helpful for simple renames)
      // Actually, let's just stick to name matching for now.
      
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
        setImageUrl(product.imageUrl || '')
        setVariations(String(product.variations ?? 0))
        
        const vData = Array.isArray(product.variationsData) ? product.variationsData : []
        // Detecção do modo baseado nos nomes das variações
        const has5th = vData.some(v => [
          '5 - PREÇO P/ LOJISTA INSTALAR NA LOJA',
          '5 - PREÇO MAO DE OBRA P/INSTALAR NA LOJA',
          '5-PREÇO P/INSTALAR NA LOJA',
          '5-VALOR P/INSTALAR NA LOJA'
        ].includes(v.name))
        const has3rd = vData.some(v => v.name === '3 - PREÇO P/ LOJISTA INSTALADA NA LOJA')
        
        let initialMode = '4P'
        if (has5th) initialMode = '5P'
        else if (has3rd) initialMode = '3P'
        
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
        setVariationMode('4P')
        setVariationsData(generateVariations('4P', []))
        
        if (storeId) {
          getNextProductReference(storeId).then(ref => {
            if(ref) setReference(ref)
          })
        }
      }
    }
  }, [open, isEdit, product, storeId])

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
    setImageFile(null)
    setImageUrl('')
    setUploading(false)
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

  const handleImageChange = (e) => {
    if (e.target.files[0]) {
      const file = e.target.files[0]
      setImageFile(file)
      setImageUrl(URL.createObjectURL(file))
    }
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
      let finalImageUrl = imageUrl
      if (imageFile) {
        setUploading(true)
        try {
          const storageRef = ref(storage, `products/${storeId}/${Date.now()}_${imageFile.name}`)
          const snapshot = await uploadBytes(storageRef, imageFile)
          finalImageUrl = await getDownloadURL(snapshot.ref)
        } catch (err) {
          console.error("Erro ao fazer upload da imagem", err)
          alert('Erro ao fazer upload da imagem. O produto será salvo sem a nova imagem.')
        } finally {
          setUploading(false)
        }
      }

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
        ? variationsData.reduce((s, v, idx)=> idx === 4 ? s : s + (parseInt(v.stock, 10) || 0), 0)
        : (parseInt(stock, 10) || 0)
      const stockInitialAgg = hasVars
        ? variationsData.reduce((s, v, idx)=> idx === 4 ? s : s + ((parseInt(v.stockInitial, 10) || (parseInt(v.stock, 10) || 0))), 0)
        : (parseInt(stock, 10) || 0)
      const variationsCount = hasVars ? variationsData.length : (parseInt(variations) || 0)

      const data = {
        name: name.trim(),
        imageUrl: finalImageUrl,
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
        rootId: product?.rootId || crypto.randomUUID(),
      }
      if(isEdit && product?.id){
        await updateProduct(product.id, data)

        // Sincronização na edição
        if (syncProducts) {
          try {
            const currentStore = await getStoreById(storeId)
            if (currentStore && currentStore.ownerId) {
              const allStores = await listStoresByOwner(currentStore.ownerId)
              const otherStores = allStores.filter(s => s.id !== storeId)
              
              if (otherStores.length > 0) {
                console.log(`[Sync] Sincronizando atualização para mais ${otherStores.length} lojas...`)
                
                // Preparar dados de Categoria e Fornecedor
                const sourceCategory = categories.find(c => c.id === categoryId)
                let sourceSupplierFull = null
                if (supplier && supplier.trim()) {
                  const cleanSupplier = supplier.trim()
                  sourceSupplierFull = suppliers.find(s => s.name === cleanSupplier)
                  if (!sourceSupplierFull) {
                    sourceSupplierFull = suppliers.find(s => s.name.toLowerCase() === cleanSupplier.toLowerCase())
                  }
                  
                // 3. Se ainda não achou, busca no banco da loja de origem
                  if (!sourceSupplierFull) {
                    try {
                      const supCol = collection(db, 'suppliers')
                      const sourceSupQuery = query(supCol, where('storeId', '==', storeId), where('name', '==', cleanSupplier))
                      const sourceSupSnap = await getDocs(sourceSupQuery)
                      if (!sourceSupSnap.empty) {
                        sourceSupplierFull = sourceSupSnap.docs[0].data()
                      }
                    } catch (e) {
                      console.error('Erro ao buscar fornecedor original para cópia:', e)
                    }
                  }

                  if (!sourceSupplierFull) {
                     sourceSupplierFull = { name: cleanSupplier }
                  }
                }

                for (const store of otherStores) {
                  try {
                    // Tentar encontrar o produto correspondente na outra loja
                    const prodCol = collection(db, 'products')
                    
                    // Estratégia de busca: RootID -> Reference -> Name
                    let targetProduct = null

                    // 0. Busca por RootID (Identificador Único Global)
                    if (data.rootId) {
                      console.log(`[Sync] Buscando por rootId "${data.rootId}" na loja ${store.id}`)
                      const qRoot = query(prodCol, where('storeId', '==', store.id), where('rootId', '==', data.rootId))
                      const snapRoot = await getDocs(qRoot)
                      if (!snapRoot.empty) {
                        targetProduct = { id: snapRoot.docs[0].id, ...snapRoot.docs[0].data() }
                        console.log(`[Sync] Produto encontrado por rootId.`)
                      }
                    }
                    
                    // 1. Tenta por Reference Original (se houver)
                    if (!targetProduct && product.reference && product.reference.trim()) {
                      const refToSearch = product.reference.trim()
                      console.log(`[Sync] Buscando por referência original "${refToSearch}" na loja ${store.id}`)
                      const qRef = query(prodCol, where('storeId', '==', store.id), where('reference', '==', refToSearch))
                      const snapRef = await getDocs(qRef)
                      if (!snapRef.empty) targetProduct = { id: snapRef.docs[0].id, ...snapRef.docs[0].data() }
                    }

                    // 2. Se não achou, tenta por Nome Original
                    if (!targetProduct && product.name) {
                      console.log(`[Sync] Buscando por nome original "${product.name}" na loja ${store.id}`)
                      let qName = query(prodCol, where('storeId', '==', store.id), where('name', '==', product.name))
                      let snapName = await getDocs(qName)
                      if (!snapName.empty) {
                        targetProduct = { id: snapName.docs[0].id, ...snapName.docs[0].data() }
                      } else {
                        // Tentativa extra: Nome Trimmed (sem espaços extras nas pontas)
                        const trimmedName = product.name.trim()
                        if (trimmedName !== product.name) {
                            console.log(`[Sync] Buscando por nome trimmed "${trimmedName}" na loja ${store.id}`)
                            qName = query(prodCol, where('storeId', '==', store.id), where('name', '==', trimmedName))
                            snapName = await getDocs(qName)
                            if (!snapName.empty) targetProduct = { id: snapName.docs[0].id, ...snapName.docs[0].data() }
                        }
                      }
                    }

                    // 3. Fallback: Se não achou pelo original, tenta pela referência NOVA
                    // (Útil se o usuário adicionou um código agora e quer vincular a um produto que já tem esse código lá)
                    if (!targetProduct && data.reference && data.reference !== product.reference) {
                       console.log(`[Sync] Buscando por nova referência "${data.reference}" na loja ${store.id}`)
                       const qRefNew = query(prodCol, where('storeId', '==', store.id), where('reference', '==', data.reference))
                       const snapRefNew = await getDocs(qRefNew)
                       if (!snapRefNew.empty) targetProduct = { id: snapRefNew.docs[0].id, ...snapRefNew.docs[0].data() }
                    }

                    if (targetProduct) {
                      console.log(`[Sync] Produto encontrado na loja ${store.id} (ID: ${targetProduct.id}). Atualizando...`)
                      
                      // Resolver Categoria na loja destino
                      let targetCategoryId = null
                      if (sourceCategory) {
                        const catCol = collection(db, 'categories')
                        const catQuery = query(catCol, where('storeId', '==', store.id), where('name', '==', sourceCategory.name))
                        const catSnap = await getDocs(catQuery)
                        if (!catSnap.empty) {
                          targetCategoryId = catSnap.docs[0].id
                        } else {
                          targetCategoryId = await addCategory({ name: sourceCategory.name, active: true }, store.id)
                        }
                      }

                      // Resolver Fornecedor na loja destino
                      if (sourceSupplierFull) {
                         await ensureSupplierInStore(sourceSupplierFull, store.id)
                      }

                      // Preparar dados de update
                      // Preservar estoque original da loja destino
                      const updatePayload = {
                        ...data,
                        storeId: store.id,
                        categoryId: targetCategoryId,
                        stock: targetProduct.stock, // Preserva estoque total
                        stockInitial: targetProduct.stockInitial, // Preserva inicial
                        createdBy: targetProduct.createdBy, // Preserva criador original
                        createdAt: targetProduct.createdAt // Preserva data criação
                      }
                      
                      // Preservar reference (código) original da loja destino, se existir
                      if (targetProduct.reference) {
                        updatePayload.reference = targetProduct.reference
                      }

                      // Ajuste fino para variações: Tentar preservar estoque de variações existentes
                      if (updatePayload.variationsData && updatePayload.variationsData.length > 0) {
                         updatePayload.variationsData = updatePayload.variationsData.map(v => {
                           // Tenta achar essa variação no produto destino antigo
                           // Match por nome
                           const oldVar = (targetProduct.variationsData || []).find(ov => ov.name === v.name)
                           if (oldVar) {
                             return { ...v, stock: oldVar.stock, stockInitial: oldVar.stockInitial }
                           }
                           // Se é variação nova na estrutura, começa com 0
                           return { ...v, stock: 0, stockInitial: 0 }
                         })
                         
                         // Recalcular stock total baseado nas variações preservadas
                         const newStockTotal = updatePayload.variationsData.reduce((acc, curr) => acc + (Number(curr.stock)||0), 0)
                         updatePayload.stock = newStockTotal
                      }

                      await updateProduct(targetProduct.id, updatePayload)
                      console.log(`[Sync] Produto atualizado na loja ${store.id}`)
                    } else {
                      console.log(`[Sync] Produto correspondente não encontrado na loja ${store.id} para atualização.`)
                    }

                  } catch (errLoop) {
                    console.error(`[Sync] Erro ao atualizar loja ${store.id}:`, errLoop)
                  }
                }
              }
            }
          } catch (syncErr) {
            console.error('[Sync] Erro geral na sincronização de edição:', syncErr)
          }
        }

      } else {
        data.createdBy = user?.name || 'Desconhecido'
        const newId = await addProduct(data, storeId)

        // Sincronização entre lojas (somente na criação)
        if (syncProducts) {
          try {
            // Obter dados da loja atual para saber o ownerId
            // Se o usuário for owner, user.uid pode ser usado, mas melhor garantir via store
            const currentStore = await getStoreById(storeId)
            if (currentStore && currentStore.ownerId) {
              const allStores = await listStoresByOwner(currentStore.ownerId)
              const otherStores = allStores.filter(s => s.id !== storeId)
              
              if (otherStores.length > 0) {
                console.log(`Sincronizando produto para mais ${otherStores.length} lojas...`)
                const sourceCategory = categories.find(c => c.id === categoryId)

                // Preparar dados do fornecedor original UMA VEZ antes do loop
                let sourceSupplierFull = null
                if (supplier && supplier.trim()) {
                  const cleanSupplier = supplier.trim()
                  // 1. Tenta encontrar na lista local (props)
                  sourceSupplierFull = suppliers.find(s => s.name === cleanSupplier)
                  
                  // 2. Tenta case-insensitive
                  if (!sourceSupplierFull) {
                    sourceSupplierFull = suppliers.find(s => s.name.toLowerCase() === cleanSupplier.toLowerCase())
                  }

                  // 3. Se ainda não achou, busca no banco da loja de origem
                  if (!sourceSupplierFull) {
                    try {
                      const supCol = collection(db, 'suppliers')
                      const sourceSupQuery = query(supCol, where('storeId', '==', storeId), where('name', '==', cleanSupplier))
                      const sourceSupSnap = await getDocs(sourceSupQuery)
                      if (!sourceSupSnap.empty) {
                        sourceSupplierFull = sourceSupSnap.docs[0].data()
                      }
                    } catch (e) {
                      console.error('Erro ao buscar fornecedor original para cópia:', e)
                    }
                  }

                  // Fallback apenas com o nome se realmente não encontrar nada
                  if (!sourceSupplierFull) {
                    sourceSupplierFull = { name: cleanSupplier }
                  }
                }

                const syncData = {
                  ...data,
                  // Campos específicos para sincronização simplificada
                  storeId: null, // Será setado no loop
                  stock: 0,
                  stockInitial: 0,
                  // Mantemos stockMin, preços, variações e outros dados "idênticos"
                  // Apenas zeramos o estoque físico atual
                  
                  // Limpar referências que podem não existir em outras lojas (serão recalculadas)
                  categoryId: null, 
                }

                // Ajuste para variações: zerar estoque nas variações também, mas manter preços e estrutura
                if (syncData.variationsData && syncData.variationsData.length > 0) {
                  syncData.variationsData = syncData.variationsData.map(v => ({
                    ...v,
                    stock: 0,
                    stockInitial: 0
                  }))
                }

                for (const store of otherStores) {
                  let targetCategoryId = null
                  
                  // Verificar e criar categoria se necessário
                  if (sourceCategory) {
                    try {
                      const catCol = collection(db, 'categories')
                      const catQuery = query(catCol, where('storeId', '==', store.id), where('name', '==', sourceCategory.name))
                      const catSnap = await getDocs(catQuery)
                      
                      if (!catSnap.empty) {
                        targetCategoryId = catSnap.docs[0].id
                      } else {
                        // Criar categoria na loja de destino
                        targetCategoryId = await addCategory({ 
                          name: sourceCategory.name, 
                          active: sourceCategory.active ?? true 
                        }, store.id)
                      }
                    } catch (catErr) {
                      console.error(`Erro ao sincronizar categoria para loja ${store.id}:`, catErr)
                    }
                  }

                  // Verificar e criar fornecedor se necessário
                  if (sourceSupplierFull) {
                    await ensureSupplierInStore(sourceSupplierFull, store.id)
                  }

                  const payload = { 
                    ...syncData, 
                    storeId: store.id,
                    categoryId: targetCategoryId
                  }
                  await addProduct(payload, store.id)
                }
              }
            }
          } catch (syncErr) {
            console.error('Erro na sincronização de produtos:', syncErr)
            // Não impede o fluxo principal, apenas loga erro
          }
        }
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-[980px] max-w-[98vw]">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h3 className="font-semibold text-lg dark:text-white">{isEdit ? 'Editar produto' : 'Novo produto'}</h3>
          <button onClick={close} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">✕</button>
        </div>
        <div className="px-4 pt-3 border-b dark:border-gray-700 flex items-center gap-6 text-sm">
          <button onClick={()=>setTab('cadastro')} className={`pb-2 ${tab==='cadastro' ? 'text-green-600 border-b-2 border-green-600 dark:text-green-400 dark:border-green-400 font-semibold' : 'text-gray-600 dark:text-gray-400'}`}>Cadastro</button>
          <button onClick={isEdit ? ()=>setTab('estoque') : undefined} className={`pb-2 ${tab==='estoque' ? 'text-green-600 border-b-2 border-green-600 dark:text-green-400 dark:border-green-400 font-semibold' : 'text-gray-600 dark:text-gray-400'} ${isEdit ? '' : 'opacity-50 cursor-not-allowed'}`}>Estoque</button>
        </div>
        <form onSubmit={handleSubmit}><div className="p-4"><div className="max-h-[70vh] overflow-y-auto space-y-4 pr-1">
          {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

{tab==='cadastro' ? (
  <>
    <div>
      <div className="font-semibold mb-2 dark:text-white">Dados do produto</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 order-2 md:order-none">
          <input value={name} onChange={e=>setName(e.target.value)} className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" placeholder="Nome do produto" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-300">Categoria</label>
              <button type="button" onClick={()=>setCatSelectOpen(true)} className="mt-1 w-full border dark:border-gray-600 rounded px-3 py-2 text-sm text-left dark:bg-gray-700 dark:text-white">
                {categories.find(c=>c.id===categoryId)?.name || 'Selecionar categoria'}
              </button>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-300">Fornecedor</label>
              <button type="button" onClick={()=>setSupSelectOpen(true)} className="mt-1 w-full border dark:border-gray-600 rounded px-3 py-2 text-sm text-left dark:bg-gray-700 dark:text-white">
                {supplier || 'Selecionar fornecedor'}
              </button>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <span className="text-sm dark:text-gray-300">Smarthphone</span>
                <button type="button" onClick={()=>setIsSmartphone(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${isSmartphone ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${isSmartphone ? 'translate-x-4' : 'translate-x-1'}`}></span>
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm dark:text-gray-300">Peças</span>
                <button type="button" onClick={()=>setIsParts(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${isParts ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${isParts ? 'translate-x-4' : 'translate-x-1'}`}></span>
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm dark:text-gray-300">Acessórios</span>
                <button type="button" onClick={()=>setIsAccessories(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${isAccessories ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${isAccessories ? 'translate-x-4' : 'translate-x-1'}`}></span>
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm dark:text-gray-300">Diversos</span>
                <button type="button" onClick={()=>setIsSundries(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${isSundries ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
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
                        <label className="text-xs text-gray-600 dark:text-gray-300">Marca do celular</label>
                        <input value={phoneBrand} onChange={e=>setPhoneBrand(e.target.value)} className="mt-1 w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" placeholder="Ex.: Samsung" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 dark:text-gray-300">Cor</label>
                        <input value={phoneColor} onChange={e=>setPhoneColor(e.target.value)} className="mt-1 w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" placeholder="Ex.: Preto" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 dark:text-gray-300">Número de série</label>
                        <input value={serialNumber} onChange={e=>setSerialNumber(e.target.value)} className="mt-1 w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-600 dark:text-gray-300">IMEI 1</label>
                        <input value={imei1} onChange={e=>setImei1(e.target.value)} className="mt-1 w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 dark:text-gray-300">IMEI 2</label>
                        <input value={imei2} onChange={e=>setImei2(e.target.value)} className="mt-1 w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Condição</div>
                  <div className="flex items-center gap-4 text-sm dark:text-gray-300">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="condicao" checked={condition==='novo'} onChange={()=>setCondition('novo')} className="dark:bg-gray-700 dark:border-gray-600" />
                      <span>Novo</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="condicao" checked={condition==='vitrine'} onChange={()=>setCondition('vitrine')} className="dark:bg-gray-700 dark:border-gray-600" />
                      <span>Vitrine</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="condicao" checked={condition==='usado'} onChange={()=>setCondition('usado')} className="dark:bg-gray-700 dark:border-gray-600" />
                      <span>Usado</span>
                    </label>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Garantia</div>
                  <div className="flex items-center gap-4 text-sm dark:text-gray-300">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="garantia" checked={warrantyMonths===3} onChange={()=>setWarrantyMonths(3)} className="dark:bg-gray-700 dark:border-gray-600" />
                      <span>3m</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="garantia" checked={warrantyMonths===6} onChange={()=>setWarrantyMonths(6)} className="dark:bg-gray-700 dark:border-gray-600" />
                      <span>6m</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="garantia" checked={warrantyMonths===12} onChange={()=>setWarrantyMonths(12)} className="dark:bg-gray-700 dark:border-gray-600" />
                      <span>12m</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="order-first md:order-none">
          <div className="w-full h-40 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-800 relative">
            {uploading ? (
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Enviando...</span>
              </div>
            ) : imageUrl ? (
                <img src={imageUrl} alt="Preview" className="w-full h-full object-contain" />
            ) : (
                <span className="text-gray-400 dark:text-gray-500 text-xs text-center p-2">Clique para adicionar imagem</span>
            )}
             <input 
                type="file" 
                accept="image/*"
                onChange={handleImageChange} 
                disabled={uploading}
                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
          </div>
          {imageUrl && (
            <button 
              type="button" 
              onClick={(e) => { e.preventDefault(); setImageUrl(''); setImageFile(null); }}
              className="mt-2 text-xs text-red-500 hover:text-red-700 underline w-full text-center"
            >
              Remover imagem
            </button>
          )}
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
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Quantidade de Precificações:</span>
        <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1 border dark:border-gray-600">
          <button 
            type="button" 
            onClick={() => { setVariationMode('4P'); setVariationsData(generateVariations('4P', variationsData)); }}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${variationMode === '4P' ? 'bg-white text-green-700 shadow-sm border border-gray-200 dark:bg-gray-800 dark:text-green-400 dark:border-gray-600' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
          >
            P1
          </button>
          <button 
            type="button" 
            onClick={() => { setVariationMode('5P'); setVariationsData(generateVariations('5P', variationsData)); }}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${variationMode === '5P' ? 'bg-white text-green-700 shadow-sm border border-gray-200 dark:bg-gray-800 dark:text-green-400 dark:border-gray-600' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
          >
            P2
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold dark:text-white">Precificações</div>
        <button type="button" onClick={()=> setVarModalOpen(true)} className="px-3 py-2 border dark:border-gray-600 rounded text-sm dark:text-gray-300 dark:hover:bg-gray-700">Gerenciar precificações</button>
      </div>
      {/* Mobile list */}
      <div className="md:hidden">
        <div className="text-xs text-gray-600 dark:text-gray-400">{variationsData.length} precificações</div>
        <div className="mt-2 border dark:border-gray-600 rounded overflow-hidden">
          {variationsData.map((v, idx) => (
            <div key={idx} className="px-3 py-3 border-b dark:border-gray-700 last:border-0">
              <div className="grid grid-cols-[1fr_auto_auto] items-start gap-3">
                <div>
                  <div className="text-sm font-medium leading-tight truncate dark:text-white" title={v.name}>{v.name || '-'}</div>
                  {idx === 0 && (
                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      <span>Estoque: {v.stock ?? 0}</span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 pt-[1px]">{(reference || '').trim() ? reference : ''}</div>
                <div className="text-right">
                  <div className="text-base font-semibold leading-tight dark:text-white">{((v.promoPrice ?? v.salePrice) ?? 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Custo: {(v.cost ?? 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</div>
                </div>
              </div>
            </div>
          ))}
          {variationsData.length === 0 && (
            <div className="px-3 py-6 text-sm text-gray-500 dark:text-gray-400">Nenhuma variação adicionada ainda.</div>
          )}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <div className="text-xs text-gray-600 dark:text-gray-400">{variationsData.length} precificações</div>
        <div className="mt-2 border dark:border-gray-600 rounded overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div>Nome</div>
            <div className="text-right">Custo</div>
            <div className="text-right">Preço</div>
            <div className="text-right">Estoque Min.</div>
            <div className="text-right">Estoque</div>
          </div>
          {variationsData.map((v, idx) => (
            <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-3 py-2 border-b dark:border-gray-700 last:border-0 text-sm">
              <div className="truncate dark:text-white" title={v.name}>{v.name || '-'}</div>
              <div className="text-right dark:text-gray-300">{(v.cost ?? 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</div>
              <div className="text-right dark:text-gray-300">{(v.salePrice ?? 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</div>
              <div className="text-right dark:text-gray-300">{idx === 0 ? (v.stockMin ?? 0) : ''}</div>
              <div className={`text-right ${(v.stock ?? 0) > 0 ? 'dark:text-gray-300' : 'text-red-600 dark:text-red-400'}`}>{idx === 0 ? (v.stock ?? 0) : ''}</div>
            </div>
          ))}
          {variationsData.length === 0 && (
            <div className="px-3 py-6 text-sm text-gray-500 dark:text-gray-400">Nenhuma variação adicionada ainda.</div>
          )}
        </div>
      </div>

      <div className="font-semibold mb-2 dark:text-white">Dados adicionais</div>
      <textarea value={description} onChange={e=>setDescription(e.target.value)} className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" placeholder="Descrição do produto" rows={3} />
      <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-300">Código</label>
          <input value={reference} onChange={e=>setReference(e.target.value)} className="mt-1 w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
        </div>
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-300">Comissão (%)</label>
          <input type="number" step="0.01" value={commissionPercent} onChange={e=>setCommissionPercent(e.target.value)} className="mt-1 w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
        </div>
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-300">Unidade de venda</label>
          <select value={unit} onChange={e=>setUnit(e.target.value)} className="mt-1 w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white">
            <option>Unidade</option>
            <option>Caixa</option>
            <option>Pacote</option>
            <option>Metro</option>
          </select>
        </div>
        <div className="flex items-end">
          {/* Switch: Permite vender fracionado */}
          <div className="flex items-center gap-2 text-sm dark:text-gray-300">
            <span>Permite vender fracionado</span>
            <button type="button" onClick={()=>setAllowFraction(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${allowFraction ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${allowFraction ? 'translate-x-4' : 'translate-x-1'}`}></span>
            </button>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <label className="text-xs text-gray-600 dark:text-gray-300">Observações internas</label>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} className="mt-1 w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" rows={2} />
      </div>
      <div className="mt-3">
        <div className="font-semibold mb-2 dark:text-white">Dados Fiscais</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-300">Origem da mercadoria</label>
            <select value={origin} onChange={e=>setOrigin(e.target.value)} className="mt-1 w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white">
              <option value="">Selecionar...</option>
              <option value="0">0 - Nacional</option>
              <option value="1">1 - Estrangeira - Importação direta</option>
              <option value="2">2 - Estrangeira - Adquirida no mercado interno</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-300">NCM</label>
            <input value={ncm} onChange={e=>setNcm(e.target.value)} className="mt-1 w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-300">CEST</label>
            <input value={cest} onChange={e=>setCest(e.target.value)} className="mt-1 w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
          </div>
        </div>
      </div>
    </div>
  </>
) : (
  <>
    <div className="font-semibold mb-2 dark:text-white">Estoque</div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="text-xs text-gray-600 dark:text-gray-300">Estoque inicial</label>
        <input type="number" value={stock} onChange={e=>setStock(e.target.value)} className="mt-1 w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
      </div>
      <div>
        <label className="text-xs text-gray-600 dark:text-gray-300">Estoque mínimo (alerta)</label>
        <input type="number" value={stockMin} onChange={e=>setStockMin(e.target.value)} className="mt-1 w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" />
      </div>
    </div>
    <div className="mt-3 flex items-center gap-8 text-sm dark:text-gray-300">
      <div className="flex items-center gap-2">
        <span>Controlar estoque</span>
        <button type="button" onClick={()=>setControlStock(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${controlStock ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${controlStock ? 'translate-x-4' : 'translate-x-1'}`}></span>
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span>Exibir no catálogo</span>
        <button type="button" onClick={()=>setShowInCatalog(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${showInCatalog ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${showInCatalog ? 'translate-x-4' : 'translate-x-1'}`}></span>
        </button>
      </div>
    </div>
  </>
)}
</div>
</div>

<div className="px-6 py-3 border-t dark:border-gray-700 flex items-center justify-between">
  <div className="flex items-center gap-6">
    <label className="flex items-center gap-2 text-sm dark:text-gray-300">
      <span>Cadastro Ativo</span>
      <button type="button" onClick={()=>setActive(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${active ? 'translate-x-4' : 'translate-x-1'}`}></span>
      </button>
    </label>
    
    <label className="flex items-center gap-2 text-sm dark:text-gray-300">
      <span>Destacar Produto</span>
      <button type="button" onClick={()=>setFeatured(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${featured ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${featured ? 'translate-x-4' : 'translate-x-1'}`}></span>
      </button>
    </label>
  </div>
 </div>

<div className="flex items-center justify-end gap-3 pt-2 px-6">
  <button type="button" onClick={close} className="px-3 py-2 border dark:border-gray-600 rounded text-sm dark:text-gray-300 dark:hover:bg-gray-700">Cancelar</button>
  <button disabled={saving} type="submit" className="px-3 py-2 rounded text-sm bg-green-600 text-white disabled:opacity-60">Confirmar</button>
</div>
        </form>
        {varModalOpen && (
            <VariationsModal
              open={varModalOpen}
              commissionPercent={commissionPercent}
              initialItems={variationsData.length ? variationsData : [makeVarFromProduct()]}
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
              onNew={canCreateCategory ? () => setNewCatOpen(true) : null}
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
              onNew={canCreateSupplier ? () => setNewSupOpen(true) : null}
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
