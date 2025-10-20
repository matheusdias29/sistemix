import React from 'react'

export default function Header({user, title}){
return (
<header className="flex items-center justify-between">
<div className="flex items-center gap-4">
<h1 className="text-2xl font-bold">{title ?? 'Início'}</h1>
</div>

<div className="flex items-center gap-6">
<div className="text-sm text-green-600 cursor-pointer">Assistente</div>
<div className="text-sm cursor-pointer">Indique E Ganhe</div>
<div className="flex items-center gap-2 border p-2 rounded">
<div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">{user.name[0]}</div>
<div className="text-sm font-medium">{user.name}</div>
</div>
</div>
</header>
)
}