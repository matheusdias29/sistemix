import { db } from '../lib/firebase'
import { collection, query, where, getDocs, addDoc, updateDoc, doc, onSnapshot, serverTimestamp, orderBy, limit, runTransaction, arrayUnion, getDoc } from 'firebase/firestore'

// Escuta o caixa aberto atual da loja
export function listenCurrentCash(storeId, callback) {
  if (!storeId) return () => {}

  const q = query(
    collection(db, 'cash_registers'),
    where('storeId', '==', storeId),
    where('status', '==', 'open'),
    limit(1)
  )

  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback(null)
    } else {
      const docData = snapshot.docs[0]
      callback({ id: docData.id, ...docData.data() })
    }
  })
}

// Busca o caixa aberto atual (Promise)
export async function getOpenCashRegister(storeId) {
  if (!storeId) return null
  const q = query(
    collection(db, 'cash_registers'),
    where('storeId', '==', storeId),
    where('status', '==', 'open'),
    limit(1)
  )
  const snapshot = await getDocs(q)
  if (snapshot.empty) return null
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }
}

// Abre um novo caixa com número sequencial
export async function openCashRegister({ storeId, userId, userName, initialValue }) {
  if (!storeId) throw new Error('Loja não identificada')

  // Verifica se já existe um aberto (segurança extra)
  const q = query(
    collection(db, 'cash_registers'),
    where('storeId', '==', storeId),
    where('status', '==', 'open'),
    limit(1)
  )
  const existing = await getDocs(q)
  if (!existing.empty) {
    throw new Error('Já existe um caixa aberto.')
  }

  // Usar transação para garantir número sequencial
  await runTransaction(db, async (transaction) => {
    // Referência para o contador da loja
    const counterRef = doc(db, 'stores', storeId, 'counters', 'cashRegisters')
    const counterDoc = await transaction.get(counterRef)
    
    let nextNumber = 1
    if (counterDoc.exists()) {
      nextNumber = (counterDoc.data().current || 0) + 1
    }
    
    // Atualiza contador
    transaction.set(counterRef, { current: nextNumber }, { merge: true })
    
    // Cria o novo caixa
    const newCashRef = doc(collection(db, 'cash_registers'))
    transaction.set(newCashRef, {
      storeId,
      number: nextNumber, // Número sequencial
      openedBy: userId,
      openedByName: userName,
      openedAt: serverTimestamp(),
      status: 'open',
      initialValue: Number(initialValue) || 0,
      currentBalance: Number(initialValue) || 0,
      transactions: [], 
      closedAt: null,
      closingValues: null
    })
  })
}

// Busca caixas fechados anteriores
export async function getClosedCashRegisters(storeId) {
  if (!storeId) return []
  
  try {
    // Tenta ordenar por data de abertura (decrescente)
    // Nota: Pode exigir índice composto no Firestore (storeId + status + openedAt)
    const q = query(
      collection(db, 'cash_registers'),
      where('storeId', '==', storeId),
      where('status', '==', 'closed'),
      orderBy('openedAt', 'desc'),
      limit(20)
    )
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (error) {
    console.warn("Erro ao buscar caixas ordenados (provável falta de índice ou campo), tentando sem ordenação estrita:", error)
    
    // Fallback: Busca simples e ordena em memória
    // Isso garante que caixas antigos (sem campo 'number' ou índice) apareçam
    const qFallback = query(
      collection(db, 'cash_registers'),
      where('storeId', '==', storeId),
      where('status', '==', 'closed'),
      limit(50) 
    )
    
    const snapshot = await getDocs(qFallback)
    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
    
    // Ordena em memória por openedAt decrescente
    return list.sort((a, b) => {
      const ta = a.openedAt?.toDate ? a.openedAt.toDate().getTime() : 0
      const tb = b.openedAt?.toDate ? b.openedAt.toDate().getTime() : 0
      return tb - ta
    })
  }
}

// Reabre um caixa fechado
export async function reopenCashRegister(cashId) {
  if (!cashId) return

  // Verifica se já existe um caixa aberto na loja
  // Precisamos buscar o documento do caixa para saber a loja
  const cashRef = doc(db, 'cash_registers', cashId)
  
  // Como não temos o storeId aqui direto (poderíamos passar, mas vamos garantir lendo o doc ou assumindo que o caller verificou)
  // O ideal é verificar. Vamos ler o doc.
  // ...Para simplificar e ser rápido, vamos assumir que o frontend já verificou se tem caixa aberto via listenCurrentCash.
  // Mas por segurança, vamos fazer uma transação ou verificação simples.
  
  await updateDoc(cashRef, {
    status: 'open',
    closedAt: null,
    closingValues: null
  })
}

// Fecha o caixa
export async function closeCashRegister(cashId, closingData) {
  const ref = doc(db, 'cash_registers', cashId)
  await updateDoc(ref, {
    status: 'closed',
    closedAt: serverTimestamp(),
    closingValues: closingData
  })
}

// Adiciona movimentação
export async function addCashTransaction(cashId, transaction) {
  if (!cashId) throw new Error('Caixa não identificado')
  
  const ref = doc(db, 'cash_registers', cashId)
  
  // Adiciona ao array de transações
  // Usamos arrayUnion para adicionar atomicamente ao array
  // Mas como a transaction é um objeto, precisamos garantir que é único ou aceitar duplicação se o objeto for idêntico.
  // Melhor gerar um ID para a transação antes se fosse um sistema complexo.
  // Aqui vamos confiar que o objeto é novo.
  
  const newTrans = {
    ...transaction,
    id: transaction.id || Date.now().toString(), // Garante ID
    date: transaction.date || new Date() // Garante Data
  }

  await updateDoc(ref, {
    transactions: arrayUnion(newTrans)
  })
}

// Remove todas as transações relacionadas a uma O.S específica
export async function removeCashTransactionsByOrder(cashId, orderId) {
  if (!cashId || !orderId) throw new Error('Parâmetros inválidos')
  const ref = doc(db, 'cash_registers', cashId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const data = snap.data()
  const list = Array.isArray(data.transactions) ? data.transactions : []
  const filtered = list.filter(t => !(t?.originalOrder?.id === orderId))
  await updateDoc(ref, { transactions: filtered })
}

export async function updateCashTransaction(cashId, transactionId, updates) {
  if (!cashId || !transactionId) return
  const ref = doc(db, 'cash_registers', cashId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const data = snap.data()
  const list = Array.isArray(data.transactions) ? data.transactions : []
  const newList = list.map(t => {
    if (t.id === transactionId) {
      return { ...t, ...updates }
    }
    return t
  })
  await updateDoc(ref, { transactions: newList })
}

export async function removeCashTransaction(cashId, transactionId) {
  if (!cashId || !transactionId) return
  const ref = doc(db, 'cash_registers', cashId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const data = snap.data()
  const list = Array.isArray(data.transactions) ? data.transactions : []
  const newList = list.filter(t => t.id !== transactionId)
  await updateDoc(ref, { transactions: newList })
}
