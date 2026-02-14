
import React, { useEffect, useState } from 'react'
import Sidebar from '../../components/Sidebar'
import Header from '../../components/Header'
import ClientsPage from '../../components/ClientsPage'
import ProductsPage from '../../components/ProductsPage'
import SalesPage from '../../components/SalesPage'
import HomePage from '../../components/HomePage'
import GoalsPage from '../../components/GoalsPage'
import ServiceOrdersPage from '../../components/ServiceOrdersPage'
import SettingsPage from '../../components/SettingsPage'
import CompanyPage from '../../components/CompanyPage'
import AdditionalFeesPage from '../../components/AdditionalFeesPage'
import UsersPage from '../../components/UsersPage'
import UserDataPage from '../../components/UserDataPage'
import POSPage from '../../components/POSPage'
import AccountsPayablePage from '../../components/AccountsPayablePage'
import AccountsReceivablePage from '../../components/AccountsReceivablePage'
import CatalogPage from '../../components/CatalogPage'
import CatalogPreviewPage from '../../components/CatalogPreviewPage'
import OrderTrackingPage from '../../components/OrderTrackingPage'
import FiscalNotesPage from '../../components/FiscalNotesPage'
import TermsPage from '../../components/TermsPage'
import Calculator from '../../components/Calculator'
import PaymentMethodsPage from '../../components/PaymentMethodsPage'
import StatisticsPage from '../../components/StatisticsPage'
import CommissionsPage from '../../components/CommissionsPage'
import { listenStore } from '../../services/stores'

const labels = {
  inicio: 'Início',
  comissoes: 'Comissões',
  clientes: 'Clientes',
  produtos: 'Produtos',
  catalogo: 'Catálogo',
  catalogoPreview: 'Catálogo',
  vendas: 'Vendas',
  os: 'Ordem de Serviço',
  notas: 'Notas Fiscais',
  cpagar: 'Contas a Pagar',
  creceber: 'Contas a Receber',
  estatisticas: 'Estatísticas',
  configuracoes: 'Configurações',
  usuarios: 'Usuários',
  taxas: 'Taxas adicionais',
  metas: 'Metas',
  dadosUsuario: 'Dados do usuário',
  termos: 'Termos e Condições',
}

// Mock user for admin context - behaves like an owner
const ADMIN_USER = {
  uid: 'admin_superuser',
  id: 'admin_superuser',
  name: 'Administrador (Super)',
  email: 'admin@sistemix.com',
  // No memberId means owner in most checks
  memberId: null,
  ownerId: 'admin_superuser', // Self-owned for consistency
  permissions: {
      // Grant all permissions explicitly just in case
      clients: { create: true, edit: true, delete: true, view: true },
      products: { create: true, edit: true, delete: true, view: true },
      // ... add others if needed, but 'isOwner' logic usually bypasses this
  }
}

