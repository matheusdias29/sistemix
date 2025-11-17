import React, { useEffect, useState } from 'react'
import Switch from './Switch'

const defaultPermissions = {
  products: { create: false, edit: false },
  sales: { viewAll: false, finalize: false, refund: false, cancel: false, changePrice: false, sellUnregistered: false },
  serviceOrders: { view: false, create: false, edit: false, changeStatus: false, changeValues: false },
  services: { create: false, edit: false },
  categories: { create: false, edit: false },
  suppliers: { create: false, edit: false, view: false },
  purchases: { create: false, edit: false, view: false },
  clients: { create: false, edit: false },
  receivables: { create: false, edit: false, view: false, cancel: false },
  payables: { create: false, edit: false, view: false },
  cash: { view: false, open: false, close: false, viewReopenPrevious: false },
}

export default function PermissionsModal({ open, onClose, initialPermissions={}, onConfirm }){
  const [perms, setPerms] = useState(defaultPermissions)
  useEffect(() => {
    if(open){
      const merged = JSON.parse(JSON.stringify(defaultPermissions))
      const src = initialPermissions || {}
      for(const key of Object.keys(merged)){
        merged[key] = { ...merged[key], ...(src[key]||{}) }
      }
      setPerms(merged)
    }
  }, [open, initialPermissions])

  if(!open) return null

  const toggle = (group, key) => (value) => {
    setPerms(prev => ({ ...prev, [group]: { ...prev[group], [key]: value } }))
  }

  const Section = ({ title, children }) => (
    <div className="border-b py-3">
      <div className="font-semibold text-sm mb-2">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[70] bg-black/30 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg w-[760px] max-w-[95vw]">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="font-semibold text-lg">Permissões</div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <Section title="Produtos">
            <Switch checked={perms.products.create} onChange={toggle('products','create')} label="Cadastrar produtos" />
            <Switch checked={perms.products.edit} onChange={toggle('products','edit')} label="Editar produtos" />
          </Section>

          <Section title="Vendas">
            <Switch checked={perms.sales.viewAll} onChange={toggle('sales','viewAll')} label="Pode visualizar todas as vendas" />
            <Switch checked={perms.sales.finalize} onChange={toggle('sales','finalize')} label="Pode finalizar venda" />
            <Switch checked={perms.sales.refund} onChange={toggle('sales','refund')} label="Pode realizar devolução" />
            <Switch checked={perms.sales.cancel} onChange={toggle('sales','cancel')} label="Pode cancelar venda" />
            <Switch checked={perms.sales.changePrice} onChange={toggle('sales','changePrice')} label="Pode alterar o valor dos produtos" />
            <Switch checked={perms.sales.sellUnregistered} onChange={toggle('sales','sellUnregistered')} label="Vender produto não cadastrado" />
          </Section>

          <Section title="Ordens de serviço">
            <Switch checked={perms.serviceOrders.view} onChange={toggle('serviceOrders','view')} label="Pode Visualizar ordens de serviço" />
            <Switch checked={perms.serviceOrders.create} onChange={toggle('serviceOrders','create')} label="Pode Cadastrar ordens de serviço" />
            <Switch checked={perms.serviceOrders.edit} onChange={toggle('serviceOrders','edit')} label="Pode Editar ordens de serviço" />
            <Switch checked={perms.serviceOrders.changeStatus} onChange={toggle('serviceOrders','changeStatus')} label="Pode Alterar status da ordem de serviço" />
            <Switch checked={perms.serviceOrders.changeValues} onChange={toggle('serviceOrders','changeValues')} label="Pode Alterar o valor dos produtos/serviços" />
          </Section>

          <Section title="Serviços">
            <Switch checked={perms.services.create} onChange={toggle('services','create')} label="Cadastrar serviços" />
            <Switch checked={perms.services.edit} onChange={toggle('services','edit')} label="Editar serviços" />
          </Section>

          <Section title="Categorias">
            <Switch checked={perms.categories.create} onChange={toggle('categories','create')} label="Cadastrar categorias" />
            <Switch checked={perms.categories.edit} onChange={toggle('categories','edit')} label="Editar categorias" />
          </Section>

          <Section title="Fornecedores">
            <Switch checked={perms.suppliers.create} onChange={toggle('suppliers','create')} label="Cadastrar fornecedores" />
            <Switch checked={perms.suppliers.edit} onChange={toggle('suppliers','edit')} label="Editar fornecedores" />
            <Switch checked={perms.suppliers.view} onChange={toggle('suppliers','view')} label="Visualizar fornecedores" />
          </Section>

          <Section title="Compras">
            <Switch checked={perms.purchases.create} onChange={toggle('purchases','create')} label="Cadastrar compras" />
            <Switch checked={perms.purchases.edit} onChange={toggle('purchases','edit')} label="Editar compras" />
            <Switch checked={perms.purchases.view} onChange={toggle('purchases','view')} label="Visualizar compras" />
          </Section>

          <Section title="Clientes">
            <Switch checked={perms.clients.create} onChange={toggle('clients','create')} label="Cadastrar clientes" />
            <Switch checked={perms.clients.edit} onChange={toggle('clients','edit')} label="Editar clientes" />
          </Section>

          <Section title="Contas a receber">
            <Switch checked={perms.receivables.create} onChange={toggle('receivables','create')} label="Cadastrar contas a receber" />
            <Switch checked={perms.receivables.edit} onChange={toggle('receivables','edit')} label="Editar contas a receber" />
            <Switch checked={perms.receivables.view} onChange={toggle('receivables','view')} label="Visualizar contas a receber" />
            <Switch checked={perms.receivables.cancel} onChange={toggle('receivables','cancel')} label="Pode cancelar contas a receber" />
          </Section>

          <Section title="Contas a pagar">
            <Switch checked={perms.payables.create} onChange={toggle('payables','create')} label="Cadastrar contas a pagar" />
            <Switch checked={perms.payables.edit} onChange={toggle('payables','edit')} label="Editar contas a pagar" />
            <Switch checked={perms.payables.view} onChange={toggle('payables','view')} label="Visualizar contas a pagar" />
          </Section>

          <Section title="Caixa">
            <Switch checked={perms.cash.view} onChange={toggle('cash','view')} label="Visualizar caixa" />
            <Switch checked={perms.cash.open} onChange={toggle('cash','open')} label="Pode abrir o caixa" />
            <Switch checked={perms.cash.close} onChange={toggle('cash','close')} label="Pode fechar o caixa" />
            <Switch checked={perms.cash.viewReopenPrevious} onChange={toggle('cash','viewReopenPrevious')} label="Visualizar/Reabrir caixas anteriores" />
          </Section>
        </div>
        <div className="p-4 flex items-center justify-end gap-2 border-t">
          <button type="button" className="px-3 py-2 rounded border text-sm" onClick={onClose}>Cancelar</button>
          <button type="button" className="px-3 py-2 rounded bg-green-600 text-white text-sm" onClick={() => onConfirm && onConfirm(perms)}>Salvar</button>
        </div>
      </div>
    </div>
  )
}