import React from 'react'
import { Construction } from 'lucide-react'

export default function MarketplacePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6">
      <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
        <Construction className="w-8 h-8 text-gray-400" />
      </div>
      <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Página em Construção</h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-xs text-sm">
        Esta funcionalidade do marketplace estará disponível em breve.
      </p>
    </div>
  )
}
