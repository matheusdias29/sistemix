import React from 'react'

export default function NewSaleModal({ open, onClose }){
  if(!open) return null
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[70]">
      <div className="bg-white rounded-lg shadow-lg w-[860px] max-w-[98vw]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Prévia de Nova Venda</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="p-4 text-sm text-gray-600">
          <p>Este é um placeholder para a prévia de Nova Venda. Integre aqui seu fluxo já criado ou peça para conectar serviços e UI completos.</p>
        </div>
        <div className="p-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-3 py-2 border rounded text-sm">Fechar</button>
          <button className="px-3 py-2 bg-green-600 text-white rounded text-sm">Avançar</button>
        </div>
      </div>
    </div>
  )
}