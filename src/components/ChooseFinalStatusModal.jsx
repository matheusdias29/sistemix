import React from 'react'

export default function ChooseFinalStatusModal({ open, onClose, onChoose }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg w-96 overflow-hidden shadow-xl animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800 text-center">Finalizar Ordem de Serviço</h2>
        </div>
        <div className="p-6">
          <p className="text-gray-600 text-center mb-6">
            O pagamento foi concluído. Selecione o status final para esta O.S:
          </p>
          
          <div className="space-y-3">
            <button
              onClick={() => onChoose('Os Finalizada e Faturada Cliente Final')}
              className="w-full p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 hover:border-green-300 transition-all group text-left flex items-center"
            >
              <div className="w-10 h-10 rounded-full bg-green-100 group-hover:bg-green-200 flex items-center justify-center text-green-600 mr-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-green-900">Cliente Final</div>
                <div className="text-xs text-green-700">Faturada para consumidor</div>
              </div>
            </button>

            <button
              onClick={() => onChoose('Os Finalizada e Faturada Cliente lojista')}
              className="w-full p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-all group text-left flex items-center"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center text-blue-600 mr-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-blue-900">Cliente Lojista</div>
                <div className="text-xs text-blue-700">Faturada para revendedor/parceiro</div>
              </div>
            </button>
          </div>
        </div>
        <div className="p-4 border-t flex justify-center">
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-sm font-medium"
          >
            Cancelar (Manter atual)
          </button>
        </div>
      </div>
    </div>
  )
}
