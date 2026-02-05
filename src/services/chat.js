import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, doc, setDoc, getDocs, updateDoc, increment } from 'firebase/firestore'
import { db } from '../lib/firebase'

// Helper para ID único do chat entre dois usuários
export function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_')
}

// Enviar mensagem
export async function sendMessage({ ownerId, fromUser, toUser, text }) {
  if (!text || !text.trim()) return

  const chatId = getChatId(fromUser.id, toUser.id)
  const chatRef = doc(db, 'chats', chatId)
  const messagesCol = collection(chatRef, 'messages')

  // Adiciona a mensagem
  await addDoc(messagesCol, {
    text,
    fromId: fromUser.id,
    fromName: fromUser.name || 'Usuário',
    toId: toUser.id,
    createdAt: serverTimestamp(),
    ownerId: ownerId || null
  })

  // Atualiza metadados do chat (última mensagem, participantes, contador de não lidas)
  // Usamos setDoc com merge para garantir que o documento exista
  await setDoc(chatRef, {
    participants: [fromUser.id, toUser.id],
    lastMessage: text,
    lastMessageAt: serverTimestamp(),
    ownerId: ownerId || null,
    participantsData: {
        [fromUser.id]: { name: fromUser.name || 'Usuário' },
        [toUser.id]: { name: toUser.name || 'Usuário' }
    },
    unreadCounts: {
        [toUser.id]: increment(1)
    }
  }, { merge: true })
}

// Ouvir mensagens de um chat específico
export function listenChatMessages(currentUserId, otherUserId, callback) {
  const chatId = getChatId(currentUserId, otherUserId)
  const messagesCol = collection(db, 'chats', chatId, 'messages')
  const q = query(messagesCol, orderBy('createdAt', 'asc'))

  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(msgs)
  })
}

// Marcar chat como lido para um usuário específico
export async function markChatAsRead(currentUserId, otherUserId) {
    const chatId = getChatId(currentUserId, otherUserId)
    const chatRef = doc(db, 'chats', chatId)
    
    await updateDoc(chatRef, {
        [`unreadCounts.${currentUserId}`]: 0
    }).catch(err => {
        // Se o doc não existir, ignorar
        console.log('Erro ao marcar como lido (pode ser chat novo):', err)
    })
}

// Ouvir todos os chats onde o usuário participa (para mostrar bolinha de não lido na lista)
export function listenUserChats(userId, callback) {
    const chatsCol = collection(db, 'chats')
    const q = query(chatsCol, where('participants', 'array-contains', userId))

    return onSnapshot(q, (snap) => {
        const chats = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        callback(chats)
    })
}
