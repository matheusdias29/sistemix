import React from 'react'
import clsx from 'clsx'


const items = [
{key:'inicio',label:'Início', icon: '🏠'},
{key:'clientes',label:'Clientes', icon: '👥'},
{key:'produtos',label:'Produtos', icon: '📦'},
{key:'vendas',label:'Vendas', icon: '💳'},
{key:'caixa',label:'Caixa', icon: '💰'},
{key:'notas',label:'Notas fiscais', icon: '📄'},
{key:'os',label:'Ordem de Serviço', icon: '🔧'},
{key:'cpagar',label:'Contas a pagar', icon: '📥'},
{key:'creceber',label:'Contas a receber', icon: '📤'},
{key:'estatisticas',label:'Estatísticas', icon: '📊'},
]


export default function Sidebar({onNavigate, active, onLogout, mobileOpen=false, onMobileClose}){
  const closeIfMobile = () => {
    onMobileClose && onMobileClose()
  }
  return (
    <aside
      className={clsx(
        // Desktop
        'bg-white border-r z-40 dark:bg-[#0f1724] dark:border-gray-800',
        'md:static md:w-64 md:min-h-screen md:overflow-y-auto',
        // Mobile drawer
        'fixed inset-y-0 left-0 w-72 md:w-64 md:block h-screen overflow-y-auto',
        'transform transition-transform duration-200 ease-out mobile-sidebar',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}
      aria-hidden={!mobileOpen && typeof window !== 'undefined' && window.innerWidth < 768}
      role="navigation"
    >
<div className="p-4 md:p-6">
<div className="flex items-center gap-3">
<div className="rounded-full bg-green-100 p-2 text-green-700">🛍️</div>
<div>
<div className="font-bold text-lg text-gray-900 dark:text-white">Siste<span className="text-green-600">Mix</span></div>
</div>
</div>


<button className="mt-4 md:mt-6 w-full bg-green-600 text-white py-2 rounded hover:opacity-95">Vender</button>


<nav className="mt-6">
{items.map(i=> (
<div key={i.key} onClick={() => { onNavigate(i.key); closeIfMobile() }} className={clsx('mt-2 p-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-3', active===i.key && 'bg-gray-100 dark:bg-gray-800') }>
<span className="w-6 text-gray-900 dark:text-white">{i.icon}</span>
<span className="text-sm text-gray-900 dark:text-white">{i.label}</span>
</div>
))}
</nav>


<div className="mt-8 border-t pt-4 text-sm text-gray-600 dark:text-gray-300 dark:border-gray-800">
<div className="p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded">Suporte</div>
<div className="p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded" onClick={() => { onNavigate('configuracoes'); closeIfMobile() }}>Configurações</div>
<div className="p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded" onClick={() => { onLogout && onLogout(); closeIfMobile() }}>Sair</div>
</div>
</div>
</aside>
  )
}
