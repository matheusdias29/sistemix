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

export default function ProductsPage({ storeId }){
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
      {/* Tabs no topo como no print */}
      <div className="flex items-center gap-4 text-sm mb-3">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`px-2 py-1 ${tab===t.key ? 'text-green-700 font-medium border-b-2 border-green-600' : 'text-gray-600'}`}
            onClick={()=>setTab(t.key)}
          >{t.label}</button>
        ))}
      </div>

      {/* Toolbar de busca com botões à direita */}
      <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pesquisar..." className="px-3 py-2 border rounded" />
        <div className="flex gap-2 items-center">
          <button className="px-3 py-2 rounded border text-sm" onClick={()=>setShowFilters(x=>!x)}>Filtros</button>
          <button className="px-3 py-2 rounded border text-sm" onClick={()=>setViewMode(viewMode==='list'?'grid':'list')}>≡</button>
          <button className="px-3 py-2 rounded border text-sm">Opções</button>
          <button className="px-3 py-2 rounded bg-green-600 text-white text-sm" onClick={addNew}>+ Novo</button>
        </div>
      </div>

      {/* Barra fina de cabeçalho da listagem */}
      <div className="mt-2 px-3 py-2 rounded bg-gray-100 text-xs text-gray-600">
        {tab==='produto' && (
          <div className="grid grid-cols-[1.5rem_1fr_12rem_6rem_6rem_2rem]">
            <div></div>
            <div>Produto ({filtered.length})</div>
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
                <div key={p.id} className="grid grid-cols-[1.5rem_1fr_12rem_6rem_6rem_2rem] items-center px-4 py-3 border-b last:border-0">
                  <div>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={()=>toggleSelect(p.id)} />
                  </div>
                  <div className="text-sm">
                    <div className="font-medium cursor-pointer" onClick={()=>startEdit(p)}>{p.name}</div>
                    {(p.variations ?? 0) > 0 && (
                      <div className="text-xs text-gray-500">{p.variations} variações</div>
                    )}
                    </div>
                    <div className="text-right text-sm">{priceText}</div>
                    <div className={`text-right text-sm ${stock === 0 ? 'text-red-500' : ''}`}>{stock.toLocaleString('pt-BR')}</div>
                    <div className="text-right text-sm">
                      <div className={`px-2 py-1 rounded text-xs ${(p.active ?? true) ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>{(p.active ?? true) ? 'Ativo' : 'Inativo'}</div>
                    </div>
                    <div className="text-right text-sm">⋯</div>
                  </div>
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
      <NewProductModal open={modalOpen} onClose={()=>setModalOpen(false)} categories={categories} suppliers={suppliers} storeId={storeId} />
      <NewProductModal open={editModalOpen} onClose={()=>setEditModalOpen(false)} isEdit={true} product={editingProduct} categories={categories} suppliers={suppliers} storeId={storeId} />
      <NewCategoryModal open={catModalOpen} onClose={()=>setCatModalOpen(false)} storeId={storeId} />
      <NewCategoryModal open={catEditOpen} onClose={()=>setCatEditOpen(false)} isEdit={true} category={editingCategory} storeId={storeId} />
      <NewSupplierModal open={supplierModalOpen} onClose={()=>setSupplierModalOpen(false)} storeId={storeId} />
      <NewSupplierModal open={supplierEditOpen} onClose={()=>setSupplierEditOpen(false)} isEdit={true} supplier={editingSupplier} storeId={storeId} />
    </div>
  )
}