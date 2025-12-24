import React, { useEffect, useState } from 'react'

export default function VariationsModal({ open, onClose, onConfirm, commissionPercent = 0, initialItems = [], defaultReference = '' }){
  const toEditable = (it = {}) => ({
    name: it.name ?? '',
    cost: String(it.cost ?? '0'),
    salePrice: String(it.salePrice ?? '0'),
    promoPrice: it.promoPrice != null ? String(it.promoPrice) : '',
    barcode: it.barcode ?? '',
    reference: it.reference ?? '',
    validityDate: it.validityDate ?? '',
    stockInitial: String(it.stockInitial ?? it.stock ?? '0'),
    stockMin: String(it.stockMin ?? '0'),
    active: it.active ?? true,
  })
  const [items, setItems] = useState([toEditable()])
  const [expandedIdx, setExpandedIdx] = useState(null)
  const fmtBRL = (v) => {
    const n = parseFloat(v)
    return (isNaN(n) ? 0 : n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  useEffect(() => {
    if(open){
      const base = Array.isArray(initialItems) && initialItems.length > 0 ? initialItems : [toEditable()]
      setItems(base.map(toEditable))
    }
  }, [open, initialItems])

  if(!open) return null

  const addItem = () => {
    setItems(prev => ([...prev, { name:'', cost:'0', salePrice:'0', promoPrice:'', barcode:'', reference: defaultReference, validityDate:'', stockInitial:'0', stockMin:'0', active:true }]))
  }
  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((it, i) => i===idx ? { ...it, [field]: value } : it))
  }
  const calcSale = (idx) => {
    const c = parseFloat(items[idx].cost) || 0
    const com = parseFloat(commissionPercent) || 0
    const r = c * (1 + (com/100))
    updateItem(idx, 'salePrice', String(r.toFixed(2)))
  }
  const confirm = () => {
    const normalized = items.map(it => ({
      name: (it.name || '').trim(),
      cost: parseFloat(it.cost) || 0,
      salePrice: parseFloat(it.salePrice) || 0,
      promoPrice: it.promoPrice ? (parseFloat(it.promoPrice) || 0) : null,
      priceMin: it.promoPrice ? (parseFloat(it.promoPrice) || 0) : (parseFloat(it.salePrice) || 0),
      priceMax: parseFloat(it.salePrice) || 0,
      barcode: (it.barcode || '').trim(),
      reference: (it.reference || '').trim(),
      validityDate: it.validityDate || null,
      stockInitial: parseInt(it.stockInitial, 10) || 0,
      stockMin: parseInt(it.stockMin, 10) || 0,
      stock: parseInt(it.stockInitial, 10) || 0,
      active: it.active !== false,
    }))
    onConfirm && onConfirm(normalized)
    onClose && onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-lg w-[900px] max-w-[98vw]">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-semibold">Gerenciar variações</span>
            <div className="flex items-center gap-2">
              <button type="button" className="px-2 py-1 border rounded-full text-xs bg-green-50 border-green-200 text-green-700">Ativos</button>
              <button type="button" className="px-2 py-1 border rounded-full text-xs">Inativos</button>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <form onSubmit={e=>{e.preventDefault(); confirm();}}>
          <div className="p-4">
            <div className="max-h-[70vh] overflow-y-auto pr-1">
              {/* Mobile list */}
              <div className="md:hidden">
                <div>
                  <div className="font-semibold mb-1">Variações</div>
                  <div className="text-xs text-gray-600 mb-2">{items.length} variações</div>
                </div>
                <div className="border rounded overflow-hidden">
                  {items.map((it, idx)=> (
                    <div key={idx} className="border-b last:border-0">
                      <button type="button" onClick={()=> setExpandedIdx(prev => prev === idx ? null : idx)} className="w-full text-left px-3 py-3">
                        <div className="grid grid-cols-[1fr_auto_auto] items-start gap-3">
                          <div>
                            <div className="text-sm font-medium leading-tight truncate">{it.name || '-'}</div>
                            <div className="mt-1 text-xs text-gray-600">
                              <span>Estoque: {parseInt(it.stockInitial || '0', 10) || 0}</span>
                            </div>
                          </div>
                            <div>
                              <label className="text-xs text-gray-600">Código</label>
                              <div className="text-xs text-gray-500 pt-[1px]">{it.reference || ''}</div>
                            </div>
                          <div className="text-right">
                            <div className="text-base font-semibold leading-tight">{fmtBRL(it.promoPrice || it.salePrice)}</div>
                            <div className="text-xs text-gray-600">Custo: {fmtBRL(it.cost)}</div>
                          </div>
                        </div>
                      </button>
                      {expandedIdx === idx && (
                        <div className="px-3 pb-3">
                          <div className="grid grid-cols-1 gap-3">
                            <input value={it.name} onChange={e=>updateItem(idx,'name', e.target.value)} className="w-full border rounded px-3 py-2 text-sm" placeholder="Nome da variação" />
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-3">
                            <div>
                              <label className="text-xs text-gray-600">Custo</label>
                              <input type="number" step="0.01" value={it.cost} onChange={e=>updateItem(idx,'cost', e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600">Preço de venda</label>
                              <input type="number" step="0.01" value={it.salePrice} onChange={e=>updateItem(idx,'salePrice', e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600">Preço promocional</label>
                              <input type="number" step="0.01" value={it.promoPrice ?? ''} onChange={e=>updateItem(idx,'promoPrice', e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                            </div>
                          </div>
                          <div className="mt-2">
                            <button type="button" onClick={()=>calcSale(idx)} className="text-xs text-green-700">Calcular preço de venda</button>
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-3">
                            <div>
                              <label className="text-xs text-gray-600">Código de barras</label>
                              <input value={it.barcode} onChange={e=>updateItem(idx,'barcode', e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600">Código do produto</label>
                              <input value={it.reference} onChange={e=>updateItem(idx,'reference', e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600">Validade</label>
                              <input type="date" value={it.validityDate || ''} onChange={e=>updateItem(idx,'validityDate', e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-3">
                            <div>
                              <label className="text-xs text-gray-600">Estoque inicial</label>
                              <input type="number" value={it.stockInitial} onChange={e=>updateItem(idx,'stockInitial', e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600">Estoque mínimo (alerta)</label>
                              <input type="number" value={it.stockMin} onChange={e=>updateItem(idx,'stockMin', e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                            </div>
                            <div className="flex items-end">
                              <div className="flex items-center gap-2 text-sm">
                                <span>Ativa</span>
                                <button type="button" onClick={()=>updateItem(idx,'active', !(it.active))} className={`relative inline-flex h-5 w-9 items-center rounded-full ${it.active ? 'bg-green-500' : 'bg-gray-300'}`}>
                                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${it.active ? 'translate-x-4' : 'translate-x-1'}`}></span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="px-3 py-6 text-sm text-gray-500">Nenhuma variação adicionada ainda.</div>
                  )}
                </div>
              </div>

              {/* Desktop form */}
              <div className="hidden md:block space-y-6">
                {items.map((it, idx)=> (
                  <div key={idx} className="border rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">Variação {idx+1} {items[idx]?.createdAt ? '' : <span className="ml-2 text-xs text-gray-500">Nova</span>}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-3">
                        <input value={it.name} onChange={e=>updateItem(idx,'name', e.target.value)} className="w-full border rounded px-3 py-2 text-sm" placeholder="Nome da variação" />
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs text-gray-600">Custo</label>
                        <input type="number" step="0.01" value={it.cost} onChange={e=>updateItem(idx,'cost', e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Preço de venda</label>
                        <input type="number" step="0.01" value={it.salePrice} onChange={e=>updateItem(idx,'salePrice', e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Preço promocional</label>
                        <input type="number" step="0.01" value={it.promoPrice ?? ''} onChange={e=>updateItem(idx,'promoPrice', e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                      </div>
                    </div>
                    <div className="mt-2">
                      <button type="button" onClick={()=>calcSale(idx)} className="text-xs text-green-700">Calcular preço de venda</button>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs text-gray-600">Código de barras</label>
                        <input value={it.barcode} onChange={e=>updateItem(idx,'barcode', e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Código do produto</label>
                        <input value={it.reference} onChange={e=>updateItem(idx,'reference', e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Validade</label>
                        <input type="date" value={it.validityDate || ''} onChange={e=>updateItem(idx,'validityDate', e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs text-gray-600">Estoque inicial</label>
                        <input type="number" value={it.stockInitial} onChange={e=>updateItem(idx,'stockInitial', e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Estoque mínimo (alerta)</label>
                        <input type="number" value={it.stockMin} onChange={e=>updateItem(idx,'stockMin', e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                      </div>
                      <div className="flex items-end">
                        <div className="flex items-center gap-2 text-sm">
                          <span>Ativa</span>
                          <button type="button" onClick={()=>updateItem(idx,'active', !(it.active))} className={`relative inline-flex h-5 w-9 items-center rounded-full ${it.active ? 'bg-green-500' : 'bg-gray-300'}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${it.active ? 'translate-x-4' : 'translate-x-1'}`}></span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          <div className="mt-3 px-6 flex items-center justify-between">
            <button type="button" onClick={addItem} className="px-3 py-2 border rounded text-sm">Adicionar nova variação</button>
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} className="px-3 py-2 border rounded text-sm">Cancelar</button>
              <button type="submit" className="px-3 py-2 rounded text-sm bg-green-600 text-white">Confirmar</button>
            </div>
          </div>
          </div>
        </form>
      </div>
    </div>
  )
}
