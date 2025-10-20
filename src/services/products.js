import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

const colRef = collection(db, 'products')

export function listenProducts(callback){
  const q = query(colRef, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(items)
  })
}

export async function addProduct(product){
  const data = {
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