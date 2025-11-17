import React, { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import ClientsPage from './components/ClientsPage'
import ProductsPage from './components/ProductsPage'
import SalesPage from './components/SalesPage'
import ServiceOrdersPage from './components/ServiceOrdersPage'
import SettingsPage from './components/SettingsPage'
import SelectStorePage from './components/SelectStorePage'
import UsersPage from './components/UsersPage'
import LoginPage from './components/LoginPage'
import { seedDemoUsersAndStores, ensureSecondStoreForOwners } from './services/users'
import { listStoresByOwner } from './services/stores'

const labels = {
  inicio: 'Início',
  clientes: 'Clientes',
  produtos: 'Produtos',
  vendas: 'Vendas',
  os: 'Ordem de Serviço',
  configuracoes: 'Configurações',
  usuarios: 'Usuários',
}

// Persistência de sessão e timeout de inatividade (60 min)
const INACTIVITY_LIMIT_MS = 60 * 60 * 1000

export default function App(){
  const [view, setView] = useState('inicio')
  const [user, setUser] = useState(null)
  const [store, setStore] = useState(null)

  useEffect(() => {
    // Demo seed para usar sem autenticação
    seedDemoUsersAndStores()
    // Garante segunda loja para cada dono (idempotente)
    ensureSecondStoreForOwners()
  }, [])

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
    <div className="min-h-screen bg-[#f7faf9]">
      <div className="flex">
        <Sidebar onNavigate={onNavigate} active={view} onLogout={handleLogout} />
        <div className="flex-1 p-6">
          <Header user={headerUser} title={labels[view] || 'Início'} />

          {view === 'inicio' ? (
            <div className="rounded-lg bg-white p-6 shadow mt-6">
              <h2 className="text-lg font-semibold">Bem-vindo</h2>
              <p className="text-sm text-gray-600 mt-1">Loja selecionada: {store?.name}</p>
              <div className="mt-4 flex gap-3">
                <button className="btn btn-primary" onClick={() => onNavigate('vendas')}>Nova venda</button>
                <button className="btn btn-light" onClick={() => onNavigate('clientes')}>Clientes</button>
                <button className="btn btn-light" onClick={() => onNavigate('produtos')}>Produtos</button>
              </div>
            </div>
          ) : view === 'vendas' ? (
            <div className="mt-6"><SalesPage /></div>
          ) : view === 'produtos' ? (
            <div className="mt-6"><ProductsPage storeId={store?.id} /></div>
          ) : view === 'os' ? (
            <div className="mt-6"><ServiceOrdersPage storeId={store?.id} /></div>
          ) : view === 'clientes' ? (
            <div className="mt-6"><ClientsPage storeId={store?.id} /></div>
          ) : view === 'configuracoes' ? (
            <div className="mt-6"><SettingsPage user={user} store={store} onNavigate={onNavigate} onLogout={handleLogout} /></div>
          ) : view === 'usuarios' ? (
            <div className="mt-6"><UsersPage owner={user} /></div>
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