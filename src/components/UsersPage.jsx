import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0, bottom: 'auto' })
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
    try {
      if (editingUser) {
        await updateSubUser(owner.id, editingUser.id, user)
      } else {
        await addSubUser(owner.id, user)
      }
      setModalOpen(false)
      setEditingUser(null)
    } catch (error) {
      console.error('Erro ao salvar usuário:', error)
      if (error.code === 'permission-denied') {
        alert('Você não tem permissão para realizar esta ação.')
      } else {
        alert('Erro ao salvar usuário.')
      }
    }
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
  const activeUser = useMemo(() => {
    return members.find(u => u.id === menuOpenId)
  }, [members, menuOpenId])

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
      <div className="bg-white rounded-lg shadow">
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
                {(u.isAdmin || (String(u.role||'').toLowerCase()==='admin')) && (
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
                  const rect = e.currentTarget.getBoundingClientRect()
                  const spaceBelow = window.innerHeight - rect.bottom
                  const menuHeight = 110 // Altura estimada do menu
                  
                  let newPos = { right: window.innerWidth - rect.right, top: 0, bottom: 'auto' }
                  
                  // Se não tiver espaço embaixo, abre pra cima
                  if (spaceBelow < menuHeight) {
                    newPos.bottom = window.innerHeight - rect.top
                    newPos.top = 'auto'
                  } else {
                    newPos.top = rect.bottom
                    newPos.bottom = 'auto'
                  }
                  
                  setMenuPos(newPos)
                  setMenuOpenId(menuOpenId === u.id ? null : u.id)
                }}
              >
                ⋯
              </button>
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
      {menuOpenId && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setMenuOpenId(null)} />
          <div 
            className="fixed bg-white rounded shadow-lg border z-[9999] py-1 w-40"
            style={{ 
              top: menuPos.top, 
              right: menuPos.right,
              bottom: menuPos.bottom
            }}
          >
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
              onClick={() => {
                setMenuOpenId(null)
                if (activeUser) startEdit(activeUser)
              }}
            >
              ✏️ Editar
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-red-600 flex items-center gap-2"
              onClick={() => {
                setMenuOpenId(null)
                if (activeUser) {
                  setUserToRemove(activeUser)
                  setConfirmRemoveOpen(true)
                }
              }}
            >
              🗑️ Excluir
            </button>
          </div>
        </>,
        document.body
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