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

export default function ProductsPage(){
  const [tab, setTab] = useState('produto')
  const [products, setProducts] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState('list')
  const [showFilters, setShowFilters] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)

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
    const unsubProd = listenProducts(items => setProducts(items))
    const unsubCat = listenCategories(items => setCategories(items))
    const unsubSup = listenSuppliers(items => setSuppliers(items))
    return () => {
      unsubProd && unsubProd()
      unsubCat && unsubCat()
      unsubSup && unsubSup()
    }
  }, [])

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

  const toggleCatSelect = (id) => {
    const next = new Set(catSelected)
    if(next.has(id)) next.delete(id); else next.add(id)
    setCatSelected(next)
  }

  const toggleSupSelect = (id) => {
    const next = new Set(supSelected)
    if(next.has(id)) next.delete(id); else next.add(id)
    setSupSelected(next)
  }

  const toggleActive = async (id) => {
    const p = products.find(x=>x.id===id)
    if(!p) return
    await updateProduct(id, { active: !p.active })
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

  const startEdit = (p) => {
    setEditingProduct(p)
    setEditModalOpen(true)
  }

  const startCategoryEdit = (c) => {
    setEditingCategory(c)
    setCatEditOpen(true)
  }

  const startSupplierEdit = (s) => {
    setEditingSupplier(s)
    setSupplierEditOpen(true)
  }

  return (
    <div className="">
      {/* Tabs header */}
      <div className="bg-white rounded-lg p-4 shadow">
        <div className="flex items-center gap-6 text-sm">
          {tabs.map(t => (
            <button key={t.key} onClick={()=>setTab(t.key)} className={`pb-2 ${tab===t.key ? 'text-green-600 border-b-2 border-green-600 font-semibold' : 'text-gray-600'}`}>{t.label}</button>
          ))}
        </div>
        {/* Controls */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1">
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pesquisar..." className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          {tab==='produto' && (
            <>
              <button onClick={()=>setShowFilters(v=>!v)} className="px-3 py-2 border rounded text-sm">Filtros</button>
              <div className="flex items-center gap-1">
                <button onClick={()=>setViewMode('list')} className={`px-2 py-2 border rounded text-sm ${viewMode==='list'?'bg-gray-100':''}`}>☰</button>
                <button onClick={()=>setViewMode('grid')} className={`px-2 py-2 border rounded text-sm ${viewMode==='grid'?'bg-gray-100':''}`}>⬚</button>
              </div>
              <button className="px-3 py-2 border rounded text-sm">Opções</button>
            </>
          )}
          <button onClick={addNew} className="px-3 py-2 rounded text-sm bg-green-600 text-white">+ Novo</button>
        </div>
        {tab==='produto' && showFilters && (
          <div className="mt-3 p-3 border rounded text-sm text-gray-600">
            <div>Filtros rápidos (exemplo):</div>
            <div className="mt-2 flex gap-2">
              <button className="px-2 py-1 border rounded">Ativos</button>
              <button className="px-2 py-1 border rounded">Sem estoque</button>
              <button className="px-2 py-1 border rounded">Com variações</button>
            </div>
          </div>
        )}
        {tab==='categorias' && (
          <div className="mt-3 text-sm">
            <div className="flex gap-2">
              <button onClick={()=>setCatShowActive(v=>!v)} className={`px-2 py-1 border rounded-full flex items-center gap-2 ${catShowActive ? 'bg-green-50 border-green-200 text-green-700' : ''}`}>
                <span>✔</span>
                <span>Ativo</span>
              </button>
              <button onClick={()=>setCatShowInactive(v=>!v)} className={`px-2 py-1 border rounded-full ${catShowInactive ? 'bg-gray-100 border-gray-300 text-gray-700' : ''}`}>Inativo</button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="mt-4">
        {tab==='produto' ? (
          viewMode==='list' ? (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="grid grid-cols-[1.5rem_1fr_12rem_8rem_8rem] items-center px-4 py-3 text-xs text-gray-500 border-b">
                <div></div>
                <div>Produto ({filtered.length})</div>
                <div className="text-right">Preço</div>
                <div className="text-right">Estoque</div>
                <div className="text-right">Status</div>
              </div>
              {filtered.map(p => (
                <div key={p.id} className="grid grid-cols-[1.5rem_1fr_12rem_8rem_8rem] items-center px-4 py-3 border-b last:border-0">
                  <div>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={()=>toggleSelect(p.id)} />
                  </div>
                  <div className="text-sm">
                    <div className="font-medium cursor-pointer" onClick={()=>startEdit(p)}>{p.name} <span className="text-xs text-gray-500 ml-2">{(p.variations ?? 0)} variações</span></div>
                    <div className="mt-1 text-xs text-gray-500 flex items-center gap-2">
                      <span className="cursor-pointer">☆</span>
                      <span className="cursor-pointer">⋯</span>
                    </div>
                  </div>
                  <div className="text-sm text-right">
                    {(p.priceMin ?? 0)===(p.priceMax ?? 0) ? (
                      <span>{(p.priceMax ?? 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>
                    ) : (
                      <span>De {(p.priceMin ?? 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})} a {(p.priceMax ?? 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>
                    )}
                  </div>
                  <div className="text-sm text-right">
                    <span className={`${(p.stock ?? 0)>0 ? 'text-gray-800' : 'text-red-600'}`}>{p.stock ?? 0}</span>
                  </div>
                  <div className="text-sm text-right">
                    <div className={`px-2 py-1 rounded text-xs ${(p.active ?? true) ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>{(p.active ?? true) ? 'Ativo' : 'Inativo'}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filtered.map(p => (
                <div key={p.id} className="bg-white rounded-lg shadow p-4">
                  <div className="font-medium cursor-pointer" onClick={()=>startEdit(p)}>{p.name}</div>
                  <div className="mt-2 text-xs text-gray-500">{(p.variations ?? 0)} variações</div>
                  <div className="mt-2 text-sm">{(p.priceMin ?? 0)===(p.priceMax ?? 0) ? (
                    <span>{(p.priceMax ?? 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>
                  ) : (
                    <span>De {(p.priceMin ?? 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})} a {(p.priceMax ?? 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>
                  )}</div>
                  <div className="mt-2 text-sm">Estoque: <span className={`${(p.stock ?? 0)>0 ? '' : 'text-red-600'}`}>{p.stock ?? 0}</span></div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className={`px-2 py-1 rounded text-xs ${(p.active ?? true) ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>{(p.active ?? true) ? 'Ativo' : 'Inativo'}</div>
                    <div className="text-sm flex items-center gap-2"><span className="cursor-pointer">☆</span><span className="cursor-pointer">⋯</span></div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          tab==='categorias' ? (
            <div className="bg-white rounded-lg shadow overflow-hidden">
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
                  <div className="text-sm text-right">
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
                  <div className="text-sm text-right">
                    <div className={`px-2 py-1 rounded text-xs ${(s.active ?? true) ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>{(s.active ?? true) ? 'Ativo' : 'Inativo'}</div>
                  </div>
                  <div className="text-right text-sm">⋯</div>
                </div>
              ))}
            </div>
          ) : null)
        }
      </div>
      <NewProductModal open={modalOpen} onClose={()=>setModalOpen(false)} categories={categories} suppliers={suppliers} />
      <NewProductModal open={editModalOpen} onClose={()=>setEditModalOpen(false)} isEdit={true} product={editingProduct} categories={categories} suppliers={suppliers} />
      <NewCategoryModal open={catModalOpen} onClose={()=>setCatModalOpen(false)} />
      <NewCategoryModal open={catEditOpen} onClose={()=>setCatEditOpen(false)} isEdit={true} category={editingCategory} />
      <NewSupplierModal open={supplierModalOpen} onClose={()=>setSupplierModalOpen(false)} />
      <NewSupplierModal open={supplierEditOpen} onClose={()=>setSupplierEditOpen(false)} isEdit={true} supplier={editingSupplier} />
    </div>
  )
}