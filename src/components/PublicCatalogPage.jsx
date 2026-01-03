import React, { useEffect, useMemo, useState } from 'react'
import { listenProducts } from '../services/products'

export default function PublicCatalogPage({ storeId, store }) {
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState('')

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
    return list
  }, [products, query])

  if (!storeId) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-xl font-semibold">Loja não encontrada</div>
          <div className="text-sm text-gray-600">Verifique o link do catálogo.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-bold text-lg text-gray-900">{store?.name || 'Loja'}</div>
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar produtos"
              className="w-56 border rounded px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(p => {
            const priceMin = Number(p.priceMin ?? p.salePrice ?? 0)
            const stockZero = Number(p.stock || 0) === 0
            return (
              <div key={p.id} className="rounded-lg border bg-white p-3">
                <div className="h-28 bg-gray-100 rounded mb-2 flex items-center justify-center text-xs text-gray-500">Imagem</div>
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs text-gray-500 mb-1">{p.reference || ''}</div>
                <div className="text-green-700 font-semibold">{priceMin.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                {stockZero && (
                  <div className="mt-1 text-xs text-red-600">Indisponível</div>
                )}
                <button className="mt-2 w-full px-3 py-2 rounded bg-green-600 text-white text-sm" disabled>
                  Comprar
                </button>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-sm text-gray-600">Nenhum produto encontrado.</div>
          )}
        </div>
      </main>
    </div>
  )
}
