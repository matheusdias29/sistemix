import React, { useEffect, useState } from 'react'
import { listenStore, updateStore } from '../../services/stores'
import Sidebar from '../../components/Sidebar'

const PAGE_OPTIONS = [
  { key: 'inicio', label: 'Início' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'produtos', label: 'Produtos' },
  { key: 'catalogo', label: 'Catálogo' },
  { key: 'vendas', label: 'Vendas' },
  { key: 'notas', label: 'Notas Fiscais' },
  { key: 'os', label: 'Ordem de Serviço' },
  { key: 'cpagar', label: 'Contas a Pagar' },
  { key: 'creceber', label: 'Contas a Receber' },
  { key: 'estatisticas', label: 'Estatísticas' },
  { key: 'areaTecnico', label: 'Área do Técnico' },
  { key: 'marketplace', label: 'Marketplace' },
  { key: 'termos', label: 'Termos' },
]

export default function AdminStoreSettings({ storeId, onExit }) {
  const [store, setStore] = useState(null)
  const [allowed, setAllowed] = useState({})
  const [saving, setSaving] = useState(false)
  const adminUser = { id: 'admin', memberId: null, permissions: {} }

  useEffect(() => {
    if (!storeId) return
    const unsub = listenStore(storeId, (s) => {
      setStore(s)
      const raw = s?.sidebarPages || {}
      const initial = {}
      PAGE_OPTIONS.forEach(opt => {
        initial[opt.key] = raw[opt.key] !== false
      })
      setAllowed(initial)
    })
    return () => unsub()
  }, [storeId])

  const toggle = (key) => {
    setAllowed(prev => {
      const next = { ...prev }
      const current = prev[key] !== false
      next[key] = !current
      return next
    })
  }

  const save = async () => {
    if (!store) return
    try {
      setSaving(true)
      const payload = {}
      PAGE_OPTIONS.forEach(opt => {
        payload[opt.key] = allowed[opt.key] !== false
      })
      await updateStore(store.id, { sidebarPages: payload })
    } finally {
      setSaving(false)
    }
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-300">Carregando loja...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7faf9] dark:bg-[#0b1320] overflow-x-hidden">
      <div className="bg-blue-900 text-white px-3 sm:px-4 py-2.5 sm:py-2 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-sm shadow-md z-50 relative">
        <div className="font-semibold truncate min-w-0">Sidebar: {store.name}</div>
        <button 
          onClick={onExit}
          className="bg-white/10 hover:bg-white/20 px-3 py-1.5 sm:py-1 rounded transition-colors shrink-0 self-start sm:self-auto w-full sm:w-auto text-center"
        >
          ← Voltar
        </button>
      </div>

      <div className="md:flex relative">
        <Sidebar
          onNavigate={()=>{}}
          active={'inicio'}
          onLogout={onExit}
          mobileOpen={false}
          onMobileClose={()=>{}}
          darkMode={false}
          onOpenNewSale={()=>{}}
          user={adminUser}
          allowedPages={allowed}
        />

        <div className="flex-1 p-3 sm:p-4 md:p-6 md:ml-64">
          <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="text-base sm:text-lg font-semibold text-gray-900">Páginas exibidas na sidebar</div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {PAGE_OPTIONS.map(opt => (
                <div key={opt.key} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="text-sm font-medium text-gray-800 truncate pr-3">{opt.label}</div>
                  <button
                    onClick={() => toggle(opt.key)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${(allowed[opt.key] !== false) ? 'bg-green-600' : 'bg-gray-300'}`}
                    aria-pressed={allowed[opt.key] !== false}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${(allowed[opt.key] !== false) ? 'translate-x-5' : 'translate-x-1'}`}
                    />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-4 border-t">
              <button
                className="w-full sm:w-auto px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
                onClick={onExit}
              >
                Voltar
              </button>
              <button
                className={`w-full sm:w-auto px-4 py-2 rounded bg-blue-600 text-white font-medium ${saving ? 'opacity-60' : 'hover:bg-blue-700'}`}
                onClick={save}
                disabled={saving}
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
