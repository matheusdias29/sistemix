import React from 'react'

export default function Header({user, title, onUserClick, mobileControls, rightAction}){
  const displayName = (user?.name || 'Usuário').trim()
  const initials = displayName?.[0] || '?'
  const handleClick = typeof onUserClick === 'function' ? onUserClick : () => {}
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2 md:gap-4">
        {/* Botão único hambúrguer (mobile) */}
        <button
          className="md:hidden h-9 w-9 rounded-full border border-slate-300 flex items-center justify-center bg-white shadow-sm active:scale-[0.98] text-slate-700"
          aria-label={mobileControls?.isOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={mobileControls?.isOpen ? 'true' : 'false'}
          onClick={mobileControls?.toggle}
          title={mobileControls?.isOpen ? 'Fechar menu' : 'Abrir menu'}
        >
          {/* ícone hambúrguer SVG com 3 linhas */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold">{title ?? 'Início'}</h1>
      </div>
      <div className="flex items-center gap-3">
        {rightAction ? (
          <div className="flex items-center">{rightAction}</div>
        ) : null}
        <div className="hidden md:flex items-center gap-4">
          <div
            className="flex items-center gap-2 border p-2 rounded cursor-pointer hover:bg-gray-100"
            onClick={handleClick}
            title="Trocar de loja"
          >
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">{initials}</div>
            <div className="text-sm font-medium">{displayName}</div>
          </div>
        </div>
      </div>
    </header>
  )
}
