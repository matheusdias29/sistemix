import React, { useEffect, useMemo, useState } from 'react'
import { updateStore, ensureUniqueSlug } from '../services/stores'

export default function CatalogPage({ storeId, store, onNavigate }) {
  const [catalogEnabled, setCatalogEnabled] = useState(!!(store?.catalogEnabled))
  const [slug, setSlug] = useState(store?.catalogSlug || '')
  const [outOfStock, setOutOfStock] = useState(store?.catalogOutOfStock || 'show')
  const [banners, setBanners] = useState(Array.isArray(store?.catalogBanners) ? store.catalogBanners.slice(0,5) : [])
  const [openingHours, setOpeningHours] = useState(store?.catalogOpeningHours || '')
  const [openingDays, setOpeningDays] = useState(store?.catalogOpeningDays || '')
  const [catalogWhatsapp, setCatalogWhatsapp] = useState(store?.catalogWhatsapp || '')
  const [catalogMessage, setCatalogMessage] = useState(store?.catalogMessage || '')

  useEffect(() => {
    setCatalogEnabled(!!(store?.catalogEnabled))
    setSlug(store?.catalogSlug || '')
    setOutOfStock(store?.catalogOutOfStock || 'show')
    setBanners(Array.isArray(store?.catalogBanners) ? store.catalogBanners.slice(0,5) : [])
    setOpeningHours(store?.catalogOpeningHours || '')
    setOpeningDays(store?.catalogOpeningDays || '')
    setCatalogWhatsapp(store?.catalogWhatsapp || '')
    setCatalogMessage(store?.catalogMessage || '')
  }, [store?.id])

  const displaySlug = useMemo(() => {
    const toSlug = (v) => String(v || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
    const baseName = toSlug(store?.name || '')
    const base = slug && slug.trim() ? toSlug(slug) : baseName
    return base
  }, [slug, store?.name])

  const catalogLink = `https://sistmix.app.br/${displaySlug || ''}`

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
    const toSlug = (val) => String(val || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
    const s = toSlug(v)
    try {
      const unique = await ensureUniqueSlug(s, storeId)
      setSlug(unique)
      await save({ catalogSlug: unique })
    } catch {
      setSlug(s)
      await save({ catalogSlug: s })
    }
  }

  const onChangeOutOfStock = async (v) => {
    setOutOfStock(v)
    await save({ catalogOutOfStock: v })
  }

  const onChangeOpeningHours = async (v) => {
    setOpeningHours(v)
    await save({ catalogOpeningHours: v })
  }

  const onChangeOpeningDays = async (v) => {
    setOpeningDays(v)
    await save({ catalogOpeningDays: v })
  }

  const onChangeCatalogWhatsapp = async (v) => {
    setCatalogWhatsapp(v)
    await save({ catalogWhatsapp: v })
  }

  const onChangeCatalogMessage = async (v) => {
    setCatalogMessage(v)
    await save({ catalogMessage: v })
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
        <div className="text-sm font-semibold">Horário de funcionamento</div>
        <div className="text-xs text-gray-600 mt-1">Configure os dias e horários que aparecerão no catálogo</div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Dias de funcionamento</label>
            <input
              value={openingDays}
              onChange={e => onChangeOpeningDays(e.target.value)}
              placeholder="Ex: Seg à Sex"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Horário</label>
            <input
              value={openingHours}
              onChange={e => onChangeOpeningHours(e.target.value)}
              placeholder="Ex: 08h - 18h"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm font-semibold">WhatsApp para pedidos</div>
        <div className="text-xs text-gray-600 mt-1">Número que receberá as mensagens quando o cliente clicar em comprar</div>
        <div className="mt-3">
          <label className="block text-xs font-medium text-gray-700 mb-1">Número do WhatsApp (apenas números)</label>
          <input
            value={catalogWhatsapp}
            onChange={e => onChangeCatalogWhatsapp(e.target.value)}
            placeholder="Ex: 11999999999"
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">Mensagem padrão ao clicar em comprar</label>
          <div className="text-[10px] text-gray-500 mb-1">Use <b>{'{produto}'}</b> onde quiser que apareça o nome do produto.</div>
          <textarea
            value={catalogMessage}
            onChange={e => onChangeCatalogMessage(e.target.value)}
            placeholder="Ex: Olá, tenho interesse no produto: {produto}"
            className="w-full border rounded px-3 py-2 text-sm h-20 resize-none"
          />
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
