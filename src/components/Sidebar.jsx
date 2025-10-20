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


export default function Sidebar({onNavigate, active}){
return (
<aside className="w-64 bg-white min-h-screen border-r">
<div className="p-6">
<div className="flex items-center gap-3">
<div className="rounded-full bg-green-100 p-2 text-green-700">🛍️</div>
<div>
<div className="font-bold text-lg">Siste<span className="text-green-600">Mix</span></div>
</div>
</div>


<button className="mt-6 w-full bg-green-600 text-white py-2 rounded hover:opacity-95">Vender</button>


<nav className="mt-6">
{items.map(i=> (
<div key={i.key} onClick={() => onNavigate(i.key)} className={clsx('mt-2 p-2 rounded cursor-pointer hover:bg-gray-100 flex items-center gap-3', active===i.key && 'bg-gray-100') }>
<span className="w-6">{i.icon}</span>
<span className="text-sm">{i.label}</span>
</div>
))}
</nav>


<div className="mt-8 border-t pt-4 text-sm text-gray-600">
<div className="p-2 cursor-pointer hover:bg-gray-100 rounded">Suporte</div>
<div className="p-2 cursor-pointer hover:bg-gray-100 rounded">Configurações</div>
<div className="p-2 cursor-pointer hover:bg-gray-100 rounded">Sair</div>
</div>
</div>
</aside>
)
}