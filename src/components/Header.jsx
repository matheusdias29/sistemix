import React from 'react'

export default function Header({user, title, onUserClick}){
  const displayName = (user?.name || 'Usuário').trim()
  const initials = displayName?.[0] || '?'
  const handleClick = typeof onUserClick === 'function' ? onUserClick : () => {}
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">{title ?? 'Início'}</h1>
      </div>

      <div className="flex items-center gap-6">
        <div className="text-sm text-green-600 cursor-pointer">Assistente</div>
        <div className="text-sm cursor-pointer">Indique E Ganhe</div>
        <div
          className="flex items-center gap-2 border p-2 rounded cursor-pointer hover:bg-gray-100"
          onClick={handleClick}
          title="Trocar de loja"
        >
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">{initials}</div>
          <div className="text-sm font-medium">{displayName}</div>
        </div>
      </div>
    </header>
  )
}