import React, { useMemo, useState, useEffect } from 'react'
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
  LogOut,
  ChevronDown
} from 'lucide-react'


export default function Sidebar({onNavigate, onOpenNewSale, active, onLogout, mobileOpen=false, onMobileClose, darkMode, user, allowedPages}){
  const isOwner = !user?.memberId
  const perms = user?.permissions || {}
  const [expandedKey, setExpandedKey] = useState(null)

  const items = useMemo(() => {
    const all = [
      {key:'inicio',label:'Início', icon: <Home size={20} />},
      {key:'termos',label:'Termos', icon: <FileText size={20} />},
      {key:'clientes',label:'Clientes', icon: <Users size={20} />},
      {key:'produtos',label:'Produtos', icon: <Package size={20} />},
      {key:'catalogo',label:'Catálogo', icon: <ShoppingBag size={20} />},
      {key:'vendas',label:'Vendas', icon: <ShoppingCart size={20} />},
      {key:'caixa',label:'Caixa', icon: <Banknote size={20} />},
      {key:'notas',label:'Notas fiscais', icon: <Receipt size={20} />},
      {key:'os',label:'Ordem de Serviço', icon: <Wrench size={20} />},
      {key:'areaTecnico',label:'Área do técnico', icon: <Wrench size={20} />},
      {key:'cpagar',label:'Contas a pagar', icon: <ArrowDownCircle size={20} />},
      {key:'creceber',label:'Contas a receber', icon: <ArrowUpCircle size={20} />},
      {key:'estatisticas',label:'Estatísticas', icon: <BarChart2 size={20} />},
      {
        key:'marketplace',
        label:'Marketplace', 
        icon: <ShoppingBag size={20} />,
        subItems: [
          { key: 'marketplace-amazon', label: 'Amazon' },
          { key: 'marketplace-magalu', label: 'Magazine Luiza' },
          { key: 'marketplace-mercadolivre', label: 'Mercado Livre' },
          { key: 'marketplace-shopee', label: 'Shopee' },
        ]
      },
    ]

    let base = all
    
    // Filter by permissions if not owner
    if (!isOwner) {
      base = base.filter(i => {
        if (i.key === 'inicio') return true
        if (i.key === 'termos') return perms.terms?.view || perms.terms?.edit
        if (i.key === 'catalogo') return true
        
        if (i.key === 'clientes') return perms.clients?.view || perms.clients?.create || perms.clients?.edit || perms.clients?.delete
        if (i.key === 'produtos') return perms.products?.view || perms.products?.create || perms.products?.edit || perms.products?.delete || perms.sales?.viewAll || perms.sales?.finalize
        if (i.key === 'vendas') return perms.sales?.viewAll || perms.sales?.finalize || perms.sales?.edit
        if (i.key === 'caixa') return perms.cash?.view || perms.cash?.open || perms.cash?.close
        if (i.key === 'notas') return false
        if (i.key === 'os') return perms.serviceOrders?.view || perms.serviceOrders?.create || perms.serviceOrders?.edit || perms.serviceOrders?.delete || perms.serviceOrders?.changeStatus
        if (i.key === 'areaTecnico') return !!user?.isTech
        if (i.key === 'cpagar') return perms.payables?.view || perms.payables?.create || perms.payables?.edit
        if (i.key === 'creceber') return perms.receivables?.view || perms.receivables?.create || perms.receivables?.edit
        if (i.key === 'estatisticas') return perms.statistics?.view
        if (i.key === 'marketplace') return true // isOwner check handled by allowedPages below
        return false
      })
    }

    // Apply store-level allowed pages filter if provided (CRITICAL: apply to EVERYONE including owner)
    if (allowedPages && typeof allowedPages === 'object' && Object.keys(allowedPages).length > 0) {
      base = base.filter(i => {
        const flag = allowedPages[i.key]
        // If explicitly false, hide. Otherwise show (default true)
        return flag !== false
      })
    }
    return base
  }, [isOwner, perms, allowedPages, user?.isTech])

  // Auto-expand accordion if a sub-item is active
  useEffect(() => {
    const parent = items.find(i => i.subItems && i.subItems.some(si => si.key === active))
    if (parent) setExpandedKey(parent.key)
  }, [active, items])

  const closeIfMobile = () => {
    onMobileClose && onMobileClose()
  }
  return (
    <aside
      className={clsx(
        // Desktop
        'bg-white border-r z-40 dark:bg-[#0f1724] dark:border-gray-800',
        'md:fixed md:top-0 md:left-0 md:h-screen md:w-64 md:overflow-y-auto',
        // Mobile drawer
        'fixed inset-y-0 left-0 w-72 md:w-64 md:block h-screen overflow-y-auto',
        'transform transition-transform duration-200 ease-out mobile-sidebar',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}
      aria-hidden={!mobileOpen && typeof window !== 'undefined' && window.innerWidth < 768}
      role="navigation"
    >
      <style>{`
        aside::-webkit-scrollbar {
          width: 4px;
        }
        aside::-webkit-scrollbar-track {
          background: transparent;
        }
        aside::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.3);
          border-radius: 20px;
        }
        /* Oculta scrollbar visualmente mas mantém funcionalidade se o usuário preferir */
        @media (min-width: 768px) {
          aside::-webkit-scrollbar {
            width: 0px;
            background: transparent;
          }
          aside {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
        }
      `}</style>
      <div className="p-4 md:p-6">
    <div className="flex items-center gap-2 mb-1">
      <img 
        src={logoWhite} 
        alt="SisteMix" 
        className="h-8 w-auto object-contain"
      />
      <div>
        <div className="font-bold text-base whitespace-nowrap text-gray-900 dark:text-white flex items-baseline">
          <span>Siste<span className="text-green-600">Mix</span> Comércio</span>
          <span className="ml-1 text-[12px] text-green-500 relative -top-1">®</span>
        </div>
        <div className="text-[6px] leading-[0.9] uppercase tracking-widest text-gray-1000 dark:text-gray-300 text-center">
          O SEU GESTOR NA PALMA DA SUA MÃO
        </div>
      </div>
    </div>


    <button 
      onClick={onOpenNewSale} 
      className="mt-4 md:mt-6 w-full bg-green-600 text-white py-2 rounded hover:opacity-95"
    >
      Vender
    </button>


    <nav className="mt-6 space-y-1">
      {items.map(i => {
        const hasSubItems = i.subItems && i.subItems.length > 0
        const isExpanded = expandedKey === i.key
        const isActive = active === i.key || (hasSubItems && i.subItems.some(si => si.key === active))

        return (
          <div key={i.key} className="space-y-1">
            <div 
              onClick={() => {
                if (hasSubItems) {
                  setExpandedKey(isExpanded ? null : i.key)
                } else {
                  onNavigate(i.key)
                  closeIfMobile()
                }
              }} 
              className={clsx(
                'p-3 rounded-lg cursor-pointer flex items-center justify-between transition-all duration-200', 
                isActive 
                  ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-bold shadow-sm' 
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white font-medium'
              )}
            >
              <div className="flex items-center gap-3">
                <span className="w-6">{i.icon}</span>
                <span className="text-[15px]">{i.label}</span>
              </div>
              {hasSubItems && (
                <ChevronDown 
                  size={16} 
                  className={clsx('transition-transform duration-200', isExpanded && 'rotate-180')} 
                />
              )}
            </div>

            {hasSubItems && isExpanded && (
              <div className="ml-6 pl-4 border-l dark:border-gray-800 space-y-1 animate-in slide-in-from-top-2 duration-200">
                {i.subItems.map(si => (
                  <div
                    key={si.key}
                    onClick={() => {
                      onNavigate(si.key)
                      closeIfMobile()
                    }}
                    className={clsx(
                       'p-2 rounded-md cursor-pointer flex items-center gap-3 transition-colors text-[13px]',
                       active === si.key
                         ? 'text-green-600 dark:text-green-400 font-bold bg-green-50/50 dark:bg-green-900/10'
                         : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50/50 dark:hover:bg-gray-800/30'
                     )}
                   >
                     <span className="text-[10px] opacity-40">✕</span>
                     <span>{si.label}</span>
                   </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </nav>


<div className="mt-8 border-t pt-4 space-y-1 dark:border-gray-800">
<div 
  className="p-3 cursor-pointer text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white rounded-lg font-medium text-[15px] transition-colors flex items-center gap-3"
  onClick={() => {
    const message = encodeURIComponent('Preciso de suporte para a ferramenta sistemix comércio')
    window.open(`https://wa.me/5518996003093?text=${message}`, '_blank')
    closeIfMobile()
  }}
>
  <span className="w-6"><LifeBuoy size={20} /></span>
  <span>Ajuda</span>
</div>
{isOwner && (
<div 
  className="p-3 cursor-pointer text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white rounded-lg font-medium text-[15px] transition-colors flex items-center gap-3"
  onClick={() => { onNavigate('configuracoes'); closeIfMobile() }}
>
  <span className="w-6"><Settings size={20} /></span>
  <span>Configurações</span>
</div>
)}
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
