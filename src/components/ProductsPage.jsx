import React, { useMemo, useState, useEffect } from 'react'
import { listenProducts, updateProduct } from '../services/products'
import NewProductModal from './NewProductModal'
import { listenCategories, updateCategory } from '../services/categories'
import NewCategoryModal from './NewCategoryModal'
import { listenSuppliers, updateSupplier } from '../services/suppliers'
import NewSupplierModal from './NewSupplierModal'

const tabs = [
  { key: 'produto', label: 'Produto' },
  { key: 'categorias', label: 'Categorias' },
  { key: 'movestoque', label: 'Movimento De Estoque' },
  { key: 'fornecedores', label: 'Fornecedores' },
  { key: 'compras', label: 'Compras' },
]

export default function ProductsPage({ storeId, addNewSignal }){
  const [tab, setTab] = useState('produto')
  const [products, setProducts] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState('list')
  const [showFilters, setShowFilters] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  // Mobile: controle de sanfona por linha (produtos abertos)
  const [mobileOpenRows, setMobileOpenRows] = useState(() => new Set())

  // Categorias
  const [categories, setCategories] = useState([])
  const [catSelected, setCatSelected] = useState(() => new Set())
  const [catShowActive, setCatShowActive] = useState(true)
  const [catShowInactive, setCatShowInactive] = useState(false)
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [catEditOpen, setCatEditOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)

  // Fornecedores
  const [suppliers, setSuppliers] = useState([])
  const [supplierModalOpen, setSupplierModalOpen] = useState(false)
  const [supplierEditOpen, setSupplierEditOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [supSelected, setSupSelected] = useState(() => new Set())

  useEffect(() => {
    const unsubProd = listenProducts(items => setProducts(items), storeId)
    const unsubCat = listenCategories(items => setCategories(items), storeId)
    const unsubSup = listenSuppliers(items => setSuppliers(items), storeId)
    return () => {
      unsubProd && unsubProd()
      unsubCat && unsubCat()
      unsubSup && unsubSup()
    }
  }, [storeId])

  const filtered = useMemo(()=>{
    const q = query.trim().toLowerCase()
    return products.filter(p => (p.name || '').toLowerCase().includes(q))
  }, [products, query])

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase()
    return categories
      .filter(c => (c.name || '').toLowerCase().includes(q))
      .filter(c => (c.active ?? true) ? catShowActive : catShowInactive)
  }, [categories, query, catShowActive, catShowInactive])

  const toggleSelect = (id) => {
    const next = new Set(selected)
    if(next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }

  const toggleMobileRow = (id) => {
    const next = new Set(mobileOpenRows)
    if(next.has(id)) next.delete(id); else next.add(id)
    setMobileOpenRows(next)
  }

  const toggleCatSelect = (id) => {
    const next = new Set(catSelected)
    if(next.has(id)) next.delete(id); else next.add(id)
    setCatSelected(next)
  }

  const toggleCategoryActive = async (id) => {
    const c = categories.find(x=>x.id===id)
    if(!c) return
    await updateCategory(id, { active: !c.active })
  }

  const addNew = () => {
    if(tab === 'categorias'){
      setCatModalOpen(true)
    } else if (tab === 'fornecedores'){
      setSupplierModalOpen(true)
    } else {
      setModalOpen(true)
    }
  }

  // Disparo pelo Header: quando o sinal muda, abre o modal apropriado
  useEffect(() => {
    if (typeof addNewSignal === 'number' && addNewSignal > 0) {
      // evita executar no mount inicial (state começa em 0)
      addNew()
    }
  }, [addNewSignal])

  const startEdit = (product) => {
    setEditingProduct(product)
    setEditModalOpen(true)
  }

  const startCategoryEdit = (category) => {
    setEditingCategory(category)
    setCatEditOpen(true)
  }

  const startSupplierEdit = (supplier) => {
    setEditingSupplier(supplier)
    setSupplierEditOpen(true)
  }

  return (
    <div>
      {/* Tabs no topo: rolável no mobile */}
      <div className="mb-3">
        <div className="flex items-center gap-3 text-sm overflow-x-auto whitespace-nowrap md:overflow-visible scrollbar-none -mx-2 px-2">
          {tabs.map(t => (
            <button
              key={t.key}
              className={`shrink-0 inline-flex px-2 py-1 ${tab===t.key ? 'text-green-700 font-medium border-b-2 border-green-600' : 'text-gray-600'}`}
              onClick={()=>setTab(t.key)}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {/* Toolbar de busca com botões à direita */}
      <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pesquisar..." className="px-3 py-2 border rounded" />
        <div className="flex gap-2 items-center">
          {/* Filtros: ícone-only no mobile, texto no desktop */}
          <button
            className="md:hidden h-9 w-9 rounded border flex items-center justify-center"
            aria-label="Filtros"
            title="Filtros"
            onClick={()=>setShowFilters(x=>!x)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M3 5h18M6 12h12M10 19h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button className="hidden md:inline-flex px-3 py-2 rounded border text-sm" onClick={()=>setShowFilters(x=>!x)}>Filtros</button>

          {/* Alternador de visualização */}
          <button className="px-3 py-2 rounded border text-sm" onClick={()=>setViewMode(viewMode==='list'?'grid':'list')}>≡</button>

          {/* Opções: oculto na aba Produto e no mobile */}
          {(tab !== 'produto') && (
            <button className="hidden md:inline-flex px-3 py-2 rounded border text-sm">Opções</button>
          )}

          {/* + Novo: aparece na toolbar somente no desktop */}
          <button className="hidden md:inline-flex px-3 py-2 rounded bg-green-600 text-white text-sm" onClick={addNew}>+ Novo</button>

          </div>
      </div>

      {/* Barra fina de cabeçalho da listagem (oculta no mobile quando tab=produto) */}
      <div className={`mt-2 px-3 py-2 rounded bg-gray-100 text-xs text-gray-600 ${tab==='produto' ? 'hidden md:block' : ''}`}>
        {tab==='produto' && (
          <div className="grid grid-cols-[1.5rem_1fr_1fr_12rem_6rem_6rem_2rem]">
            <div></div>
            <div>Produto ({filtered.length})</div>
            <div className="text-center">Variações</div>
            <div className="text-right">Preço</div>
            <div className="text-right">Estoque</div>
            <div className="text-right">Status</div>
            <div></div>
          </div>
        )}
        {tab==='categorias' && (
          <div className="grid grid-cols-[1fr_8rem_6rem]">
            <div>Categorias ({filteredCategories.length})</div>
            <div className="text-right">Status</div>
            <div></div>
          </div>
        )}
        {tab==='fornecedores' && (
          <div className="grid grid-cols-[1fr_8rem_6rem]">
            <div>Fornecedores ({suppliers.length})</div>
            <div className="text-right">Status</div>
            <div></div>
          </div>
        )}
      </div>

      <div className="mt-4">
        {(tab==='produto') ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {filtered.map(p => {
              const priceMin = Number(p.priceMin ?? p.salePrice ?? 0)
              const priceMax = Number(p.priceMax ?? p.salePrice ?? priceMin)
              const priceText = priceMin !== priceMax
                ? `De ${priceMin.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} a ${priceMax.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`
                : `${priceMin.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`
              const stock = Number(p.stock ?? 0)
              return (
                <>
                <div key={p.id} className="grid grid-cols-[1.5rem_1fr_auto_auto] md:grid-cols-[1.5rem_1fr_1fr_12rem_6rem_6rem_2rem] items-center px-4 py-3 border-b last:border-0">
                  <div>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={()=>toggleSelect(p.id)} />
                  </div>
                  <div className="text-xs md:text-sm">
                    <div className="font-medium cursor-pointer" onClick={()=>startEdit(p)}>{p.name}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      {(p.variations ?? 0) > 0 ? `${p.variations} variantes` : 'variantes'}
                      <span className="red-dot" />
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      Estoque: {stock.toLocaleString('pt-BR')}
                      <span className="red-dot" />
                    </div>
                  </div>
                  {/* Prévia de variações no desktop: centralizada entre nome e preço, até 2 linhas */}
                  <div className="hidden md:block text-xs text-gray-700 md:text-center md:justify-self-center">
                    {Array.isArray(p.variationsData) && p.variationsData.length > 0 ? (
                      <div className="space-y-1">
                        {p.variationsData.slice(0,2).map((v, idx) => {
                          const sale = Number(v?.salePrice ?? 0)
                          const promo = v?.promoPrice != null ? Number(v.promoPrice) : null
                          const price = promo != null ? promo : sale
                          return (
                            <div key={idx} className="flex items-center justify-center gap-2">
                              <span className="font-medium truncate">{v?.name || v?.label || `Variação ${idx+1}`}</span>
                              {v?.reference ? (<span className="text-gray-500">({v.reference})</span>) : null}
                              <span className="whitespace-nowrap">
                                {price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                              </span>
                            </div>
                          )
                        })}
                        {Array.isArray(p.variationsData) && p.variationsData.length > 2 ? (
                          <div className="flex items-center justify-center pt-1">
                            <button
                              type="button"
                              aria-label="Abrir todas as variações"
                              title="Abrir todas as variações"
                              className="inline-flex h-7 w-7 items-center justify-center rounded border"
                              onClick={()=>toggleMobileRow(p.id)}
                            >
                              <svg
                                className={`${mobileOpenRows.has(p.id) ? '' : 'rotate-180'} transition-transform`}
                                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                              >
                                <polyline points="18 15 12 9 6 15"></polyline>
                              </svg>
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-gray-500">—</div>
                    )}
                  </div>
                  <div className="text-right text-xs md:text-sm whitespace-nowrap md:whitespace-normal md:text-right md:pl-0 pl-4 justify-self-end">{priceText}</div>
                  {/* Botão sanfona (somente mobile) */}
                  <div className="md:hidden text-right">
                    <button
                      type="button"
                      aria-label="Abrir detalhes"
                      title="Abrir detalhes"
                      className="inline-flex h-8 w-8 items-center justify-center rounded border"
                      onClick={()=>toggleMobileRow(p.id)}
                    >
                      {/* Chevron up; gira quando fechado */}
                      <svg
                        className={`${mobileOpenRows.has(p.id) ? '' : 'rotate-180'} transition-transform`}
                        width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      >
                        <polyline points="18 15 12 9 6 15"></polyline>
                      </svg>
                    </button>
                  </div>
                  <div className={`hidden md:block text-right text-sm ${stock === 0 ? 'text-red-500' : ''}`}>{stock.toLocaleString('pt-BR')}</div>
                  <div className="hidden md:block text-right text-sm">
                    <div className={`px-2 py-1 rounded text-xs ${(p.active ?? true) ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>{(p.active ?? true) ? 'Ativo' : 'Inativo'}</div>
                  </div>
                  <div className="hidden md:block text-right text-sm">⋯</div>
                  </div>
                  {/* Painel sanfona com variações (somente mobile) com animação */}
                  <div className={`md:hidden px-4 ${mobileOpenRows.has(p.id) ? 'py-2 bg-gray-50 border-b' : 'py-0'} last:border-0`}
                  >
                    <div className={`overflow-hidden transition-all duration-200 ease-in-out ${mobileOpenRows.has(p.id) ? 'max-h-[480px] opacity-100' : 'max-h-0 opacity-0'}`}>
                      {Array.isArray(p.variationsData) && p.variationsData.length > 0 ? (
                        <div className="space-y-2">
                          {p.variationsData.map((v, idx) => {
                            const sale = Number(v?.salePrice ?? 0)
                            const promo = v?.promoPrice != null ? Number(v.promoPrice) : null
                            const price = promo != null ? promo : sale
                            const stockVar = Number(v?.stock ?? 0)
                            return (
                              <div key={idx} className="grid grid-cols-[1fr_6rem] items-center gap-2 text-xs">
                                <div className="truncate">
                                  <span className="font-medium">{v?.name || v?.label || `Variação ${idx+1}`}</span>
                                  {v?.reference ? (<span className="ml-1 text-gray-500">({v.reference})</span>) : null}
                                  {stockVar ? (<span className="ml-2 text-gray-500">Estoque: {stockVar.toLocaleString('pt-BR')}</span>) : null}
                                </div>
                                <div className="text-right whitespace-nowrap">
                                  {price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-600 py-2">Sem variações cadastradas</div>
                      )}
                    </div>
                  </div>
                  {/* Painel sanfona com variações (somente desktop) com animação */}
                  <div className={`hidden md:block px-4 ${mobileOpenRows.has(p.id) ? 'py-2 bg-gray-50 border-b' : 'py-0'} last:border-0`}>
                    <div className={`overflow-hidden transition-all duration-200 ease-in-out ${mobileOpenRows.has(p.id) ? 'max-h-[480px] opacity-100' : 'max-h-0 opacity-0'}`}>
                      {Array.isArray(p.variationsData) && p.variationsData.length > 0 ? (
                        <div className="space-y-2">
                          {p.variationsData.map((v, idx) => {
                            const sale = Number(v?.salePrice ?? 0)
                            const promo = v?.promoPrice != null ? Number(v.promoPrice) : null
                            const price = promo != null ? promo : sale
                            const stockVar = Number(v?.stock ?? 0)
                            return (
                              <div key={idx} className="grid grid-cols-[1fr_6rem] items-center gap-2 text-sm">
                                <div className="truncate">
                                  <span className="font-medium">{v?.name || v?.label || `Variação ${idx+1}`}</span>
                                  {v?.reference ? (<span className="ml-1 text-gray-500">({v.reference})</span>) : null}
                                  {stockVar ? (<span className="ml-2 text-gray-500">Estoque: {stockVar.toLocaleString('pt-BR')}</span>) : null}
                                </div>
                                <div className="text-right whitespace-nowrap">
                                  {price.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600 py-2">Sem variações cadastradas</div>
                      )}
                    </div>
                  </div>
                </>
              )
            })}
          </div>
        ) : (
          tab==='categorias' ? (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {/* Mantém listagem de categorias */}
              <div className="grid grid-cols-[1.5rem_1fr_8rem_2rem] items-center px-4 py-3 text-xs text-gray-500 border-b">
                <div></div>
                <div>Nome</div>
                <div className="text-right">Status</div>
                <div></div>
              </div>
              {filteredCategories.map(c => (
                <div key={c.id} className="grid grid-cols-[1.5rem_1fr_8rem_2rem] items-center px-4 py-3 border-b last:border-0">
                  <div></div>
                  <div className="text-sm">
                    <div className="font-medium cursor-pointer" onClick={()=>startCategoryEdit(c)}>{c.name}</div>
                  </div>
                  <div className="hidden md:block text-sm text-right">
                    <div className={`px-2 py-1 rounded text-xs ${(c.active ?? true) ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>{(c.active ?? true) ? 'Ativo' : 'Inativo'}</div>
                  </div>
                  <div className="text-right text-sm">⋯</div>
                </div>
              ))}
            </div>
          ) : tab==='fornecedores' ? (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="grid grid-cols-[1.5rem_1fr_8rem_2rem] items-center px-4 py-3 text-xs text-gray-500 border-b">
                <div></div>
                <div>Fornecedor ({suppliers.length})</div>
                <div className="text-right">Status</div>
                <div></div>
              </div>
              {suppliers.map(s => (
                <div key={s.id} className="grid grid-cols-[1.5rem_1fr_8rem_2rem] items-center px-4 py-3 border-b last:border-0">
                  <div></div>
                  <div className="text-sm">
                    <div className="font-medium cursor-pointer" onClick={()=>startSupplierEdit(s)}>{s.name}</div>
                  </div>
                  <div className="hidden md:block text-sm text-right">
                    <div className={`px-2 py-1 rounded text-xs ${(s.active ?? true) ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>{(s.active ?? true) ? 'Ativo' : 'Inativo'}</div>
                  </div>
                  <div className="text-right text-sm">⋯</div>
                </div>
              ))}
            </div>
          ) : null)
        }
      </div>
      <NewProductModal open={modalOpen} onClose={()=>setModalOpen(false)} categories={categories} suppliers={suppliers} storeId={storeId} />
      <NewProductModal open={editModalOpen} onClose={()=>setEditModalOpen(false)} isEdit={true} product={editingProduct} categories={categories} suppliers={suppliers} storeId={storeId} />
      <NewCategoryModal open={catModalOpen} onClose={()=>setCatModalOpen(false)} storeId={storeId} />
      <NewCategoryModal open={catEditOpen} onClose={()=>setCatEditOpen(false)} isEdit={true} category={editingCategory} storeId={storeId} />
      <NewSupplierModal open={supplierModalOpen} onClose={()=>setSupplierModalOpen(false)} storeId={storeId} />
      <NewSupplierModal open={supplierEditOpen} onClose={()=>setSupplierEditOpen(false)} isEdit={true} supplier={editingSupplier} storeId={storeId} />
    </div>
  )
}
