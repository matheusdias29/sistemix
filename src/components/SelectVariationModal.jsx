import React, { useState } from 'react'

export default function SelectVariationModal({ open, onClose, product, onChoose }){
  const [query, setQuery] = useState('')
  if(!open || !product) return null
  
  const variations = product.variationsData || []
  const filtered = variations.filter(v => (v.name||'').toLowerCase().includes(query.trim().toLowerCase()))
  
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[70]">
      <div className="bg-white rounded-lg shadow-lg w-[600px] max-w-[95vw] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h3 className="font-semibold text-lg text-gray-800">Selecionar variação</h3>
        </div>
        
        <div className="p-4 flex-1 overflow-hidden flex flex-col">
          <div className="relative shrink-0 mb-4">
             <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
             <input 
               value={query} 
               onChange={e=>setQuery(e.target.value)} 
               placeholder="Pesquise o nome..." 
               className="w-full bg-gray-100 border-transparent rounded-lg pl-10 pr-3 py-2 text-sm focus:bg-white focus:border-gray-300 transition-colors outline-none" 
               autoFocus
             />
          </div>
          
          <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1">
            {filtered.map((variation, idx) => {
              const price = variation.promoPrice ?? variation.salePrice ?? 0
              const stock = variation.stock ?? variation.stockInitial ?? 0
              return (
                <div 
                  key={idx} 
                  className="group flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border-b last:border-0 border-gray-100" 
                  onClick={()=>onChoose(variation)}
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-800 text-sm uppercase">{variation.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {product.reference && <span className="mr-2">ref: {product.reference}</span>}
                      <span className={stock > 0 ? "text-gray-500" : "text-red-500"}>Estoque: {stock}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-bold text-gray-800 text-sm">
                      {price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                    </div>
                    <div className="text-gray-400 text-lg">›</div>
                  </div>
                </div>
              )
            })}
            {filtered.length===0 && (<div className="text-sm text-gray-500 text-center py-8">Nenhuma variação encontrada.</div>)}
          </div>
        </div>
        
        <div className="p-4 border-t bg-gray-50 shrink-0 flex justify-end">
          <button 
            type="button" 
            onClick={onClose} 
            className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm font-medium px-4 py-2"
          >
            <span>✕</span> Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
