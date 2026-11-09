import { db } from '../lib/firebase'
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, limit } from 'firebase/firestore'

const collectionName = 'stock_movements'

// Ordena movimentações (descendente por data) — usado em memória no cliente
// para evitar a necessidade de índice composto no Firestore.
function sortMovementsDesc(a, b) {
  const getSeconds = (item) => {
    // Prioriza createdAt, fallback para date, fallback para agora (latência local)
    if (item.createdAt?.seconds) return item.createdAt.seconds
    if (item.date?.seconds) return item.date.seconds
    return Date.now() / 1000
  }
  return getSeconds(b) - getSeconds(a)
}

// Adiciona um registro de movimentação
export async function recordStockMovement({
  storeId = null,
  productId,
  productName,
  variationId = null,
  variationName = null,
  type, // 'in' | 'out'
  quantity,
  reason, // 'sale', 'manual_adjust', 'purchase', 'correction', 'service_order', 'cancel'
  referenceId = null, // ID da venda, OS, etc.
  referenceNumber = null, // Número legível da venda, OS, etc.
  description = '',
  userId = null,
  userName = null
}) {
  try {
    const col = collection(db, collectionName)
    await addDoc(col, {
      storeId,
      productId,
      productName,
      variationId,
      variationName,
      type,
      quantity: Number(quantity),
      reason,
      referenceId,
      referenceNumber,
      description,
      userId,
      userName,
      createdAt: serverTimestamp(),
      date: new Date()
    })
  } catch (error) {
    console.error("Erro ao registrar movimentação de estoque:", error)
    // Não vamos lançar erro para não bloquear o fluxo principal se o log falhar
  }
}

// Escuta as movimentações de um produto específico
export function listenStockMovements(productId, callback) {
  const col = collection(db, collectionName)
  // Removido orderBy do Firestore para evitar necessidade de índice composto imediato
  // A ordenação será feita no cliente
  const q = query(
    col,
    where('productId', '==', productId)
  )

  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    // Ordenação no cliente (descendente por data)
    items.sort(sortMovementsDesc)
    callback(items)
  }, (error) => {
    console.error("Erro ao buscar movimentações:", error)
    callback([]) // Retorna array vazio em caso de erro para parar o loading
  })
}

// Escuta TODAS as movimentações de estoque de uma loja
export function listenStockMovementsByStore(storeId, callback, maxItems = 1000) {
  if (!storeId) {
    callback([])
    return () => {}
  }
  const col = collection(db, collectionName)
  // Sem orderBy no Firestore (evita índice composto storeId + createdAt).
  // A ordenação é feita no cliente; o limit evita estouro de cota.
  const q = query(
    col,
    where('storeId', '==', storeId),
    limit(maxItems)
  )

  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    items.sort(sortMovementsDesc)
    callback(items)
  }, (error) => {
    console.error("Erro ao buscar movimentações da loja:", error)
    callback([])
  })
}
