import React from 'react'

export default function ChooseFinalStatusModal({ open, onClose, onChoose }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-96 max-w-full overflow-hidden shadow-xl animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b bg-gray-50 dark:bg-gray-700/50 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white text-center">Finalizar Ordem de Serviço</h2>
        </div>
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
            O pagamento foi concluído. Selecione o status final para esta O.S:
          </p>

          <div className="space-y-3">
            <button
              onClick={() => onChoose('Os Faturada Cliente Final')}
              className="w-full py-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 shadow-sm transition-all flex items-center justify-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <div className="text-left">
                <div className="font-semibold">Cliente Final</div>
                <div className="text-xs opacity-90">Faturada para consumidor</div>
              </div>
            </button>

            <button
              onClick={() => onChoose('Os Faturada Cliente lojista')}
              className="w-full py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 shadow-sm transition-all flex items-center justify-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <div className="text-left">
                <div className="font-semibold">Cliente Lojista</div>
                <div className="text-xs opacity-90">Faturada para revendedor/parceiro</div>
              </div>
            </button>
          </div>
        </div>
        <div className="p-4 border-t dark:border-gray-700 flex justify-center">
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm font-medium"
          >
            Cancelar (Manter atual)
          </button>
        </div>
      </div>
    </div>
  )
}
