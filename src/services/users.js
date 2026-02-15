import { collection, addDoc, query, where, getDocs, serverTimestamp, onSnapshot, orderBy, updateDoc, doc, getDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { addStore, deleteStoresByOwner } from './stores'

const usersCol = collection(db, 'users')

export async function findUserByEmail(email){
  const q = query(usersCol, where('email', '==', email))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() }
}

export async function getOwner(ownerId) {
  if (!ownerId) return null
  const ref = doc(db, 'users', ownerId)
  const d = await getDoc(ref)
  if (d.exists()) return { id: d.id, ...d.data() }
  return null
}

// Criação de usuário sem obrigatoriedade de storeId
export async function addUser(user){
  const data = {
    name: user.name ?? 'Usuário',
    email: user.email ?? '',
    password: user.password ?? '', // apenas para demo
    whatsapp: user.whatsapp ?? '',
    isAdmin: user.isAdmin ?? false,
    isSeller: user.isSeller ?? false,
    isTech: user.isTech ?? false,
    allowDiscount: user.allowDiscount ?? false,
    active: user.active ?? true,
    role: user.role ?? '',
    // storeId pode existir nos dados, mas não é obrigatório
    storeId: user.storeId ?? '',
    // Permissões avançadas
    permissions: user.permissions ?? {},
    // Endereço
    cep: user.cep ?? '',
    address: user.address ?? '',
    number: user.number ?? '',
    neighborhood: user.neighborhood ?? '',
    city: user.city ?? '',
    state: user.state ?? '',
    
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const res = await addDoc(usersCol, data)
  return res.id
}

export async function updateUser(id, partial){
  const ref = doc(db, 'users', id)
  await updateDoc(ref, { ...partial, updatedAt: serverTimestamp() })
}

// Escutar todos os usuários (sem filtro de loja)
export function listenUsers(callback){
  const q = query(usersCol, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(items)
  })
}

// SUB-USUÁRIOS sob o documento do dono (subcoleção "members")
export function listenSubUsers(ownerUserId, callback){
  const membersCol = collection(db, 'users', ownerUserId, 'members')
  const q = query(membersCol, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    callback(items)
  })
}

// Escutar um único usuário (dono ou membro) para atualizações em tempo real
export function listenUser(currentUser, callback) {
  if (!currentUser) return () => {}
  
  let ref
  if (currentUser.memberId) {
     // É um membro (subusuário)
     ref = doc(db, 'users', currentUser.ownerId, 'members', currentUser.memberId)
  } else {
     // É um dono (usuário raiz)
     ref = doc(db, 'users', currentUser.id)
  }

  return onSnapshot(ref, (snap) => {
     if (snap.exists()) {
        const data = snap.data()
        // Mescla dados atuais com atualizações do banco
        // Preserva campos de sessão locais se necessário, mas prioriza o banco
        const updated = { ...currentUser, ...data }
        callback(updated)
     }
  })
}

// Busca membro por email em subcoleções users/{ownerId}/members
export async function findMemberByEmail(email){
  const ownersSnap = await getDocs(usersCol)
  for (const d of ownersSnap.docs){
    const ownerId = d.id
    const membersCol = collection(db, 'users', ownerId, 'members')
    const q = query(membersCol, where('email', '==', email))
    const snap = await getDocs(q)
    if (!snap.empty){
      const md = snap.docs[0]
      return { id: md.id, ownerId, ...md.data() }
    }
  }
  return null
}

