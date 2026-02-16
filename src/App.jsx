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
import CatalogPage from './components/CatalogPage'
import CatalogPreviewPage from './components/CatalogPreviewPage'
import PublicCatalogPage from './components/PublicCatalogPage'
import OrderTrackingPage from './components/OrderTrackingPage'
import FiscalNotesPage from './components/FiscalNotesPage'
import TermsPage from './components/TermsPage'
import Calculator from './components/Calculator'
import PaymentMethodsPage from './components/PaymentMethodsPage'
import ChatWidget from './components/ChatWidget'
import { getStoreBySlug, listenStore } from './services/stores'
import StatisticsPage from './components/StatisticsPage'
import CommissionsPage from './components/CommissionsPage'
import { updateUserPresence, listenUser } from './services/users'
import SubscriptionPage from './components/SubscriptionPage'
import { listenSubscription, computeStatusWithInvoices } from './services/subscriptions'
import { listenInvoices } from './services/invoices'

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
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('darkMode') === '1' } catch { return false }
  })
  const [publicMode, setPublicMode] = useState(false)
  const [invoiceReminderOpen, setInvoiceReminderOpen] = useState(false)
  const [subscriptionState, setSubscriptionState] = useState(null)
  const [ownerInvoices, setOwnerInvoices] = useState([])

  // Sync Dark Mode with DOM and LocalStorage
  useEffect(() => {
    const root = document.documentElement
    
    // Persist preference
    if (darkMode) {
      localStorage.setItem('darkMode', '1')
    } else {
      localStorage.setItem('darkMode', '0')
    }

    // Apply visual class ONLY if not in Login or SelectStore pages
    // Login: (!user)
    // SelectStore: (user && !store)
    // PublicMode: (publicMode) - assume we want dark mode if enabled
    // Authenticated: (user && store) - assume we want dark mode if enabled
    
    const shouldApplyDark = darkMode && (!!store || publicMode)

    if (shouldApplyDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [darkMode, store, publicMode])

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

  // Mantém loja atualizada em tempo real
  useEffect(() => {
    if (!store?.id) return
    const unsub = listenStore(store.id, (updated) => {
      setStore(prev => {
        if (JSON.stringify(prev) === JSON.stringify(updated)) return prev
        return updated
      })
    })
    return () => unsub()
  }, [store?.id])

  // Mantém dados do usuário atualizados em tempo real (permissões, etc)
  useEffect(() => {
    if (!user) return
    // Usa listenUser para ouvir mudanças no doc do usuário (dono ou membro)
    const unsub = listenUser(user, (updated) => {
      setUser(prev => {
        // Evita loop se for idêntico
        if (JSON.stringify(prev) === JSON.stringify(updated)) return prev
        return updated
      })
    })
    return () => unsub()
  }, [user?.id, user?.memberId]) // Recria listener apenas se mudar a identidade do usuário

  // Lembrete de fatura próxima ao vencimento (sempre ao entrar no app)
  useEffect(() => {
    const ownerId = user?.memberId ? user?.ownerId : user?.id
    if (!ownerId) return
    const stopSub = listenSubscription(ownerId, (sub) => {
      setSubscriptionState(sub || null)
    })
    const stopInv = listenInvoices(ownerId, (list) => {
      setOwnerInvoices(list || [])
    })
    return () => {
      stopSub && stopSub()
      stopInv && stopInv()
    }
  }, [user?.id, user?.memberId])

  useEffect(() => {
    const status = computeStatusWithInvoices(subscriptionState, ownerInvoices)
    setInvoiceReminderOpen(status === 'em_atraso')
  }, [subscriptionState, ownerInvoices])

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
      const rawPath = typeof window !== 'undefined' ? window.location.pathname : '/'
      
      // Check for OS tracking path
      const trackingMatch = rawPath.match(/^\/comprovantes\/ordem-servico\/(.+)$/)
      if (trackingMatch) {
        setPublicMode(true)
        setStore(null)
        setView('orderTracking')
        setViewParams({ id: trackingMatch[1] })
        return
      }

      // Check for Sale tracking path
      const saleMatch = rawPath.match(/^\/comprovantes\/venda\/(.+)$/)
      if (saleMatch) {
        setPublicMode(true)
        setStore(null)
        setView('saleTracking')
        setViewParams({ id: saleMatch[1] })
        return
      }

      const path = String(rawPath || '/').replace(/^\/+|\/+$/g, '')
      if (path) {
        setPublicMode(true)
        setStore(null)
        setView('publicCatalog')
        getStoreBySlug(path).then(found => {
          if (found) {
            setStore(found)
          }
        }).catch(()=>{})
      }
    } catch {}
  }, [])



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

        // Update presence (debounce 60s)
        const lastPresence = sessionStorage.getItem('lastPresenceUpdate')
        const now = Date.now()
        if (!lastPresence || now - Number(lastPresence) > 60000) {
           sessionStorage.setItem('lastPresenceUpdate', String(now))
           const isMember = !!user.memberId
           const uid = user.memberId || user.id
           updateUserPresence(uid, user.ownerId || user.id, isMember)
        }
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

  // Fluxo público (Catálogo ou Rastreamento de OS)
  if (publicMode) {
    if (view === 'orderTracking') {
      return <OrderTrackingPage orderId={viewParams.id} />
    }
    if (view === 'saleTracking') {
      return <OrderTrackingPage orderId={viewParams.id} isSale={true} />
    }
    return (
      <PublicCatalogPage storeId={store?.id} store={store} />
    )
  }

  // Fluxo original: Login -> Selecionar Loja
  if (!user) {
    return <LoginPage onLoggedIn={setUser} />
  }

  if (!store) {
    return <SelectStorePage user={user} onSelect={(s) => setStore(s)} />
  }

  function onNavigate(next, params){
    setView(next)
    setViewParams(params || {})
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
          user={user}
        />
        {/* Overlay para mobile */}
        {mobileSidebarOpen ? (
          <div
            className="fixed inset-0 bg-black/40 md:hidden"
            aria-hidden="true"
            onClick={() => setMobileSidebarOpen(false)}
          />
        ) : null}

        <div className="flex-1 p-4 md:p-6 w-full max-w-full overflow-x-hidden md:ml-64">
          <Header
            user={headerUser}
            userData={user}
            storeData={store}
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
                user={user}
                onNavigate={onNavigate}
                onOpenSalesDay={(d) => { setSalesDayFilter(d); onNavigate('vendas') }}
              />
            </div>
          ) : view === 'comissoes' ? (
            <div className="mt-4 md:mt-6"><CommissionsPage storeId={store?.id} store={store} onNavigate={onNavigate} /></div>
          ) : view === 'vendas' ? (
            <div className="mt-4 md:mt-6"><SalesPage initialDayFilter={salesDayFilter} storeId={store?.id} store={store} user={user} openNewSaleSignal={openNewSaleSignal} /></div>
          ) : view === 'produtos' ? (
            <div className="mt-4 md:mt-6"><ProductsPage storeId={store?.id} addNewSignal={addNewSignal} user={user} /></div>
          ) : view === 'termos' ? (
            <div className="mt-4 md:mt-6"><TermsPage storeId={store?.id} /></div>
          ) : view === 'catalogo' ? (
            <div className="mt-4 md:mt-6"><CatalogPage storeId={store?.id} store={store} onNavigate={onNavigate} /></div>
          ) : view === 'catalogoPreview' ? (
            <div className="mt-4 md:mt-6"><CatalogPreviewPage storeId={store?.id} store={store} /></div>
          ) : view === 'os' ? (
            <div className="mt-4 md:mt-6"><ServiceOrdersPage storeId={store?.id} store={store} ownerId={user?.id} user={user} addNewSignal={addNewOrderSignal} viewParams={viewParams} setViewParams={setViewParams} /></div>
          ) : view === 'clientes' ? (
            <div className="mt-4 md:mt-6"><ClientsPage storeId={store?.id} addNewSignal={addNewClientSignal} user={user} /></div>
          ) : view === 'notas' ? (
            <div className="mt-4 md:mt-6"><FiscalNotesPage storeId={store?.id} /></div>
          ) : view === 'configuracoes' ? (
            <div className="mt-4 md:mt-6"><SettingsPage user={user} store={store} onNavigate={onNavigate} onLogout={handleLogout} darkMode={darkMode} onToggleDark={()=>setDarkMode(v=>!v)} /></div>
          ) : view === 'assinatura' ? (
            <div className="mt-4 md:mt-6"><SubscriptionPage user={user} onBack={() => onNavigate('configuracoes')} /></div>
          ) : view === 'dadosEmpresa' ? (
            <div className="mt-4 md:mt-6"><CompanyPage storeId={store?.id} onBack={() => onNavigate('configuracoes')} /></div>
          ) : view === 'taxas' ? (
            <div className="mt-4 md:mt-6"><AdditionalFeesPage storeId={store?.id} onBack={() => onNavigate('configuracoes')} /></div>
          ) : view === 'formasPagamento' ? (
            <div className="mt-4 md:mt-6"><PaymentMethodsPage storeId={store?.id} onBack={() => onNavigate('configuracoes')} /></div>
          ) : view === 'usuarios' ? (
            <div className="mt-4 md:mt-6"><UsersPage owner={user} /></div>
          ) : view === 'metas' ? (
            <div className="mt-4 md:mt-6"><GoalsPage storeId={store?.id} owner={user} viewParams={viewParams} /></div>
          ) : view === 'dadosUsuario' ? (
            <div className="mt-4 md:mt-6"><UserDataPage user={user} onBack={() => onNavigate('configuracoes')} /></div>
          ) : view === 'caixa' ? (
            <div className="mt-4 md:mt-6"><POSPage storeId={store?.id} user={user} onView={onNavigate} setViewParams={setViewParams} /></div>
          ) : view === 'cpagar' ? (
            <div className="mt-4 md:mt-6"><AccountsPayablePage storeId={store?.id} user={user} /></div>
          ) : view === 'creceber' ? (
            <div className="mt-4 md:mt-6"><AccountsReceivablePage storeId={store?.id} user={user} /></div>
          ) : view === 'estatisticas' ? (
            <div className="mt-4 md:mt-6"><StatisticsPage storeId={store?.id} user={user} /></div>
          ) : (
            <div className="rounded-lg bg-white p-6 shadow mt-6">
              <p className="text-sm text-gray-600">Página em construção.</p>
            </div>
          )}
        </div>
      </div>
      <Calculator />
      {user && store && <ChatWidget user={user} />}
      {invoiceReminderOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-5 border-b">
              <h3 className="text-lg font-semibold text-gray-800">Fatura próxima do vencimento</h3>
            </div>
            <div className="p-5 text-sm text-gray-700 space-y-2">
              <p>Sua assinatura está próxima do vencimento. Verifique suas opções de pagamento para evitar interrupções.</p>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button
                onClick={() => setInvoiceReminderOpen(false)}
                className="px-4 py-2 rounded border"
              >
                Fechar
              </button>
              <button
                onClick={() => { setInvoiceReminderOpen(false); onNavigate('assinatura') }}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Ver fatura
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
