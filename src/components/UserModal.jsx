import React, { useEffect, useState } from 'react'
import Switch from './Switch'
import PermissionsModal from './PermissionsModal'

export default function UserModal({ user, onClose, onSave }){
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp || '')

  const [isSeller, setIsSeller] = useState(!!user?.isSeller)
  const [isTech, setIsTech] = useState(!!user?.isTech)
  const [isAdmin, setIsAdmin] = useState(!!user?.isAdmin)

  const [allowDiscount, setAllowDiscount] = useState(!!user?.allowDiscount)
  const [discountMaxPercent, setDiscountMaxPercent] = useState(
    user?.discountMaxPercent != null ? String(user.discountMaxPercent) : ''
  )
  const [unlimitedDiscount, setUnlimitedDiscount] = useState(!!user?.unlimitedDiscount)

  const [active, setActive] = useState(user?.active !== false)

  // Permissões avançadas
  const [permissions, setPermissions] = useState(user?.permissions || {})
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false)

  useEffect(() => {
    setName(user?.name || '')
    setEmail(user?.email || '')
    setWhatsapp(user?.whatsapp || '')
    setIsSeller(!!user?.isSeller)
    setIsTech(!!user?.isTech)
    setIsAdmin(!!user?.isAdmin)
    setAllowDiscount(!!user?.allowDiscount)
    setDiscountMaxPercent(user?.discountMaxPercent != null ? String(user.discountMaxPercent) : '')
    setUnlimitedDiscount(!!user?.unlimitedDiscount)
    setActive(user?.active !== false)
    setPermissions(user?.permissions || {})
  }, [user])

  const deriveRole = () => {
    if (isAdmin) return 'admin'
    if (isSeller) return 'manager'
    return 'staff'
  }

  function handleSubmit(e) {
    e?.preventDefault?.()
    const payload = {
      name: name.trim(),
      email: email.trim(),
      whatsapp: whatsapp.trim(),
      isSeller,
      isTech,
      isAdmin,
      allowDiscount,
      discountMaxPercent:
        allowDiscount && !unlimitedDiscount
          ? Number(discountMaxPercent || 0)
          : null,
      unlimitedDiscount,
      active,
      role: deriveRole(),
      permissions,
    }
    onSave(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow">
        <div className="border-b p-4">
          <h3 className="text-lg font-semibold">{user ? 'Editar Usuário' : 'Novo Usuário'}</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Dados do usuário */}
          <div>
            <div className="font-semibold text-sm mb-2">Dados do usuário</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700">Nome</label>
                <input
                  className="input w-full"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do usuário"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700">Whatsapp</label>
                <input
                  className="input w-full"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-700">E-mail</label>
                <input
                  className="input w-full"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  type="email"
                />
              </div>
            </div>
          </div>

          {/* Funções e permissões */}
          <div>
            <div className="font-semibold text-sm mb-2">Funções e permissões</div>
            <div className="space-y-3">
              <Switch checked={isSeller} onChange={setIsSeller} label="É vendedor" />
              <Switch checked={isTech} onChange={setIsTech} label="É técnico (Ordem de serviço)" />
              <Switch checked={isAdmin} onChange={setIsAdmin} label="É administrador" />
              <div className="text-xs text-gray-500">Administradores pode acessar e ver todas as informações.</div>
              <button type="button" className="px-3 py-2 rounded text-sm bg-gray-100 hover:bg-gray-200" onClick={() => setPermissionsModalOpen(true)}>Adicionar Permissões</button>
            </div>
          </div>

          {/* Configurações de desconto para vendedor */}
          <div>
            <div className="font-semibold text-sm mb-2">Configurações de desconto para vendedor</div>
            <div className="space-y-3">
              <Switch checked={allowDiscount} onChange={setAllowDiscount} label="Permitir desconto" />
              <div className="text-xs text-gray-600 bg-gray-100 rounded p-3">
                Informe o "Valor máximo de desconto (%)" que o vendedor poderá aplicar. Se preferir liberar sem restrições, marque "Desconto ilimitado".
              </div>
              <div className="grid grid-cols-[1fr_auto] items-center gap-4">
                <div>
                  <label className="block text-xs text-gray-700">Valor máximo de desconto (%)</label>
                  <input
                    className="input w-full"
                    type="number"
                    step="0.01"
                    min="0"
                    value={discountMaxPercent}
                    disabled={!allowDiscount || unlimitedDiscount}
                    onChange={(e) => setDiscountMaxPercent(e.target.value)}
                  />
                </div>
                <div className="mt-6">
                  <Switch checked={unlimitedDiscount} onChange={setUnlimitedDiscount} label="Desconto ilimitado" disabled={!allowDiscount} />
                </div>
              </div>
            </div>
          </div>

          {/* Cadastro ativo */}
          <div>
            <Switch checked={active} onChange={setActive} label="Cadastro ativo" />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" className="btn btn-light" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Salvar</button>
          </div>
        </form>
      </div>

      <PermissionsModal
        open={permissionsModalOpen}
        initialPermissions={permissions}
        onClose={() => setPermissionsModalOpen(false)}
        onConfirm={(p) => { setPermissions(p); setPermissionsModalOpen(false) }}
      />
    </div>
  )
}