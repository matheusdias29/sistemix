import React from 'react'

export default function Header({user, userData, storeData, title, onUserClick, mobileControls, rightAction}){
  // Fallback for compatibility if userData/storeData are missing
  const displayName = userData?.name || user?.name?.split('—')[0]?.trim() || 'Usuário'
  const storeName = storeData?.name || (user?.name?.includes('—') ? user.name.split('—')[1]?.trim() : '')
  const initials = displayName?.[0]?.toUpperCase() || '?'
  
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
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{title ?? 'Início'}</h1>
      </div>
      <div className="flex items-center gap-3">
        {rightAction ? (
          <div className="flex items-center">{rightAction}</div>
        ) : null}
        <div className="hidden md:flex items-center gap-4">
          <div
            className="group flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full pl-2 pr-6 py-2 cursor-pointer hover:shadow-lg hover:border-green-200 dark:hover:border-green-900 transition-all duration-200"
            onClick={handleClick}
            title="Trocar de loja"
          >
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold shadow-sm text-lg">
              {initials}
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-bold text-gray-800 dark:text-gray-100 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                {displayName}
              </span>
              {storeName && (
                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold tracking-wide uppercase truncate max-w-[180px]">
                  {storeName}
                </span>
              )}
            </div>
            <div className="ml-2 text-gray-400 group-hover:text-green-500 transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                 <path d="m6 9 6 6 6-6"/>
               </svg>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
