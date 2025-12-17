import React, { useState, useEffect, useMemo } from 'react'
import { listenProducts, updateProduct } from '../services/products'
import { listenCurrentCash, openCashRegister } from '../services/cash'
import { listenCategories } from '../services/categories'
import { listenClients } from '../services/clients'
import { addOrder } from '../services/orders'
import SelectClientModal from './SelectClientModal'
import NewClientModal from './NewClientModal'
import SelectVariationModal from './SelectVariationModal'
import { PaymentMethodsModal, PaymentAmountModal, AboveAmountConfirmModal, PaymentRemainingModal, AfterAboveAdjustedModal } from './PaymentModals'

export default function NewSaleModal({ open, onClose, storeId, user }) {
  // Data
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [clients, setClients] = useState([])

  // UI State
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('todos')
  const [selectedClient, setSelectedClient] = useState(null)
  const [clientSearch, setClientSearch] = useState('')
  const [cart, setCart] = useState([])
  const [payments, setPayments] = useState([])
  
  // Modals
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [clientSelectOpen, setClientSelectOpen] = useState(false)
  const [newClientOpen, setNewClientOpen] = useState(false)
  const [varSelectOpen, setVarSelectOpen] = useState(false)
  const [targetProduct, setTargetProduct] = useState(null)
  const [saving, setSaving] = useState(false)

  // Payment Flow State
  const [payMethodsOpen, setPayMethodsOpen] = useState(false)
  const [payAmountOpen, setPayAmountOpen] = useState(false)
  const [payAboveConfirmOpen, setPayAboveConfirmOpen] = useState(false)
  const [remainingInfoOpen, setRemainingInfoOpen] = useState(false)
  const [afterAboveAdjustedOpen, setAfterAboveAdjustedOpen] = useState(false)
  
  const [selectedPayMethod, setSelectedPayMethod] = useState(null)
  const [payAmountInput, setPayAmountInput] = useState('')
  const [payError, setPayError] = useState('')
  const [remainingSnapshot, setRemainingSnapshot] = useState(0)

  // Cashier State
  const [currentCash, setCurrentCash] = useState(null)
  const [loadingCash, setLoadingCash] = useState(true)
  const [openCashModalVisible, setOpenCashModalVisible] = useState(false)
  const [initialCashValue, setInitialCashValue] = useState('')
  const [openingCash, setOpeningCash] = useState(false)

  useEffect(() => {
    if (!open || !storeId) return
    const unsubP = listenProducts(setProducts, storeId)
    const unsubC = listenCategories(setCategories, storeId)
    const unsubCl = listenClients(setClients, storeId)
    const unsubCash = listenCurrentCash(storeId, (cash) => {
      setCurrentCash(cash)
      setLoadingCash(false)
    })
    return () => { unsubP(); unsubC(); unsubCl(); unsubCash() }
  }, [open, storeId])

  // Reset when opening
  useEffect(() => {
    if (open) {
      setCart([])
      setPayments([])
      setSelectedClient(null)
      setSearch('')
      setClientSearch('')
      setSelectedCategory('todos')
      setOptionsOpen(false)
      
      // Payment flow reset
      setPayMethodsOpen(false)
      setPayAmountOpen(false)
      setPayAboveConfirmOpen(false)
      setRemainingInfoOpen(false)
      setAfterAboveAdjustedOpen(false)
    }
  }, [open])

  // Filtering
  const filteredProducts = useMemo(() => {
    let list = products
    if (selectedCategory !== 'todos') {
      list = list.filter(p => p.categoryId === selectedCategory)
    }
    const q = search.toLowerCase()
    if (q) {
      list = list.filter(p => 
        (p.name || '').toLowerCase().includes(q) ||
        (p.code || '').toLowerCase().includes(q) ||
        (p.reference || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [products, selectedCategory, search])

  const filteredClients = useMemo(() => {
    if (!clientSearch) return []
    const q = clientSearch.toLowerCase()
    return clients.filter(c => (c.name || '').toLowerCase().includes(q))
  }, [clients, clientSearch])

  // Cart Actions
  const addToCart = (product) => {
    // Check for variations
    if (product.variations > 0 && product.variationsData && product.variationsData.length > 0) {
      setTargetProduct(product)
      setVarSelectOpen(true)
      return
    }

    // Check stock? For now just add.
    const existing = cart.find(item => item.product.id === product.id)
    if (existing) {
      setCart(cart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price } : item))
    } else {
      const price = product.salePrice || 0
      setCart([...cart, { product, quantity: 1, price, total: price }])
    }
  }

  const handleVariationSelect = (variation) => {
    setVarSelectOpen(false)
    if (!targetProduct) return

    const price = Number(variation.promoPrice ?? variation.salePrice ?? 0)
    const variationId = `${targetProduct.id}-${variation.name}`
    const variationName = `${targetProduct.name} - ${variation.name}`
    
    const variationProduct = {
      ...targetProduct,
      id: variationId,
      originalId: targetProduct.id,
      variationRawName: variation.name,
      name: variationName,
      salePrice: price
    }

    const existing = cart.find(item => item.product.id === variationId)
    if (existing) {
      setCart(cart.map(item => item.product.id === variationId ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price } : item))
    } else {
      setCart([...cart, { product: variationProduct, quantity: 1, price, total: price }])
    }
    setTargetProduct(null)
  }

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index))
  }

  const updateQuantity = (index, delta) => {
    setCart(cart.map((item, i) => {
      if (i === index) {
        const newQty = Math.max(1, item.quantity + delta)
        return { ...item, quantity: newQty, total: newQty * item.price }
      }
      return item
    }))
  }

  // Totals
  const subtotal = cart.reduce((acc, item) => acc + item.total, 0)
  const discount = 0 // Implement discount logic later if needed
  const total = subtotal - discount
  const totalPaid = payments.reduce((acc, p) => acc + Number(p.amount||0), 0)
  const remainingToPay = Math.max(0, total - totalPaid)

  // Open Cash Handler
  const handleOpenCash = async (e) => {
    e.preventDefault()
    if (!initialCashValue) return
    const val = parseFloat(initialCashValue.replace(',','.'))
    if (isNaN(val) || val < 0) {
      alert('Valor inválido')
      return
    }
    try {
      setOpeningCash(true)
      await openCashRegister({
        storeId,
        userId: user?.id,
        userName: user?.name,
        initialValue: val
      })
      setOpenCashModalVisible(false)
      setInitialCashValue('')
    } catch (err) {
      console.error(err)
      alert('Erro ao abrir caixa: ' + err.message)
    } finally {
      setOpeningCash(false)
    }
  }

  // Handlers
  const handleSave = async (status = 'Venda') => {
    if (cart.length === 0) {
      alert('Adicione produtos à venda.')
      return
    }
    
    // Validate payment for final sales
    if ((status === 'Venda' || status === 'Finalizado') && remainingToPay > 0.01) {
      alert(`Faltam R$ ${remainingToPay.toFixed(2)} para completar o pagamento.`)
      return
    }

    setSaving(true)
    try {
      const payload = {
        type: 'sale',
        client: selectedClient ? selectedClient.name : 'Consumidor Final',
        clientId: selectedClient ? selectedClient.id : null,
        attendant: user?.name || '',
        technician: null,
        dateIn: new Date(),
        products: cart.map(item => ({
          id: item.product.id,
          name: item.product.name,
          price: item.price,
          quantity: item.quantity,
          total: item.total
        })),
        totalProducts: subtotal,
        discount,
        total,
        valor: total,
        payments: payments.map(p => ({
          method: p.method,
          amount: p.amount,
          date: new Date()
        })),
        status,
        createdAt: new Date()
      }

      await addOrder(payload, storeId)

      // Update Stock
      if (status === 'Venda') {
        for (const item of cart) {
          const qty = item.quantity
          const pId = item.product.originalId || item.product.id
          const realProduct = products.find(p => p.id === pId)
          
          if (realProduct) {
            if (item.product.variationRawName) {
              // Variation
              if (realProduct.variationsData && Array.isArray(realProduct.variationsData)) {
                const newVars = realProduct.variationsData.map(v => {
                  if (v.name === item.product.variationRawName) {
                    return { ...v, stock: Number(v.stock || 0) - qty }
                  }
                  return v
                })
                const currentTotal = Number(realProduct.stock || 0)
                await updateProduct(pId, { 
                  variationsData: newVars,
                  stock: currentTotal - qty 
                })
              }
            } else {
              // Simple Product
              const currentStock = Number(realProduct.stock || 0)
              await updateProduct(pId, { stock: currentStock - qty })
            }
          }
        }
      }

      onClose()
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar venda.')
    } finally {
      setSaving(false)
    }
  }

  // Formatter
  const money = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  if (!open) return null

  // Loading state
  if (loadingCash) {
    return (
      <div className="fixed inset-0 bg-gray-100 z-[60] flex flex-col items-center justify-center">
        <div className="text-gray-500">Verificando caixa...</div>
      </div>
    )
  }

  // Cashier Closed State
  if (!currentCash) {
    return (
      <div className="fixed inset-0 bg-white z-[60] flex flex-col">
        {/* Header */}
        <div className="h-14 border-b flex items-center justify-between px-4 shadow-sm shrink-0">
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm font-medium">
            <span>&larr;</span> Voltar
          </button>
          <h1 className="text-lg font-semibold text-gray-800">Venda</h1>
          <div className="w-10"></div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-6">
            <span className="text-4xl text-green-600">$</span>
          </div>
          <h2 className="text-xl font-medium text-gray-800 mb-2">Ops... Seu caixa está fechado</h2>
          <button 
            onClick={() => setOpenCashModalVisible(true)}
            className="mt-4 px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-medium transition-colors shadow-sm"
          >
            Abrir Caixa
          </button>
        </div>

        {/* Open Cash Modal */}
        {openCashModalVisible && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-200">
              <div className="flex flex-col items-center mb-6">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-3">
                  <span className="text-3xl text-green-600">$</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-800">Abertura de caixa</h3>
              </div>

              <form onSubmit={handleOpenCash}>
                <div className="bg-gray-50 rounded-lg p-4 mb-6 border focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 transition-all">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>R$</span>
                    <span>Informe o valor inicial</span>
                  </div>
                  <input 
                    autoFocus
                    type="number" 
                    step="0.01" 
                    min="0"
                    className="w-full bg-transparent border-none p-0 text-right text-2xl font-semibold text-gray-800 focus:ring-0 placeholder-gray-300"
                    placeholder="0,00"
                    value={initialCashValue}
                    onChange={e => setInitialCashValue(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => setOpenCashModalVisible(false)}
                    className="flex-1 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    disabled={openingCash}
                  >
                    ✕ Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-2.5 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded shadow-sm transition-colors flex items-center justify-center gap-2"
                    disabled={openingCash}
                  >
                    {openingCash ? 'Abrindo...' : (
                      <>
                        <span>✔</span> Abrir Caixa
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gray-100 z-[60] flex flex-col">
      {/* 1. Header */}
      <div className="bg-white h-14 border-b flex items-center justify-between px-4 shadow-sm shrink-0">
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm font-medium">
          <span>&larr;</span> Voltar
        </button>
        <h1 className="text-lg font-semibold text-gray-800">Nova Venda</h1>
        <button onClick={onClose} className="text-gray-500 hover:text-red-500 text-xl font-bold">&times;</button>
      </div>

      {/* 2. Main Area */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Section: Products */}
        <div className="flex-1 flex flex-col border-r bg-gray-50 p-4 overflow-hidden">
          {/* Search */}
          <div className="bg-white p-2 rounded shadow-sm mb-4 flex gap-2">
            <span className="text-gray-400 p-2">🔍</span>
            <input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nome, código, referência..." 
              className="flex-1 outline-none text-sm"
              autoFocus
            />
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
            <button 
              onClick={() => setSelectedCategory('todos')}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedCategory === 'todos' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
            >
              Todos
            </button>
            {categories.map(c => (
              <button 
                key={c.id} 
                onClick={() => setSelectedCategory(c.id)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedCategory === c.id ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 content-start pr-1">
            {filteredProducts.map(p => (
              <div 
                key={p.id} 
                onClick={() => addToCart(p)}
                className="bg-white p-3 rounded border hover:border-green-500 cursor-pointer transition-all shadow-sm group flex flex-col h-24 justify-between"
              >
                <div className="text-sm font-medium text-gray-800 line-clamp-2 leading-tight">{p.name}</div>
                <div className="flex items-end justify-between mt-2">
                  <div className="text-xs text-gray-500">Estoque: <span className={p.stock > 0 ? 'text-gray-700' : 'text-red-500'}>{p.stock}</span></div>
                  <div className="font-bold text-green-600">
                    {(() => {
                      if (p.variations > 0 && p.variationsData && p.variationsData.length > 0) {
                        const priceMin = Number(p.priceMin ?? p.salePrice ?? 0)
                        const priceMax = Number(p.priceMax ?? p.salePrice ?? priceMin)
                        if (priceMin !== priceMax) {
                           return `De ${priceMin.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} a ${priceMax.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`
                        }
                      }
                      return money(p.salePrice)
                    })()}
                  </div>
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full text-center text-gray-500 mt-10">Nenhum produto encontrado.</div>
            )}
          </div>
        </div>

        {/* Right Section: Cart & Client */}
        <div className="w-full md:w-[400px] bg-white flex flex-col shadow-lg z-10">
          
          {/* Client Selection */}
          <div className="p-4 border-b bg-gray-50">
            <button 
              onClick={() => setClientSelectOpen(true)}
              className="w-full border rounded px-3 py-2 text-sm bg-white text-left flex justify-between items-center hover:border-green-500 transition-colors"
            >
              <span className={selectedClient ? "text-gray-900 font-medium" : "text-gray-400"}>
                {selectedClient ? selectedClient.name : "Selecionar Cliente (Opcional)"}
              </span>
              <span className="text-gray-400">🔍</span>
            </button>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start group border-b pb-3 last:border-0">
                <div className="flex-1">
                  <div className="text-sm text-gray-800 font-medium">{item.product.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{money(item.price)} un.</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="font-bold text-gray-800 text-sm">{money(item.total)}</div>
                  <div className="flex items-center border rounded bg-white">
                    <button onClick={() => updateQuantity(idx, -1)} className="px-2 py-0.5 text-gray-600 hover:bg-gray-100 text-sm">-</button>
                    <span className="px-2 text-xs font-medium w-8 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(idx, 1)} className="px-2 py-0.5 text-gray-600 hover:bg-gray-100 text-sm">+</button>
                  </div>
                </div>
                <button onClick={() => removeFromCart(idx)} className="ml-2 text-gray-400 hover:text-red-500 text-lg leading-none">&times;</button>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="text-center text-gray-400 mt-10 text-sm">Nenhum produto adicionado.</div>
            )}
          </div>

          {/* Footer Totals */}
          <div className="p-4 bg-gray-50 border-t space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Desconto</span>
                <span>-{money(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t">
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
            
            <div className="flex gap-2 mt-4 relative">
              <button 
                onClick={() => setOptionsOpen(!optionsOpen)}
                className="flex-1 py-3 border border-green-600 text-green-600 rounded font-medium hover:bg-green-50 transition-colors"
              >
                Opções
              </button>
              
              {/* Options Popup */}
              {optionsOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-48 bg-white shadow-xl rounded border z-30 overflow-hidden modal-card">
                  <button onClick={() => { /* TODO */ setOptionsOpen(false) }} className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm border-b text-gray-700">Adicionar observações</button>
                  <button onClick={() => handleSave('Pedido')} className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm border-b text-gray-700">Salvar pedido</button>
                  <button onClick={() => handleSave('Condicional')} className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm border-b text-gray-700">Salvar condicional</button>
                  <button onClick={() => handleSave('Orçamento')} className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm text-gray-700">Salvar orçamento</button>
                </div>
              )}

              <button 
                onClick={() => setPayMethodsOpen(true)}
                disabled={cart.length === 0}
                className="flex-[2] py-3 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm flex flex-col items-center justify-center leading-tight"
              >
                <span>Pagar</span>
                <span className="text-xs opacity-90">{remainingToPay > 0 ? `Restante: ${money(remainingToPay)}` : 'Pago'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Client Modal */}
      <SelectClientModal 
        open={clientSelectOpen} 
        onClose={() => setClientSelectOpen(false)} 
        clients={clients} 
        onChoose={(c) => {
          setSelectedClient(c)
          setClientSelectOpen(false)
        }}
        onNew={() => {
          setClientSelectOpen(false)
          setNewClientOpen(true)
        }}
      />
      
      <NewClientModal open={newClientOpen} onClose={() => setNewClientOpen(false)} storeId={storeId} />

      <SelectVariationModal
        open={varSelectOpen}
        onClose={() => {
          setVarSelectOpen(false)
          setTargetProduct(null)
        }}
        product={targetProduct}
        onChoose={handleVariationSelect}
      />

      {/* Payment Modals Flow */}
      {payMethodsOpen && (
        <PaymentMethodsModal
          open={payMethodsOpen}
          onClose={()=>setPayMethodsOpen(false)}
          remaining={remainingToPay}
          payments={payments}
          onRemovePayment={(idx)=>setPayments(prev=>prev.filter((_,i)=>i!==idx))}
          onChooseMethod={(m)=>{
            setSelectedPayMethod(m)
            setPayAmountInput(String(remainingToPay))
            setPayError('')
            setPayAmountOpen(true)
          }}
          onConfirm={()=>{
            setPayMethodsOpen(false)
            if(remainingToPay <= 0.01) {
              handleSave('Venda')
            }
          }}
        />
      )}
      {payAmountOpen && (
        <PaymentAmountModal
          open={payAmountOpen}
          onClose={()=>setPayAmountOpen(false)}
          method={selectedPayMethod}
          remaining={remainingToPay}
          amount={payAmountInput}
          setAmount={setPayAmountInput}
          error={payError}
          setError={setPayError}
          onConfirm={()=>{
            const amt = parseFloat(payAmountInput)||0
            if(!selectedPayMethod) return
            if(selectedPayMethod.code === 'cash'){
              const applied = Math.min(amt, remainingToPay)
              const change = Math.max(amt - remainingToPay, 0)
              const newRemaining = Math.max(remainingToPay - applied, 0)
              setPayments(prev=>[...prev, { method: selectedPayMethod.label, methodCode: selectedPayMethod.code, amount: applied, change }])
              setPayAmountOpen(false)
              setRemainingSnapshot(newRemaining)
              if(newRemaining > 0){ setRemainingInfoOpen(true) }
            } else {
              if(amt > remainingToPay){
                setPayAmountOpen(false)
                setPayAboveConfirmOpen(true)
                return
              }
              const newRemaining = Math.max(remainingToPay - amt, 0)
              setPayments(prev=>[...prev, { method: selectedPayMethod.label, methodCode: selectedPayMethod.code, amount: amt }])
              setPayAmountOpen(false)
              setRemainingSnapshot(newRemaining)
              if(newRemaining > 0){ setRemainingInfoOpen(true) }
            }
          }}
        />
      )}
      {payAboveConfirmOpen && (
        <AboveAmountConfirmModal
          open={payAboveConfirmOpen}
          amount={parseFloat(payAmountInput)||0}
          remaining={remainingToPay}
          method={selectedPayMethod}
          onCancel={()=>{ setPayAboveConfirmOpen(false); setPayAmountOpen(true) }}
          onConfirm={()=>{
            const amt = parseFloat(payAmountInput)||0
            const applied = Math.min(amt, remainingToPay)
            const newRemaining = Math.max(remainingToPay - applied, 0)
            setPayments(prev=>[...prev, { method: selectedPayMethod?.label, methodCode: selectedPayMethod?.code, amount: applied }])
            setPayAboveConfirmOpen(false)
            setAfterAboveAdjustedOpen(true)
            setRemainingSnapshot(newRemaining)
            if(newRemaining > 0){ setRemainingInfoOpen(true) }
          }}
        />
      )}
      {remainingInfoOpen && (
        <PaymentRemainingModal
          open={remainingInfoOpen}
          remaining={remainingSnapshot}
          onClose={()=>setRemainingInfoOpen(false)}
          onAddMore={()=>{ setRemainingInfoOpen(false); setPayMethodsOpen(true) }}
        />
      )}
      {afterAboveAdjustedOpen && (
        <AfterAboveAdjustedModal
          open={afterAboveAdjustedOpen}
          method={selectedPayMethod}
          remaining={remainingSnapshot}
          onClose={()=>setAfterAboveAdjustedOpen(false)}
        />
      )}
    </div>
  )
}