export async function addSubUser(ownerUserId, user){
  const membersCol = collection(db, 'users', ownerUserId, 'members')
  const role = user.role ?? (user.isAdmin ? 'admin' : (user.isSeller ? 'manager' : 'staff'))
  const data = {
    name: user.name ?? 'Usuário',
    email: user.email ?? '',
    password: user.password ?? '', // apenas para criação
    whatsapp: user.whatsapp ?? '',
    isSeller: !!user.isSeller,
    isTech: !!user.isTech,
    isAdmin: !!user.isAdmin,
    allowDiscount: !!user.allowDiscount,
    discountMaxPercent: user.unlimitedDiscount ? null : (typeof user.discountMaxPercent === 'number' ? user.discountMaxPercent : null),
    unlimitedDiscount: !!user.unlimitedDiscount,
    role,
    active: user.active ?? true,
    // Permissões avançadas
    permissions: user.permissions ?? {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const res = await addDoc(membersCol, data)
  return res.id
}

export async function updateSubUser(ownerUserId, id, partial){
  const { password, ...rest } = partial || {}
  const ref = doc(db, 'users', ownerUserId, 'members', id)
  await updateDoc(ref, { ...rest, updatedAt: serverTimestamp() })
}

export async function removeSubUser(ownerUserId, id){
  const ref = doc(db, 'users', ownerUserId, 'members', id)
  await deleteDoc(ref)
}

export async function deleteUser(id){
  if (!id) throw new Error('Usuário inválido')
  try {
    await deleteStoresByOwner(id)
  } catch (e) {
    // Continua tentando deletar o usuário mesmo se alguma loja falhar, mas loga o erro
    console.error('Erro ao excluir lojas do usuário:', e)
  }
  const ref = doc(db, 'users', id)
  await deleteDoc(ref)
}

// Alteração de senha para usuário dono
export async function changeOwnerPassword(userId, currentPassword, newPassword){
  if (!userId) throw new Error('Usuário inválido')
  const q = query(usersCol, where('__name__','==', userId))
  const snap = await getDocs(q)
  if (snap.empty) throw new Error('Usuário não encontrado')
  const d = snap.docs[0]
  const data = d.data()
  const cur = String(data?.password || '')
  if (cur !== String(currentPassword || '')) throw new Error('Senha atual incorreta')
  const ref = doc(db, 'users', userId)
  await updateDoc(ref, { password: String(newPassword || ''), updatedAt: serverTimestamp() })
}

// Alteração de senha para subusuário (member)
export async function changeMemberPassword(ownerUserId, memberId, currentPassword, newPassword){
  if (!ownerUserId || !memberId) throw new Error('Usuário inválido')
  const membersCol = collection(db, 'users', ownerUserId, 'members')
  const q = query(membersCol, where('__name__','==', memberId))
  const snap = await getDocs(q)
  if (snap.empty) throw new Error('Usuário não encontrado')
  const d = snap.docs[0]
  const data = d.data()
  const cur = String(data?.password || '')
  if (cur !== String(currentPassword || '')) throw new Error('Senha atual incorreta')
  const ref = doc(db, 'users', ownerUserId, 'members', memberId)
  await updateDoc(ref, { password: String(newPassword || ''), updatedAt: serverTimestamp() })
}

export async function updateUserPresence(uid, ownerId, isMember) {
  if (!uid) return
  const now = serverTimestamp()
  try {
    if (isMember && ownerId) {
      const ref = doc(db, 'users', ownerId, 'members', uid)
      await updateDoc(ref, { lastSeen: now })
    } else {
      const ref = doc(db, 'users', uid)
      await updateDoc(ref, { lastSeen: now })
    }
  } catch {}
}

export async function login(email, password){
  const emailTrim = String(email || '').trim()
  const pass = String(password || '')
  const owner = await findUserByEmail(emailTrim)
  if (owner) {
    const status = owner.status || (owner.active === false ? 'cancelado' : 'ativo')
    if (status === 'cancelado') throw new Error('Acesso cancelado')
    const cur = String(owner.password || '')
    if (cur !== pass) throw new Error('Senha incorreta')
    return owner
  }
  const member = await findMemberByEmail(emailTrim)
  if (member) {
    const status = member.status || (member.active === false ? 'cancelado' : 'ativo')
    if (status === 'cancelado') throw new Error('Acesso cancelado')
    const cur = String(member.password || '')
    if (cur !== pass) throw new Error('Senha incorreta')
    return {
      id: member.ownerId,
      ownerId: member.ownerId,
      memberId: member.id,
      name: member.name || 'Usuário',
      email: member.email || emailTrim,
      role: member.role || 'staff',
      isSeller: !!member.isSeller,
      isTech: !!member.isTech,
      isAdmin: !!member.isAdmin,
      active: member.active !== false,
      permissions: member.permissions || {},
    }
  }
  throw new Error('Usuário não encontrado')
}
