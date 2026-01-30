import { collection, addDoc, query, where, getDocs, serverTimestamp, onSnapshot, orderBy, updateDoc, doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { addStore } from './stores'
import { listStoresByOwner } from './stores'
// import { signInWithEmailAndPassword } from 'firebase/auth'
// import { auth } from '../lib/firebase'

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
  let ref
  if (isMember && ownerId) {
    ref = doc(db, 'users', ownerId, 'members', uid)
  } else {
    ref = doc(db, 'users', uid)
  }
  // Use updateDoc and catch error silently (e.g. if user deleted)
  await updateDoc(ref, { lastSeen: now }).catch(() => {})
}

// Login baseado em dados no Firestore, com autenticação anônima já ativa
export async function login(email, password){
  const owner = await findUserByEmail(email)
  if (owner){
    const ok = String(owner.password || '') === String(password || '')
    if (!ok) throw new Error('Senha incorreta')
    const status = owner.status || (owner.active === false ? 'cancelado' : 'ativo')
    if (status === 'cancelado') throw new Error('Seu acesso foi cancelado. Entre em contato com o suporte.')
    return owner
  }

  // 2) Se não for dono, tenta membro
  const member = await findMemberByEmail(email)
  if (!member) throw new Error('Usuário não encontrado no banco de dados')
  const ok = String(member.password || '') === String(password || '')
  if (!ok) throw new Error('Senha incorreta')

  return {
    id: member.ownerId,
    ownerId: member.ownerId,
    memberId: member.id,
    name: member.name || 'Usuário',
    email: member.email || email,
    role: member.role || 'staff',
    isSeller: !!member.isSeller,
    isTech: !!member.isTech,
    isAdmin: !!member.isAdmin,
    active: member.active !== false,
  }
}

// Semente de dados: cria vários usuários e uma loja para cada novo usuário
export async function seedDemoUsersAndStores(){
  const demos = [
    { email: 'bob@example.com',    password: '123456', name: 'Bob',    storeName: 'Loja do Bob',    role: 'manager' },
  ]

  for (const d of demos){
    let owner = await findUserByEmail(d.email)
    if (!owner){
      const id = await addUser({ email: d.email, password: d.password, name: d.name, role: d.role, active: true })
      owner = { id, email: d.email, name: d.name }
      await addStore({ name: d.storeName, ownerId: id, adminId: id })
    }

    // Adiciona membros (subusuários) sob o dono
    const membersToEnsure = [
      { email: 'atendente1@example.com', name: 'Atendente 1', role: 'staff' },
      { email: 'vendedor1@example.com',  name: 'Vendedor 1',  role: 'manager', isSeller: true },
      { email: 'tecnico1@example.com',   name: 'Técnico 1',   role: 'staff',   isTech: true },
    ]
    for (const m of membersToEnsure){
      // evita duplicar verificando por email
      const existingQ = query(collection(db, 'users', owner.id, 'members'), where('email','==',m.email))
      const existingSnap = await getDocs(existingQ)
      if (existingSnap.empty){
        await addSubUser(owner.id, m)
      }
    }
  }
}

// Garante que cada usuário dono tenha pelo menos duas lojas
export async function ensureSecondStoreForOwners(){
  const snap = await getDocs(usersCol)
  for (const d of snap.docs){
    const u = { id: d.id, ...d.data() }
    if (u.active === false) continue
    try {
      const stores = await listStoresByOwner(u.id)
      if ((stores?.length || 0) < 2){
        const baseName = u.name || 'Usuário'
        const newName = `${baseName} — Loja 2`
        await addStore({ name: newName, ownerId: u.id, adminId: u.id })
      }
    } catch (e) {
      console.warn('Falha ao garantir segunda loja para', u.id, e)
    }
  }
}

// duplicata removida: a função seedDemoUsersAndStores consolidada acima cria o dono Bob e seus membros.
// Funções duplicadas removidas; usamos Firestore para subusuários.
