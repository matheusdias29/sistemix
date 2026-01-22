import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where, deleteDoc, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'

const colRef = collection(db, 'products')

export function listenProducts(callback, storeId){
  const q = storeId 
    ? query(colRef, where('storeId','==',storeId))
    : query(colRef, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a,b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
    callback(items)
  }, (err) => {
    console.error('listenProducts error', err)
  })
}

export async function addProduct(product, storeId){
  if (!storeId) throw new Error('storeId é obrigatório ao criar produto')
  const data = {
    // Identificação da loja
    storeId,

    // Básico
    name: product.name ?? 'Novo Produto',
    active: product.active ?? true,

    // Classificação
    categoryId: product.categoryId ?? null,
    supplier: product.supplier ?? '',

    // Preço e estoque
    cost: product.cost ?? 0,
    salePrice: product.salePrice ?? 0,
    promoPrice: product.promoPrice ?? null,
    priceMin: product.priceMin ?? product.promoPrice ?? product.salePrice ?? 0,
    priceMax: product.priceMax ?? product.salePrice ?? 0,
    barcode: product.barcode ?? '',
    reference: product.reference ?? '',
    validityDate: product.validityDate ?? null, // yyyy-mm-dd

    controlStock: product.controlStock ?? true,
    stockInitial: product.stockInitial ?? 0,
    stockMin: product.stockMin ?? 0,
    stock: product.stock ?? product.stockInitial ?? 0,

    showInCatalog: product.showInCatalog ?? false,
    featured: product.featured ?? false,

    // Variações
    variations: product.variations ?? 0, // manter compatível com listagem
    variationsData: product.variationsData ?? [],

    // Dados adicionais
    description: product.description ?? '',
    commissionPercent: product.commissionPercent ?? 0,
    unit: product.unit ?? 'Unidade',
    allowFraction: product.allowFraction ?? false,
    notes: product.notes ?? '',
    mlQuery: product.mlQuery ?? '',

    // Dados fiscais
    origin: product.origin ?? '',
    ncm: product.ncm ?? '',
    cest: product.cest ?? '',

    // Smartphone
    isSmartphone: !!product.isSmartphone,
    phoneBrand: product.phoneBrand ?? '',
    phoneColor: product.phoneColor ?? '',
    imei1: product.imei1 ?? '',
    imei2: product.imei2 ?? '',
    serialNumber: product.serialNumber ?? '',
    condition: product.condition ?? '',
    warrantyMonths: product.warrantyMonths ?? null,

    // Sincronização
    rootId: product.rootId ?? crypto.randomUUID(),

    // Mídia (desabilitado por enquanto)
    imageUrl: product.imageUrl ?? null,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const res = await addDoc(colRef, data)
  return res.id
}

export async function updateProduct(id, partial){
  const ref = doc(db, 'products', id)
  await updateDoc(ref, { ...partial, updatedAt: serverTimestamp() })
}

export async function removeProduct(id){
  const ref = doc(db, 'products', id)
  await deleteDoc(ref)
}

export async function getNextProductReference(storeId) {
  try {
    const q = query(colRef, where('storeId', '==', storeId))
    const snapshot = await getDocs(q)
    
    if (snapshot.empty) return '1'

    let maxRef = 0

    snapshot.docs.forEach(doc => {
      const data = doc.data()
      if (data.reference) {
        const num = parseInt(data.reference, 10)
        if (!isNaN(num) && num > maxRef) {
          maxRef = num
        }
      }
    })

    return (maxRef + 1).toString()
  } catch (error) {
    console.error("Error getting next reference:", error)
    return '1'
  }
}
