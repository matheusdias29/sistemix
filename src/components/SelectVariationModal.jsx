import React, { useState } from 'react'

export default function SelectVariationModal({ open, onClose, product, onChoose, hideFifth = false }){
  const [query, setQuery] = useState('')
  if(!open || !product) return null
  
  const allVariations = product.variationsData || []
  const variations = hideFifth ? allVariations.filter((_, idx) => idx !== 4) : allVariations
  const filtered = variations.filter(v => (v.name||'').toLowerCase().includes(query.trim().toLowerCase()))
  
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[70]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-[600px] max-w-[95vw] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 shrink-0">
          <h3 className="font-semibold text-lg text-gray-800 dark:text-white">Selecionar Precificação</h3>
        </div>
        
        <div className="p-4 flex-1 overflow-hidden flex flex-col">
          <div className="relative shrink-0 mb-4">
             <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
             <input 
               value={query} 
               onChange={e=>setQuery(e.target.value)} 
               placeholder="Pesquise o nome..." 
               className="w-full bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg pl-10 pr-3 py-2 text-sm focus:bg-white dark:focus:bg-gray-600 focus:border-gray-300 dark:focus:border-gray-500 transition-colors outline-none dark:text-white" 
               autoFocus
             />
          </div>
          
          <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1">
            {filtered.map((variation, idx) => {
              const price = variation.promoPrice ?? variation.salePrice ?? 0
              const stock = variation.stock ?? variation.stockInitial ?? 0
              const originalIndex = allVariations.indexOf(variation)
              const showStock = originalIndex === 0
              return (
                <div 
                  key={idx} 
                  className="group flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors border-b last:border-0 border-gray-100 dark:border-gray-700" 
                  onClick={()=>onChoose(variation)}
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-800 dark:text-gray-200 text-sm uppercase">{variation.name}</div>
                    {showStock && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <span className={stock > 0 ? "text-gray-500 dark:text-gray-400" : "text-red-500 dark:text-red-400"}>Estoque: {stock}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-bold text-gray-800 dark:text-white text-sm">
                      {price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                    </div>
                    <div className="text-gray-400 dark:text-gray-500 text-lg">›</div>
                  </div>
                </div>
              )
            })}
            {filtered.length===0 && (<div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">Nenhuma variação encontrada.</div>)}
          </div>
        </div>
        
        <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 shrink-0 flex justify-end">
          <button 
            type="button" 
            onClick={onClose} 
            className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm font-medium px-4 py-2"
          >
            <span>✕</span> Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
