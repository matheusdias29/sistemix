import React from 'react'
import clsx from 'clsx'
import logoWhite from '../assets/logofundobranco.png'
import { 
  Home, 
  FileText, 
  Users, 
  Package, 
  ShoppingBag, 
  ShoppingCart, 
  Banknote, 
  Receipt, 
  Wrench, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  BarChart2, 
  LifeBuoy, 
  Settings, 
  LogOut 
} from 'lucide-react'


const items = [
  {key:'inicio',label:'Início', icon: <Home size={20} />},
  {key:'termos',label:'Termos', icon: <FileText size={20} />},
  {key:'clientes',label:'Clientes', icon: <Users size={20} />},
  {key:'produtos',label:'Produtos', icon: <Package size={20} />},
  {key:'catalogo',label:'Catálogo', icon: <ShoppingBag size={20} />},
  {key:'vendas',label:'Vendas', icon: <ShoppingCart size={20} />},
  {key:'caixa',label:'Caixa', icon: <Banknote size={20} />},
  {key:'notas',label:'Notas fiscais', icon: <Receipt size={20} />},
  {key:'os',label:'Ordem de Serviço', icon: <Wrench size={20} />},
  {key:'cpagar',label:'Contas a pagar', icon: <ArrowDownCircle size={20} />},
  {key:'creceber',label:'Contas a receber', icon: <ArrowUpCircle size={20} />},
  {key:'estatisticas',label:'Estatísticas', icon: <BarChart2 size={20} />},
]


export default function Sidebar({onNavigate, onOpenNewSale, active, onLogout, mobileOpen=false, onMobileClose, darkMode}){
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
<div className="flex items-center gap-2 mb-1">
  <img 
    src={logoWhite} 
    alt="SisteMix" 
    className="h-8 w-auto object-contain"
  />
  <div className="font-bold text-base whitespace-nowrap text-gray-900 dark:text-white">
        Siste<span className="text-green-600">Mix</span> Comércio
      </div>
    </div>


    <button 
      onClick={onOpenNewSale} 
      className="mt-4 md:mt-6 w-full bg-green-600 text-white py-2 rounded hover:opacity-95"
    >
      Vender
    </button>


    <nav className="mt-6 space-y-1">
{items.map(i=> (
<div 
  key={i.key} 
  onClick={() => { onNavigate(i.key); closeIfMobile() }} 
  className={clsx(
    'p-3 rounded-lg cursor-pointer flex items-center gap-3 transition-all duration-200', 
    active===i.key 
      ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-bold shadow-sm' 
      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white font-medium'
  )}
>
<span className="w-6">{i.icon}</span>
<span className="text-[15px]">{i.label}</span>
</div>
))}
</nav>


<div className="mt-8 border-t pt-4 space-y-1 dark:border-gray-800">
<div 
  className="p-3 cursor-pointer text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white rounded-lg font-medium text-[15px] transition-colors flex items-center gap-3"
>
  <span className="w-6"><LifeBuoy size={20} /></span>
  <span>Suporte</span>
</div>
<div 
  className="p-3 cursor-pointer text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white rounded-lg font-medium text-[15px] transition-colors flex items-center gap-3"
  onClick={() => { onNavigate('configuracoes'); closeIfMobile() }}
>
  <span className="w-6"><Settings size={20} /></span>
  <span>Configurações</span>
</div>
<div 
  className="p-3 cursor-pointer text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300 rounded-lg font-bold text-[15px] transition-colors flex items-center gap-3"
  onClick={() => { onLogout && onLogout(); closeIfMobile() }}
>
  <span className="w-6"><LogOut size={20} /></span>
  <span>Sair</span>
</div>
</div>
</div>
</aside>
  )
}
