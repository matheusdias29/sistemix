import React, { useEffect, useMemo, useState } from 'react'
import { listenSubUsers, addSubUser, updateSubUser, removeSubUser } from '../services/users'
import UserModal from './UserModal'

export default function UsersPage({ owner }){
  const [members, setMembers] = useState([])
  const [showActive, setShowActive] = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  
  // Menu e ações
  const [menuOpenId, setMenuOpenId] = useState(null)
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)
  const [userToRemove, setUserToRemove] = useState(null)

  useEffect(() => {
    if (!owner?.id) return
    const unsub = listenSubUsers(owner.id, (list) => setMembers(list))
    return () => unsub && unsub()
  }, [owner?.id])

  const filtered = useMemo(() => {
    return members.filter(u => (u.active ?? true) ? showActive : showInactive)
  }, [members, showActive, showInactive])

  const startEdit = (u) => { setEditingUser(u); setModalOpen(true) }

  async function handleSave(user){
    if (!owner?.id) return
    if (editingUser) {
      await updateSubUser(owner.id, editingUser.id, user)
    } else {
      await addSubUser(owner.id, user)
    }
    setModalOpen(false)
    setEditingUser(null)
  }

  async function handleRemove() {
    if (!owner?.id || !userToRemove) return
    try {
      await removeSubUser(owner.id, userToRemove.id)
      setConfirmRemoveOpen(false)
      setUserToRemove(null)
    } catch (error) {
      console.error('Erro ao excluir usuário:', error)
      alert('Erro ao excluir usuário')
    }
  }

  const activeCount = members.filter(u => (u.active ?? true)).length

  // Helpers para detecção de badges quando não há flags setadas
  const isSeller = (u) => (u.isSeller ?? false) || (String(u.role || '').toLowerCase() === 'manager') || /vendedor/i.test(String(u.name||''))
  const isTech = (u) => (u.isTech ?? false) || /t[eé]cnico/i.test(String(u.name||''))
  const isAdmin = (u) => (u.isAdmin ?? false) || (String(u.role || '').toLowerCase() === 'admin')

  return (
    <div>
      {/* Toolbar superior com filtros e botão Novo */}
      <div className="grid grid-cols-[1fr_auto] items-center mb-3">
        <div className="flex items-center gap-2">
          <button
            className={`px-2 py-1 rounded text-xs border ${showActive ? 'bg-green-100 text-green-700 border-green-300' : 'text-gray-700 border-gray-300'}`}
            onClick={() => setShowActive(v => !v)}
          >Ativo</button>
          <button
            className={`px-2 py-1 rounded text-xs border ${showInactive ? 'bg-gray-200 text-gray-700 border-gray-300' : 'text-gray-700 border-gray-300'}`}
            onClick={() => setShowInactive(v => !v)}
          >Inativo</button>
        </div>
        <button className="px-3 py-2 rounded bg-green-600 text-white text-sm" onClick={() => setModalOpen(true)}>+ Novo</button>
      </div>

      {/* Lista estilo do print */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="grid grid-cols-[1.5rem_1fr_10rem_8rem_2rem] items-center px-4 py-3 text-xs text-gray-500 border-b">
          <div></div>
          <div>Usuários ({filtered.length})</div>
          <div className="text-right">Whatsapp</div>
          <div className="text-right">Status</div>
          <div></div>
        </div>
        {filtered.map((u, i) => (
          <div key={u.id} className="grid grid-cols-[1.5rem_1fr_10rem_8rem_2rem] items-center px-4 py-3 border-b last:border-0 relative">
            <div className="text-gray-400">👤</div>
            <div className="text-sm">
              <div className="font-medium">{u.name || '-'}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {isAdmin(u) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700 border border-green-200">Administrador</span>
                )}
                {isSeller(u) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-300">Vendedor{typeof i==='number' ? ` #${i+1}` : ''}</span>
                )}
                {isTech(u) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-300">Técnico</span>
                )}
              </div>
            </div>
            <div className="text-sm text-right">{u.whatsapp || '-'}</div>
            <div className="text-sm text-right">
              <div className={`px-2 py-1 rounded text-xs ${(u.active ?? true) ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>{(u.active ?? true) ? 'Ativo' : 'Inativo'}</div>
            </div>
            <div className="text-right text-sm relative">
              <button 
                className="p-1 rounded hover:bg-gray-100"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpenId(menuOpenId === u.id ? null : u.id)
                }}
              >
                ⋯
              </button>
              {menuOpenId === u.id && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded shadow-lg border z-10 py-1">
                  <button
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                    onClick={() => {
                      setMenuOpenId(null)
                      startEdit(u)
                    }}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-red-600 flex items-center gap-2"
                    onClick={() => {
                      setMenuOpenId(null)
                      setUserToRemove(u)
                      setConfirmRemoveOpen(true)
                    }}
                  >
                    🗑️ Excluir
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Aviso de limite de usuários ativos */}
      <div className="mt-3 text-xs text-gray-600">
        {activeCount >= 10 && (
          <div>
            Você atingiu o limite de usuários ativos permitidos pelo seu plano (10 usuários), para adicionar mais usuários, entre em contato o suporte.
          </div>
        )}
      </div>

      {modalOpen && (
        <UserModal
          user={editingUser}
          onClose={() => { setModalOpen(false); setEditingUser(null); }}
          onSave={handleSave}
        />
      )}
      
      {/* Backdrop para fechar menu */}
      {menuOpenId && (
        <div className="fixed inset-0 z-0" onClick={() => setMenuOpenId(null)} />
      )}

      {/* Modal de confirmação de exclusão */}
      {confirmRemoveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-2">Excluir usuário?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Tem certeza que deseja excluir o usuário <strong>{userToRemove?.name}</strong>?
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <button 
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                onClick={() => setConfirmRemoveOpen(false)}
              >
                Cancelar
              </button>
              <button 
                className="px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded"
                onClick={handleRemove}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}