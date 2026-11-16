import React, { useEffect, useState } from 'react'
import { listStoresByOwner } from '../services/stores'
import { Check, Store as StoreIcon, Loader2 } from 'lucide-react'

/**
 * Popup de troca rápida de loja.
 * Reutiliza a mesma lógica de permissão por loja do SelectStorePage:
 *  - DONO (sem memberId): vê todas as suas lojas.
 *  - FUNCIONÁRIO (com memberId): só vê lojas liberadas (storesAllAccess === true
 *    ou lojas presentes em storesAccess).
 *
 * Recebe:
 *  - user: objeto do usuário logado (dono ou membro)
 *  - currentStoreId: id da loja ativa no momento (destacada na lista)
 *  - onSelect(store): callback chamado ao escolher uma loja
 *  - onClose: callback para fechar o popup
 */
export default function StoreSwitcher({ user, currentStoreId, onSelect, onClose }) {
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const ownerLookupId = user?.memberId ? (user?.ownerId || user?.id) : user?.id
        const allFromOwner = await listStoresByOwner(ownerLookupId)

        let finalList = allFromOwner || []
        if (user?.memberId) {
          const allAccess = user.storesAllAccess === true
          if (!allAccess) {
            const allowedIds = Array.isArray(user.storesAccess) ? user.storesAccess : []
            finalList = allowedIds.length === 0
              ? []
              : (allFromOwner || []).filter(s => new Set(allowedIds).has(s.id))
          }
        }
        if (mounted) setStores(finalList)
      } catch (e) {
        console.error('[StoreSwitcher] Erro ao carregar lojas:', e)
        if (mounted) setStores([])
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [user?.id, user?.memberId, user?.ownerId, user?.storesAllAccess, JSON.stringify(user?.storesAccess || [])])

  return (
    <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2">
      <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-between">
        <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Trocar de loja</h3>
        {typeof onClose === 'function' && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500 dark:text-gray-400"
            aria-label="Fechar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      <div className="max-h-[320px] overflow-y-auto">
        {loading ? (
          <div className="p-6 flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando lojas...
          </div>
        ) : stores.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Nenhuma loja disponível para sua conta.
          </div>
        ) : (
          <div className="py-1">
            {stores.map(s => {
              const isCurrent = s.id === currentStoreId
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    if (isCurrent) {
                      if (typeof onClose === 'function') onClose()
                      return
                    }
                    if (typeof onSelect === 'function') onSelect(s)
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    isCurrent
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isCurrent
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300'
                  }`}>
                    <StoreIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate uppercase">{s.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {s.category || 'Comércio Varejista'}
                    </div>
                  </div>
                  {isCurrent && (
                    <Check className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
