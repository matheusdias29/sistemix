import React, { useEffect, useMemo, useState } from 'react'
import { updateStore } from '../services/stores'

export default function CatalogPage({ storeId, store, onNavigate }) {
  const [catalogEnabled, setCatalogEnabled] = useState(!!(store?.catalogEnabled))
  const [slug, setSlug] = useState(store?.catalogSlug || '')
  const [outOfStock, setOutOfStock] = useState(store?.catalogOutOfStock || 'show')
  const [payDescription, setPayDescription] = useState(store?.catalogPayDescription || '')
  const [installments, setInstallments] = useState(String(store?.catalogInstallments || ''))
  const [promoInstallments, setPromoInstallments] = useState(!!(store?.catalogPromoInstallments))
  const [banners, setBanners] = useState(Array.isArray(store?.catalogBanners) ? store.catalogBanners.slice(0,5) : [])

  useEffect(() => {
    setCatalogEnabled(!!(store?.catalogEnabled))
    setSlug(store?.catalogSlug || '')
    setOutOfStock(store?.catalogOutOfStock || 'show')
    setPayDescription(store?.catalogPayDescription || '')
    setInstallments(String(store?.catalogInstallments || ''))
    setPromoInstallments(!!(store?.catalogPromoInstallments))
    setBanners(Array.isArray(store?.catalogBanners) ? store.catalogBanners.slice(0,5) : [])
  }, [store?.id])

  const displaySlug = useMemo(() => {
    const baseName = String(store?.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
    const base = slug && slug.trim() ? slug.trim() : baseName
    return base
  }, [slug, store?.name])

  const catalogLink = `https://sistemix.netlify.app/${displaySlug || ''}`
  const wholesalerCatalogLink = 'https://docs.google.com/spreadsheets/d/1qcKgBAFPSCwVDrJv3CJ8BmgGrsle0PfEa7UIMi8bn_M/edit?gid=0#gid=0'

  const save = async (partial) => {
    if (!storeId) return
    await updateStore(storeId, partial)
  }

  const onToggleEnabled = async () => {
    const next = !catalogEnabled
    setCatalogEnabled(next)
    await save({ catalogEnabled: next })
  }

  const onChangeSlug = async (v) => {
    setSlug(v)
    await save({ catalogSlug: v })
  }

  const onChangeOutOfStock = async (v) => {
    setOutOfStock(v)
    await save({ catalogOutOfStock: v })
  }

  const onChangePayDescription = async (v) => {
    setPayDescription(v)
    await save({ catalogPayDescription: v })
  }

  const onInsertVar = (key) => {
    const t = key === 'parcelas' ? '{{parcelas}}' : '{{valor_parcela}}'
    const next = `${payDescription}${payDescription ? ' ' : ''}${t}`
    onChangePayDescription(next)
  }

  const onChangeInstallments = async (v) => {
    setInstallments(v)
    const n = parseInt(String(v), 10) || 0
    await save({ catalogInstallments: n })
  }

  const onTogglePromoInstallments = async () => {
    const next = !promoInstallments
    setPromoInstallments(next)
    await save({ catalogPromoInstallments: next })
  }

  const onAddBanner = async (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result
      const next = [...banners, { url: dataUrl }]
      const sliced = next.slice(0,5)
      setBanners(sliced)
      await save({ catalogBanners: sliced })
    }
    reader.readAsDataURL(file)
  }

  const onRemoveBanner = async (idx) => {
    const next = banners.filter((_, i) => i !== idx)
    setBanners(next)
    await save({ catalogBanners: next })
  }

  const shareWholesalerCatalog = async () => {
    const url = wholesalerCatalogLink
    const text = 'Confira o catálogo para lojistas'
    const hasNavigator = typeof navigator !== 'undefined'
    if (hasNavigator && navigator.share) {
      try {
        await navigator.share({
          title: 'Catálogo lojista',
          text,
          url,
        })
        return
      } catch (e) {
      }
    }
    if (hasNavigator && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url)
        alert('Link copiado!')
        return
      } catch (e) {
      }
    }
    if (typeof window !== 'undefined') {
      window.open(url, '_blank')
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-semibold">Dados da empresa</div>
            <div className="text-xs text-gray-600 mt-1">Complete as informações da sua empresa para que seu catálogo online fique completo</div>
          </div>
          <button
            className="px-4 py-2 rounded bg-green-600 text-white text-sm font-medium"
            onClick={() => onNavigate && onNavigate('dadosEmpresa')}
          >
            Completar Dados Da Empresa
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm font-semibold">Link do catálogo online</div>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-2">
          <input
            value={displaySlug}
            onChange={e => onChangeSlug(e.target.value)}
            placeholder="sistemix.netlify.app/seuslug"
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <button
            className={`px-3 py-2 rounded text-sm ${catalogEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}
            onClick={onToggleEnabled}
          >
            {catalogEnabled ? 'Ativado' : 'Ativar Catálogo Online'}
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3 text-sm">
          <a className="text-green-700 hover:underline" href={catalogLink} target="_blank" rel="noreferrer">{catalogLink}</a>
          <button className="text-green-700 hover:underline" onClick={() => navigator.clipboard && navigator.clipboard.writeText(catalogLink)}>Copiar Link</button>
          <button className="px-3 py-1 rounded bg-gray-100 text-gray-700" onClick={() => onNavigate && onNavigate('catalogoPreview')}>Visualizar Catálogo</button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm font-semibold">Link do catálogo lojista</div>
        <div className="mt-2 flex items-center gap-3 text-sm">
          <a
            className="text-green-700 hover:underline"
            href={wholesalerCatalogLink}
            target="_blank"
            rel="noreferrer"
          >
            {wholesalerCatalogLink}
          </a>
          <button
            className="text-green-700 hover:underline"
            onClick={() => navigator.clipboard && navigator.clipboard.writeText(wholesalerCatalogLink)}
          >
            Copiar Link
          </button>
          <button
            className="px-3 py-1 rounded bg-gray-100 text-gray-700"
            onClick={shareWholesalerCatalog}
          >
            Compartilhar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm font-semibold">Produtos sem estoque</div>
        <div className="mt-2">
          <select
            value={outOfStock}
            onChange={e => onChangeOutOfStock(e.target.value)}
            className="w-full md:w-64 border rounded px-3 py-2 text-sm"
          >
            <option value="show">Exibir normalmente</option>
            <option value="hide">Ocultar do catálogo</option>
            <option value="disabled">Mostrar como indisponível</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm font-semibold">Configure o parcelamento dos produtos</div>
        <div className="mt-3 grid gap-3">
          <div className="text-xs text-gray-600">Descrição de pagamento</div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 rounded bg-gray-100 text-sm" onClick={() => onInsertVar('parcelas')}>Número de parcelas</button>
            <button className="px-3 py-1 rounded bg-gray-100 text-sm" onClick={() => onInsertVar('valor')}>Valor da parcela</button>
          </div>
          <textarea
            value={payDescription}
            onChange={e => onChangePayDescription(e.target.value)}
            placeholder="Basta clicar nos botões acima para adicionar as variáveis disponíveis"
            className="mt-2 w-full border rounded px-3 py-2 text-sm h-24"
          />
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] items-center gap-2">
            <input
              type="number"
              value={installments}
              onChange={e => onChangeInstallments(e.target.value)}
              placeholder="Número de parcelas"
              className="border rounded px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={promoInstallments} onChange={onTogglePromoInstallments} />
              Parcelar produtos em promoção
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm font-semibold">Banners da loja</div>
        <div className="text-xs text-gray-600 mt-1">Adicione até 5 banners para personalizar sua loja</div>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3">
          {banners.map((b, idx) => (
            <div key={idx} className="relative border rounded overflow-hidden h-28 bg-gray-100">
              {b?.url ? <img src={b.url} alt="" className="w-full h-full object-cover" /> : null}
              <button type="button" className="absolute top-1 right-1 bg-white rounded px-2 text-xs border" onClick={() => onRemoveBanner(idx)}>Remover</button>
            </div>
          ))}
          {banners.length < 5 && (
            <label className="border rounded flex items-center justify-center h-28 cursor-pointer bg-gray-50">
              <input type="file" className="hidden" accept="image/*" onChange={e => onAddBanner(e.target.files?.[0])} />
              <div className="text-xs text-gray-600">Adicionar imagem</div>
            </label>
          )}
        </div>
      </div>
    </div>
  )
}
