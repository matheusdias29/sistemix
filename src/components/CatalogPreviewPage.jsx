import React, { useEffect, useMemo, useState } from 'react'
import { listenProducts } from '../services/products'

export default function CatalogPreviewPage({ storeId, store }) {
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState('')
  const [catalogEnabled, setCatalogEnabled] = useState(!!(store?.catalogEnabled))
  const [outOfStock, setOutOfStock] = useState(store?.catalogOutOfStock || 'show')

  useEffect(() => {
    setCatalogEnabled(!!(store?.catalogEnabled))
    setOutOfStock(store?.catalogOutOfStock || 'show')
  }, [store?.id, store?.catalogEnabled, store?.catalogOutOfStock])

  useEffect(() => {
    if (!storeId) return
    const unsub = listenProducts(items => setProducts(items), storeId)
    return () => { unsub && unsub() }
  }, [storeId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = products.filter(p => (p.active ?? true))
    if (q) {
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.reference || '').toLowerCase().includes(q)
      )
    }
    if (outOfStock === 'hide') {
      list = list.filter(p => Number(p.stock || 0) > 0)
    }
    return list
  }, [products, query, outOfStock])

  return (
    <div className="space-y-3">
      {!catalogEnabled && (
        <div className="rounded bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 text-sm">
          Catálogo desativado. Esta é uma visualização interna.
        </div>
      )}
      <div className="bg-white p-4 rounded shadow flex items-center gap-3">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar produtos"
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map(p => {
          const priceMin = Number(p.priceMin ?? p.salePrice ?? 0)
          const stockZero = Number(p.stock || 0) === 0
          const disabled = outOfStock === 'disabled' && stockZero
          return (
            <div key={p.id} className={`rounded-lg border bg-white p-3 flex flex-col h-full ${disabled ? 'opacity-60' : ''}`}>
              <div className="h-28 bg-gray-100 rounded mb-2 flex items-center justify-center text-xs text-gray-500">Imagem</div>
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-xs text-gray-500">{p.reference || ''}</div>
              <div className="text-green-700 font-semibold mb-2">{priceMin.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
              <div className="mt-auto">
                {stockZero && outOfStock !== 'hide' && (
                  <div className="text-xs text-red-600 mb-2">Indisponível</div>
                )}
                <button className="w-full px-3 py-2 rounded bg-gray-100 text-gray-700 text-sm" disabled>
                  Em breve
                </button>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-sm text-gray-600">Nenhum produto encontrado.</div>
        )}
      </div>
    </div>
  )
}
