import React, { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import ClientsPage from './components/ClientsPage'
import ProductsPage from './components/ProductsPage'
import SalesPage from './components/SalesPage'
import HomePage from './components/HomePage'
import GoalsPage from './components/GoalsPage'
import ServiceOrdersPage from './components/ServiceOrdersPage'
import SettingsPage from './components/SettingsPage'
import CompanyPage from './components/CompanyPage'
import AdditionalFeesPage from './components/AdditionalFeesPage'
import SelectStorePage from './components/SelectStorePage'
import UsersPage from './components/UsersPage'
import LoginPage from './components/LoginPage'
import UserDataPage from './components/UserDataPage'
import POSPage from './components/POSPage'
import AccountsPayablePage from './components/AccountsPayablePage'
import AccountsReceivablePage from './components/AccountsReceivablePage'

const labels = {
  inicio: 'Início',
  clientes: 'Clientes',
  produtos: 'Produtos',
  vendas: 'Vendas',
  os: 'Ordem de Serviço',
  cpagar: 'Contas a Pagar',
  creceber: 'Contas a Receber',
  configuracoes: 'Configurações',
  usuarios: 'Usuários',
  taxas: 'Taxas adicionais',
  metas: 'Metas',
  dadosUsuario: 'Dados do usuário',
}

// Persistência de sessão e timeout de inatividade (60 min)
const INACTIVITY_LIMIT_MS = 60 * 60 * 1000

export default function App(){
  const [view, setView] = useState('inicio')
  const [viewParams, setViewParams] = useState({})
  const [user, setUser] = useState(null)
  const [store, setStore] = useState(null)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [addNewSignal, setAddNewSignal] = useState(0)
  const [openNewSaleSignal, setOpenNewSaleSignal] = useState(0)
  const [addNewOrderSignal, setAddNewOrderSignal] = useState(0)
  const [addNewClientSignal, setAddNewClientSignal] = useState(0)
  const [salesDayFilter, setSalesDayFilter] = useState(null)
  const [darkMode, setDarkMode] = useState(false)

  // Restaura sessão se ainda estiver dentro da janela de inatividade
  useEffect(() => {
    try {
      const raw = localStorage.getItem('session')
      if (!raw) return
      const { user: savedUser, store: savedStore, lastActivity } = JSON.parse(raw)
      const now = Date.now()
      if (savedUser && typeof lastActivity === 'number' && (now - lastActivity) < INACTIVITY_LIMIT_MS) {
        setUser(savedUser)
        setStore(savedStore || null)
      } else {
        localStorage.removeItem('session')
      }
    } catch {}
  }, [])

  // Sincroniza no localStorage sempre que usuário/loja mudarem
  useEffect(() => {
    if (user) {
      const raw = localStorage.getItem('session')
      let sess = {}
      try { sess = raw ? JSON.parse(raw) : {} } catch {}
      localStorage.setItem('session', JSON.stringify({ ...sess, user, store, lastActivity: Date.now() }))
    } else {
      localStorage.removeItem('session')
    }
  }, [user, store])

  // Tema escuro: restaura preferência e aplica classe global
  useEffect(() => {
    try {
      const saved = localStorage.getItem('darkMode')
      const enabled = saved === '1'
      setDarkMode(enabled)
      const root = document.documentElement
      if (enabled) root.classList.add('dark')
      else root.classList.remove('dark')
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('darkMode', darkMode ? '1' : '0')
      const root = document.documentElement
      if (darkMode) root.classList.add('dark')
      else root.classList.remove('dark')
    } catch {}
  }, [darkMode])

  // Monitora atividade do usuário e aplica logout após 60 min sem interação
  useEffect(() => {
    if (!user) return

    const markActivity = () => {
      try {
        const raw = localStorage.getItem('session')
        const sess = raw ? JSON.parse(raw) : {}
        sess.lastActivity = Date.now()
        sess.user = user
        sess.store = store
        localStorage.setItem('session', JSON.stringify(sess))
      } catch {}
    }

    const events = ['mousemove','mousedown','keydown','touchstart','scroll']
    events.forEach(ev => document.addEventListener(ev, markActivity, { passive: true }))

    const interval = setInterval(() => {
      const raw = localStorage.getItem('session')
      let last = 0
      try {
        const sess = raw ? JSON.parse(raw) : {}
        last = sess.lastActivity || 0
      } catch {}
      if (Date.now() - last >= INACTIVITY_LIMIT_MS) {
        handleLogout()
      }
    }, 60 * 1000)

    return () => {
      events.forEach(ev => document.removeEventListener(ev, markActivity))
      clearInterval(interval)
    }
  }, [user, store])

  // Fluxo original: Login -> Selecionar Loja
  if (!user) {
    return <LoginPage onLoggedIn={setUser} />
  }

  if (!store) {
    return <SelectStorePage user={user} onSelect={(s) => setStore(s)} />
  }

  function onNavigate(next){
    setView(next)
    setMobileSidebarOpen(false) // fecha sidebar no mobile ao navegar
  }

  function handleOpenNewSale() {
    setView('vendas')
    setOpenNewSaleSignal(s => s + 1)
    setMobileSidebarOpen(false)
  }

  function handleLogout(){
    // Limpa estado de autenticação e volta ao login
    localStorage.removeItem('session')
    setStore(null)
    setUser(null)
    setView('inicio')
  }

  const headerUser = { name: `${user.name} — ${store?.name || ''}`.trim() }

  return (
    <div className="min-h-screen bg-[#f7faf9] dark:bg-[#0b1320] overflow-x-hidden">
      <div className="md:flex">
        {/* Sidebar desktop + drawer mobile */}
        <Sidebar
          onNavigate={onNavigate}
          active={view}
          onLogout={handleLogout}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
          darkMode={darkMode}
          onOpenNewSale={handleOpenNewSale}
        />
        {/* Overlay para mobile */}
        {mobileSidebarOpen ? (
          <div
            className="fixed inset-0 bg-black/40 md:hidden"
            aria-hidden="true"
            onClick={() => setMobileSidebarOpen(false)}
          />
        ) : null}

        <div className="flex-1 p-4 md:p-6 w-full max-w-full overflow-x-hidden">
          <Header
            user={headerUser}
            title={labels[view] || 'Início'}
            onUserClick={() => setStore(null)}
            mobileControls={{
              open: () => setMobileSidebarOpen(true),
              close: () => setMobileSidebarOpen(false),
              toggle: () => setMobileSidebarOpen(v => !v),
              isOpen: mobileSidebarOpen,
            }}
            rightAction={view==='produtos' ? (
              <button
                className="md:hidden h-9 px-3 rounded bg-green-600 text-white text-sm flex items-center gap-2 shadow-sm active:scale-[0.98]"
                onClick={() => setAddNewSignal(s => s + 1)}
                aria-label="Adicionar novo"
                title="Adicionar novo"
              >
                <span>+ Novo</span>
              </button>
            ) : view==='os' ? (
              <button
                className="md:hidden h-9 px-3 rounded bg-green-600 text-white text-sm flex items-center gap-2 shadow-sm active:scale-[0.98]"
                onClick={() => setAddNewOrderSignal(s => s + 1)}
                aria-label="Nova OS"
                title="Nova OS"
              >
                <span>+ Nova</span>
              </button>
            ) : view==='clientes' ? (
              <button
                className="md:hidden h-9 px-3 rounded bg-green-600 text-white text-sm flex items-center gap-2 shadow-sm active:scale-[0.98]"
                onClick={() => setAddNewClientSignal(s => s + 1)}
                aria-label="Novo cliente"
                title="Novo cliente"
              >
                <span>+ Novo</span>
              </button>
            ) : null}
          />

          {view === 'inicio' ? (
            <div className="mt-4 md:mt-6">
              <HomePage
                storeId={store?.id}
                onNavigate={onNavigate}
                onOpenSalesDay={(d) => { setSalesDayFilter(d); onNavigate('vendas') }}
              />
            </div>
          ) : view === 'vendas' ? (
            <div className="mt-4 md:mt-6"><SalesPage initialDayFilter={salesDayFilter} storeId={store?.id} user={user} openNewSaleSignal={openNewSaleSignal} /></div>
          ) : view === 'produtos' ? (
            <div className="mt-4 md:mt-6"><ProductsPage storeId={store?.id} addNewSignal={addNewSignal} user={user} /></div>
          ) : view === 'os' ? (
            <div className="mt-4 md:mt-6"><ServiceOrdersPage storeId={store?.id} ownerId={user?.id} addNewSignal={addNewOrderSignal} viewParams={viewParams} setViewParams={setViewParams} /></div>
          ) : view === 'clientes' ? (
            <div className="mt-4 md:mt-6"><ClientsPage storeId={store?.id} addNewSignal={addNewClientSignal} /></div>
          ) : view === 'configuracoes' ? (
            <div className="mt-4 md:mt-6"><SettingsPage user={user} store={store} onNavigate={onNavigate} onLogout={handleLogout} darkMode={darkMode} onToggleDark={()=>setDarkMode(v=>!v)} /></div>
          ) : view === 'dadosEmpresa' ? (
            <div className="mt-4 md:mt-6"><CompanyPage storeId={store?.id} onBack={() => onNavigate('configuracoes')} /></div>
          ) : view === 'taxas' ? (
            <div className="mt-4 md:mt-6"><AdditionalFeesPage storeId={store?.id} onBack={() => onNavigate('configuracoes')} /></div>
          ) : view === 'usuarios' ? (
            <div className="mt-4 md:mt-6"><UsersPage owner={user} /></div>
          ) : view === 'metas' ? (
            <div className="mt-4 md:mt-6"><GoalsPage storeId={store?.id} owner={user} /></div>
          ) : view === 'dadosUsuario' ? (
            <div className="mt-4 md:mt-6"><UserDataPage user={user} onBack={() => onNavigate('configuracoes')} /></div>
          ) : view === 'caixa' ? (
            <div className="mt-4 md:mt-6"><POSPage storeId={store?.id} user={user} onView={onNavigate} setViewParams={setViewParams} /></div>
          ) : view === 'cpagar' ? (
            <div className="mt-4 md:mt-6"><AccountsPayablePage storeId={store?.id} /></div>
          ) : view === 'creceber' ? (
            <div className="mt-4 md:mt-6"><AccountsReceivablePage storeId={store?.id} /></div>
          ) : (
            <div className="rounded-lg bg-white p-6 shadow mt-6">
              <p className="text-sm text-gray-600">Página em construção.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