export default function AdminStoreView({ storeId, onExit }) {
  const [store, setStore] = useState(null)
  const [view, setView] = useState('inicio')
  const [viewParams, setViewParams] = useState({})
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  
  // Signals for new items (passed to pages)
  const [addNewSignal, setAddNewSignal] = useState(0)
  const [openNewSaleSignal, setOpenNewSaleSignal] = useState(0)
  const [addNewOrderSignal, setAddNewOrderSignal] = useState(0)
  const [addNewClientSignal, setAddNewClientSignal] = useState(0)
  const [salesDayFilter, setSalesDayFilter] = useState(null)
  
  // Dark mode state (local to this view or shared? Let's keep it simple)
  const [darkMode, setDarkMode] = useState(false)

  // Fetch store data
  useEffect(() => {
    if (!storeId) return
    const unsub = listenStore(storeId, setStore)
    return () => unsub()
  }, [storeId])

  // Removido preloader global

  // Sync Dark Mode
  useEffect(() => {
    const root = document.documentElement
    if (darkMode) root.classList.add('dark')
    else root.classList.remove('dark')
  }, [darkMode])

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-300">Carregando loja...</span>
      </div>
    )
  }

  function onNavigate(next, params){
    setView(next)
    setViewParams(params || {})
    setMobileSidebarOpen(false)
  }

  function handleOpenNewSale() {
    setView('vendas')
    setOpenNewSaleSignal(s => s + 1)
    setMobileSidebarOpen(false)
  }

  const user = { ...ADMIN_USER, storeId: store.id }

  return (
    <div className="min-h-screen bg-[#f7faf9] dark:bg-[#0b1320] overflow-x-hidden">
      {/* Top Bar with "Back to Admin" */}
      <div className="bg-blue-900 text-white px-4 py-2 flex justify-between items-center text-sm shadow-md z-50 relative">
        <div className="font-semibold">Modo de Administração: {store.name}</div>
        <button 
            onClick={onExit}
            className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded transition-colors"
        >
            ← Voltar para Painel Admin
        </button>
      </div>

      <div className="md:flex relative">
        {/* Sidebar */}
        <Sidebar
          onNavigate={onNavigate}
          active={view}
          onLogout={onExit} // Logout returns to admin
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
          darkMode={darkMode}
          onOpenNewSale={handleOpenNewSale}
          user={user}
        />

        {/* Overlay for mobile */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 md:hidden z-40"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 p-4 md:p-6 w-full max-w-full overflow-x-hidden md:ml-64">
          <Header
            user={{ name: 'Admin (Super)' }}
            userData={user}
            storeData={store}
            title={labels[view] || 'Início'}
            onUserClick={() => {}} // No user menu in admin mode
            mobileControls={{
              open: () => setMobileSidebarOpen(true),
              close: () => setMobileSidebarOpen(false),
              toggle: () => setMobileSidebarOpen(v => !v),
              isOpen: mobileSidebarOpen,
            }}
            // Reusing right actions from App.jsx
            rightAction={view==='produtos' ? (
              <button
                className="md:hidden h-9 px-3 rounded bg-green-600 text-white text-sm flex items-center gap-2 shadow-sm active:scale-[0.98]"
                onClick={() => setAddNewSignal(s => s + 1)}
              >
                <span>+ Novo</span>
              </button>
            ) : view==='os' ? (
              <button
                className="md:hidden h-9 px-3 rounded bg-green-600 text-white text-sm flex items-center gap-2 shadow-sm active:scale-[0.98]"
                onClick={() => setAddNewOrderSignal(s => s + 1)}
              >
                <span>+ Nova</span>
              </button>
            ) : view==='clientes' ? (
              <button
                className="md:hidden h-9 px-3 rounded bg-green-600 text-white text-sm flex items-center gap-2 shadow-sm active:scale-[0.98]"
                onClick={() => setAddNewClientSignal(s => s + 1)}
              >
                <span>+ Novo</span>
              </button>
            ) : null}
          />

          {/* Page Routing */}
          <div className="mt-4 md:mt-6">
            {view === 'inicio' ? (
                <HomePage
                    storeId={store.id}
                    user={user}
                    onNavigate={onNavigate}
                    onOpenSalesDay={(d) => { setSalesDayFilter(d); onNavigate('vendas') }}
                />
            ) : view === 'comissoes' ? (
                <CommissionsPage storeId={store.id} store={store} onNavigate={onNavigate} />
            ) : view === 'vendas' ? (
                <SalesPage initialDayFilter={salesDayFilter} storeId={store.id} store={store} user={user} openNewSaleSignal={openNewSaleSignal} />
            ) : view === 'produtos' ? (
                <ProductsPage storeId={store.id} addNewSignal={addNewSignal} user={user} />
            ) : view === 'termos' ? (
                <TermsPage storeId={store.id} />
            ) : view === 'catalogo' ? (
                <CatalogPage storeId={store.id} store={store} onNavigate={onNavigate} />
            ) : view === 'catalogoPreview' ? (
                <CatalogPreviewPage storeId={store.id} store={store} />
            ) : view === 'os' ? (
                <ServiceOrdersPage storeId={store.id} store={store} ownerId={user.id} user={user} addNewSignal={addNewOrderSignal} viewParams={viewParams} setViewParams={setViewParams} />
            ) : view === 'clientes' ? (
                <ClientsPage storeId={store.id} addNewSignal={addNewClientSignal} user={user} />
            ) : view === 'notas' ? (
                <FiscalNotesPage storeId={store.id} />
            ) : view === 'configuracoes' ? (
                <SettingsPage user={user} store={store} onNavigate={onNavigate} onLogout={onExit} darkMode={darkMode} onToggleDark={()=>setDarkMode(v=>!v)} />
            ) : view === 'dadosEmpresa' ? (
                <CompanyPage storeId={store.id} onBack={() => onNavigate('configuracoes')} />
            ) : view === 'taxas' ? (
                <AdditionalFeesPage storeId={store.id} onBack={() => onNavigate('configuracoes')} />
            ) : view === 'formasPagamento' ? (
                <PaymentMethodsPage storeId={store.id} onBack={() => onNavigate('configuracoes')} />
            ) : view === 'usuarios' ? (
                <UsersPage owner={user} />
            ) : view === 'metas' ? (
                <GoalsPage storeId={store.id} owner={user} viewParams={viewParams} />
            ) : view === 'dadosUsuario' ? (
                <UserDataPage user={user} onBack={() => onNavigate('configuracoes')} />
            ) : view === 'caixa' ? (
                <POSPage storeId={store.id} user={user} onView={onNavigate} setViewParams={setViewParams} />
            ) : view === 'cpagar' ? (
                <AccountsPayablePage storeId={store.id} user={user} />
            ) : view === 'creceber' ? (
                <AccountsReceivablePage storeId={store.id} user={user} />
            ) : view === 'estatisticas' ? (
                <StatisticsPage storeId={store.id} user={user} />
            ) : (
                <div className="rounded-lg bg-white p-6 shadow mt-6">
                    <p className="text-sm text-gray-600">Página em construção ou não disponível no modo admin.</p>
                </div>
            )}
          </div>
        </div>
      </div>
      <Calculator />
    </div>
  )
}
