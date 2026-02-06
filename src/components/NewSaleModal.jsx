import React, { useState, useEffect, useMemo } from 'react'
import { listenProducts, updateProduct } from '../services/products'
import { listenCurrentCash, openCashRegister } from '../services/cash'
import { listenCategories } from '../services/categories'
import { listenClients } from '../services/clients'
import { addOrder, updateOrder } from '../services/orders'
import { recordStockMovement } from '../services/stockMovements'
import { listenFees, listenStore } from '../services/stores'
import SelectClientModal from './SelectClientModal'
import NewClientModal from './NewClientModal'
import SelectVariationModal from './SelectVariationModal'
import EditCartItemModal from './EditCartItemModal'
import { PaymentMethodsModal, PaymentAmountModal, AboveAmountConfirmModal, PaymentRemainingModal, AfterAboveAdjustedModal } from './PaymentModals'

export default function NewSaleModal({ open, onClose, storeId, user, isEdit = false, sale = null }) {

  const isOwner = !user?.memberId
  const perms = user?.permissions || {}


  // Data
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [clients, setClients] = useState([])
  const [store, setStore] = useState(null)

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
  const [editItemModalOpen, setEditItemModalOpen] = useState(false)
  const [editingItemIndex, setEditingItemIndex] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [notesText, setNotesText] = useState('')
  const [feesModalOpen, setFeesModalOpen] = useState(false)
  const [discountModalOpen, setDiscountModalOpen] = useState(false)
  const [addValueModalOpen, setAddValueModalOpen] = useState(false)
  const [addValueInput, setAddValueInput] = useState('')
  const [availableFees, setAvailableFees] = useState([])
  const [appliedFees, setAppliedFees] = useState([]) // [{id,name,type,value}]
  const [discount, setDiscount] = useState({ type: null, value: 0 }) // {type:'fixed'|'percent'|null, value:number}

  // Payment Flow State
  const [payMethodsOpen, setPayMethodsOpen] = useState(false)
  const [payAmountOpen, setPayAmountOpen] = useState(false)
  const [payAboveConfirmOpen, setPayAboveConfirmOpen] = useState(false)
  const [remainingInfoOpen, setRemainingInfoOpen] = useState(false)
  const [afterAboveAdjustedOpen, setAfterAboveAdjustedOpen] = useState(false)
  const [chooseClientTypeOpen, setChooseClientTypeOpen] = useState(false)
  
  const [selectedPayMethod, setSelectedPayMethod] = useState(null)
  const [payAmountInput, setPayAmountInput] = useState('')
  const [payError, setPayError] = useState('')
  const [remainingSnapshot, setRemainingSnapshot] = useState(0)

  // Alert Modal State
  const [alertModalOpen, setAlertModalOpen] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')

  const showAlert = (msg) => {
    setAlertMessage(msg)
    setAlertModalOpen(true)
  }

  const usesSharedStockForVariation = (product, variationName) => {
    if (!product || !product.variationsData || !Array.isArray(product.variationsData)) return false
    const vars = product.variationsData
    const index = vars.findIndex(v => v.name === variationName)
    if (index <= 0 || index >= 4) return false
    const base = vars[0]
    const baseStock = Number((base && (base.stock ?? base.stockInitial)) ?? 0)
    const ownVar = vars[index]
    const ownStock = Number((ownVar && (ownVar.stock ?? ownVar.stockInitial)) ?? 0)
    return ownStock === 0 && baseStock > 0
  }

  const getVariationEffectiveStock = (product, variationName) => {
    if (!product || !product.variationsData || !Array.isArray(product.variationsData)) return 0
    const vars = product.variationsData
    const index = vars.findIndex(v => v.name === variationName)
    if (index === -1) {
      const base = vars[0]
      return Number((base && (base.stock ?? base.stockInitial)) ?? 0)
    }
    const ownVar = vars[index]
    const ownStock = Number((ownVar && (ownVar.stock ?? ownVar.stockInitial)) ?? 0)
    if (usesSharedStockForVariation(product, variationName)) {
      const base = vars[0]
      return Number((base && (base.stock ?? base.stockInitial)) ?? 0)
    }
    return ownStock
  }

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
    const unsubFees = listenFees(storeId, (rows) => {
      setAvailableFees(rows.filter(r => r.active))
    })
    const unsubCash = listenCurrentCash(storeId, (cash) => {
      setCurrentCash(cash)
      setLoadingCash(false)
    })
    return () => { unsubP(); unsubC(); unsubCl(); unsubFees(); unsubCash() }
  }, [open, storeId])

  // Reset when opening
  useEffect(() => {
    if (storeId) {
      const unsub = listenStore(storeId, (data) => setStore(data))
      return () => unsub()
    }
  }, [storeId])

  useEffect(() => {
    if (open) {
      if (!isEdit) {
        setCart([])
        setPayments([])
        setSelectedClient(null)
        setNotesText('')
        setAppliedFees([])
        setDiscount({ type: null, value: 0 })
      } else if (sale) {
        const initialCart = Array.isArray(sale.products) ? sale.products.map(p => ({
          product: { id: p.id, name: p.name, salePrice: p.price },
          quantity: Number(p.quantity || 1),
          price: Number(p.price || 0),
          total: Number(p.total || (Number(p.price || 0) * Number(p.quantity || 1)))
        })) : []
        setCart(initialCart)
        setPayments(Array.isArray(sale.payments) ? sale.payments.map(p => ({ method: p.method, methodCode: p.methodCode, amount: Number(p.amount || 0) })) : [])
        setSelectedClient(sale.clientId || sale.client ? { id: sale.clientId || null, name: sale.client || 'Consumidor Final' } : null)
        setNotesText(sale.receiptNotes || '')
        setAppliedFees(Array.isArray(sale.feesApplied) ? sale.feesApplied : [])
        setDiscount(sale.discount && (sale.discount.type === 'fixed' || sale.discount.type === 'percent') ? sale.discount : { type: null, value: 0 })
      }
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
    // Check stock globally first (matches what is displayed in the card)
    const currentStock = Number(product.stock || 0)
    if (currentStock <= 0) {
      showAlert('Produto com estoque zerado. Não é possível realizar a venda.')
      return
    }

    // Check for variations
    if (product.variations > 0 && product.variationsData && product.variationsData.length > 0) {
      setTargetProduct(product)
      setVarSelectOpen(true)
      return
    }

    // Check stock for existing item
    const existing = cart.find(item => item.product.id === product.id)
    if (existing) {
      if (existing.quantity >= currentStock) {
        showAlert('Estoque insuficiente para adicionar mais unidades.')
        return
      }
      setCart(cart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price } : item))
    } else {
      const price = product.salePrice || 0
      setCart([...cart, { product, quantity: 1, price, total: price }])
    }
  }

  const handleVariationSelect = (variation) => {
    setVarSelectOpen(false)
    if (!targetProduct) return

    const currentStock = getVariationEffectiveStock(targetProduct, variation.name)
    if (currentStock <= 0) {
      showAlert('Variação com estoque zerado. Não é possível realizar a venda.')
      setTargetProduct(null)
      return
    }

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
      if (existing.quantity >= currentStock) {
        showAlert('Estoque insuficiente para adicionar mais unidades.')
        setTargetProduct(null)
        return
      }
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
    if (delta > 0) {
      const item = cart[index]
      const pId = item.product.originalId || item.product.id
      const realProduct = products.find(p => p.id === pId)
      
      if (realProduct) {
        let maxStock = 0
        if (item.product.variationRawName) {
           maxStock = getVariationEffectiveStock(realProduct, item.product.variationRawName)
        } else {
           maxStock = Number(realProduct.stock || 0)
        }
        
        if (item.quantity + delta > maxStock) {
            alert('Estoque insuficiente para adicionar mais unidades.')
            return 
        }
      }
    }

    setCart(cart.map((item, i) => {
      if (i === index) {
        const newQty = Math.max(1, item.quantity + delta)
        return { ...item, quantity: newQty, total: newQty * item.price }
      }
      return item
    }))
  }

  const handleUpdateCartItem = (quantity, price, discountPercent = 0, discountValue = 0) => {
    if (editingItemIndex === null) return

    // Validate stock if increasing quantity
    const index = editingItemIndex
    const item = cart[index]
    const delta = quantity - item.quantity

    if (delta > 0) {
      const pId = item.product.originalId || item.product.id
      const realProduct = products.find(p => p.id === pId)
      
      if (realProduct) {
        let maxStock = 0
        if (item.product.variationRawName) {
           maxStock = getVariationEffectiveStock(realProduct, item.product.variationRawName)
        } else {
           maxStock = Number(realProduct.stock || 0)
        }
        
        if (quantity > maxStock) {
            alert('Estoque insuficiente para essa quantidade.')
            return 
        }
      }
    }

    setCart(cart.map((item, i) => {
      if (i === index) {
        return { 
            ...item, 
            quantity, 
            price, 
            discountPercent, 
            discountValue,
            total: (price - discountValue) * quantity 
        }
      }
      return item
    }))
    setEditItemModalOpen(false)
    setEditingItemIndex(null)
  }

  const handleEditItemClick = (index) => {
    setEditingItemIndex(index)
    setEditItemModalOpen(true)
  }

  // Totals
  const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100
  const subtotal = round2(cart.reduce((acc, item) => acc + item.total, 0))
  const feesTotal = round2(appliedFees.reduce((acc, f) => {
    if (f.type === 'percent') return acc + (subtotal * (Number(f.value || 0) / 100))
    return acc + Number(f.value || 0)
  }, 0))
  const discountAmount = (() => {
    if (discount.type === 'percent') return round2(subtotal * (Number(discount.value || 0) / 100))
    if (discount.type === 'fixed') return round2(Number(discount.value || 0))
    return 0
  })()
  const total = round2(subtotal + feesTotal - discountAmount)
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
      // Calculate Commission
      const commSettings = store?.commissionsSettings || {}
      const salesAttendantPercent = Number(commSettings.salesAttendantPercent || 0)
      const commissionValue = salesAttendantPercent > 0 ? (total * (salesAttendantPercent / 100)) : 0

      const payload = {
        type: 'sale',
        client: selectedClient ? selectedClient.name : 'Consumidor Final',
        clientId: selectedClient ? selectedClient.id : null,
        attendant: user?.name || '',
        technician: null,
        dateIn: new Date(),
        commissions: {
          salesAttendantPercent,
          salesAttendantValue: commissionValue
        },
        products: cart.map(item => ({
          id: item.product.originalId || item.product.id,
          name: item.product.name,
          variationName: item.product.variationRawName || null,
          price: item.price,
          quantity: item.quantity,
          total: item.total
        })),
        totalProducts: subtotal,
        feesApplied: appliedFees,
        discount,
        total,
        valor: total,
        receiptNotes: notesText,
        payments: payments.map(p => ({
          method: p.method,
          amount: p.amount,
          date: new Date()
        })),
        status,
        createdAt: new Date()
      }

      let orderId = isEdit ? sale?.id : null

      if (isEdit && sale?.id) {
        const partial = { 
          type: 'sale',
          client: payload.client,
          clientId: payload.clientId,
          attendant: payload.attendant,
          products: payload.products,
          totalProducts: payload.totalProducts,
          discount: payload.discount,
          total: payload.total,
          valor: payload.valor,
          receiptNotes: payload.receiptNotes,
          payments: payload.payments,
          status: status
        }
        await updateOrder(sale.id, partial)
      } else {
        orderId = await addOrder(payload, storeId)
      }

      if (!isEdit && (status === 'Venda' || status === 'Pedido' || status === 'Cliente Final' || status === 'Cliente Lojista')) {
        for (const item of cart) {
          const qty = item.quantity
          const pId = item.product.originalId || item.product.id
          const realProduct = products.find(p => p.id === pId)
          
          if (realProduct) {
            let variationId = null
            let variationName = null

            if (item.product.variationRawName) {
              // Variation
              if (realProduct.variationsData && Array.isArray(realProduct.variationsData)) {
                const targetVar = realProduct.variationsData.find(v => v.name === item.product.variationRawName)
                if (targetVar) {
                   variationId = targetVar.id || null
                   variationName = targetVar.name || targetVar.label || item.product.variationRawName
                }

                const vars = realProduct.variationsData
                const index = vars.findIndex(v => v.name === item.product.variationRawName)
                let newVars = vars
                if (usesSharedStockForVariation(realProduct, item.product.variationRawName)) {
                  newVars = vars.map((v, i) => {
                    if (i === 0) {
                      return { ...v, stock: Number(v.stock || 0) - qty }
                    }
                    return v
                  })
                } else {
                  newVars = vars.map(v => {
                    if (v.name === item.product.variationRawName) {
                      return { ...v, stock: Number(v.stock || 0) - qty }
                    }
                    return v
                  })
                }
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

            // Log Movement
            await recordStockMovement({
              productId: pId,
              productName: realProduct.name,
              variationId,
              variationName,
              type: 'out',
              quantity: qty,
              reason: 'sale',
              referenceId: orderId,
              description: `Venda para ${payload.client}`,
              userId: user?.id,
              userName: user?.name
            })
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
      <div className="fixed inset-0 bg-gray-100 dark:bg-gray-900 z-[60] flex flex-col items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Verificando caixa...</div>
      </div>
    )
  }

  // Cashier Closed State
  if (!currentCash) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-gray-900 z-[60] flex flex-col">
        {/* Header */}
        <div className="h-14 border-b dark:border-gray-700 flex items-center justify-between px-4 shadow-sm shrink-0 bg-white dark:bg-gray-900">
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1 text-sm font-medium">
            <span>&larr;</span> Voltar
          </button>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Venda</h1>
          <div className="w-10"></div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6">
            <span className="text-4xl text-green-600 dark:text-green-500">$</span>
          </div>
          <h2 className="text-xl font-medium text-gray-800 dark:text-gray-100 mb-2">Ops... Seu caixa está fechado</h2>
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-200">
              <div className="flex flex-col items-center mb-6">
                <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-3">
                  <span className="text-3xl text-green-600 dark:text-green-500">$</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Abertura de caixa</h3>
              </div>

              <form onSubmit={handleOpenCash}>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6 border dark:border-gray-600 focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 transition-all">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>R$</span>
                    <span>Informe o valor inicial</span>
                  </div>
                  <input 
                    autoFocus
                    type="number" 
                    step="0.01" 
                    min="0"
                    className="w-full bg-transparent border-none p-0 text-right text-2xl font-semibold text-gray-800 dark:text-white focus:ring-0 placeholder-gray-300 dark:placeholder-gray-600"
                    placeholder="0,00"
                    value={initialCashValue}
                    onChange={e => setInitialCashValue(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => setOpenCashModalVisible(false)}
                    className="flex-1 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
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
    <div className="fixed inset-0 bg-gray-100 dark:bg-gray-900 z-[60] flex flex-col">
      {/* 1. Header */}
      <div className="bg-white dark:bg-gray-800 h-14 border-b dark:border-gray-700 flex items-center justify-between px-4 shadow-sm shrink-0">
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1 text-sm font-medium">
          <span>&larr;</span> Voltar
        </button>
        <h1 className="text-lg font-semibold text-gray-800 dark:text-white">Nova Venda</h1>
        <button onClick={onClose} className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 text-xl font-bold">&times;</button>
      </div>

      {/* 2. Main Area */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Section: Products */}
        <div className="flex-1 flex flex-col border-r dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 overflow-hidden">
          {/* Search */}
          <div className="bg-white dark:bg-gray-800 p-2 rounded shadow-sm mb-4 flex gap-2 border dark:border-gray-700">
            <span className="text-gray-400 p-2">🔍</span>
            <input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Nome, código, referência..." 
              className="flex-1 outline-none text-sm bg-transparent dark:text-white dark:placeholder-gray-500"
              autoFocus
            />
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
            <button 
              onClick={() => setSelectedCategory('todos')}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedCategory === 'todos' ? 'bg-green-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              Todos
            </button>
            {categories.map(c => (
              <button 
                key={c.id} 
                onClick={() => setSelectedCategory(c.id)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedCategory === c.id ? 'bg-green-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
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
                className="bg-white dark:bg-gray-800 p-3 rounded border dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 cursor-pointer transition-all shadow-sm group flex flex-col h-24 justify-between"
              >
                <div className="text-sm font-medium text-gray-800 dark:text-gray-100 line-clamp-2 leading-tight">{p.name}</div>
                <div className="flex items-end justify-between mt-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Estoque: <span className={p.stock > 0 ? 'text-gray-700 dark:text-gray-300' : 'text-red-500'}>{p.stock}</span></div>
                  <div className="font-bold text-green-600 dark:text-green-400">
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
              <div className="col-span-full text-center text-gray-500 dark:text-gray-400 mt-10">Nenhum produto encontrado.</div>
            )}
          </div>
        </div>

        {/* Right Section: Cart & Client */}
        <div className="w-full md:w-[400px] bg-white dark:bg-gray-800 flex flex-col shadow-lg z-10 border-l dark:border-gray-700">
          
          {/* Client Selection */}
          <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <button 
              onClick={() => setClientSelectOpen(true)}
              className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-left flex justify-between items-center hover:border-green-500 dark:hover:border-green-500 transition-colors"
            >
              <span className={selectedClient ? "text-gray-900 dark:text-white font-medium" : "text-gray-400 dark:text-gray-500"}>
                {selectedClient ? selectedClient.name : "Selecionar Cliente (Opcional)"}
              </span>
              <span className="text-gray-400">🔍</span>
            </button>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start group border-b dark:border-gray-700 pb-3 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded p-1">
                <div className="flex-1 cursor-pointer" onClick={() => handleEditItemClick(idx)}>
                  <div className="text-sm text-gray-800 dark:text-gray-200 font-medium">{item.product.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{money(item.price)} un.</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="font-bold text-gray-800 dark:text-white text-sm cursor-pointer" onClick={() => handleEditItemClick(idx)}>{money(item.total)}</div>
                  <div className="flex items-center border dark:border-gray-600 rounded bg-white dark:bg-gray-700">
                    <button onClick={() => updateQuantity(idx, -1)} className="px-2 py-0.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 text-sm">-</button>
                    <span className="px-2 text-xs font-medium w-8 text-center text-gray-800 dark:text-gray-200 cursor-pointer" onClick={() => handleEditItemClick(idx)}>{item.quantity}</span>
                    <button onClick={() => updateQuantity(idx, 1)} className="px-2 py-0.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 text-sm">+</button>
                  </div>
                </div>
                <button onClick={() => removeFromCart(idx)} className="ml-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-lg leading-none">&times;</button>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="text-center text-gray-400 dark:text-gray-500 mt-10 text-sm">Nenhum produto adicionado.</div>
            )}
          </div>

          {/* Footer Totals */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700 space-y-2">
            {notesText && (
              <div className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <span>💬</span>
                <button
                  onClick={() => setNotesOpen(true)}
                  className="underline hover:text-gray-900 dark:hover:text-white"
                  title="Editar observações"
                >
                  {notesText}
                </button>
              </div>
            )}
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          {appliedFees.length > 0 && (
            <div className="space-y-1">
              {appliedFees.map((f, idx) => (
                <div key={idx} className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                  <span className="flex items-center gap-2">
                    <span>📎</span>{f.name} {f.type==='percent' ? `(${Number(f.value)}%)` : ''}
                  </span>
                  <span>{money(f.type==='percent' ? round2(subtotal * (Number(f.value||0)/100)) : Number(f.value||0))}</span>
                  <button className="ml-2 text-xs text-red-600 dark:text-red-400" onClick={()=>setAppliedFees(appliedFees.filter((_,i)=>i!==idx))}>remover</button>
                </div>
              ))}
              <div className="flex justify-between text-sm text-gray-800 dark:text-gray-200">
                <span>Total de taxas</span>
                <span>{money(feesTotal)}</span>
              </div>
            </div>
          )}
          {discount.type && (
            <div className="flex justify-between text-sm text-green-700 dark:text-green-400">
              <span className="flex items-center gap-2">
                <span>🏷️</span>Desconto {discount.type==='percent' ? `(${Number(discount.value)}%)` : ''}
                {(isOwner || perms.sales?.discount) && (
                  <button className="text-xs underline" onClick={()=>setDiscountModalOpen(true)}>editar</button>
                )}
                <button className="text-xs text-red-600 dark:text-red-400 ml-2" onClick={()=>setDiscount({ type:null, value:0 })}>remover</button>
              </span>
              <span>-{money(discountAmount)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
              <span>Desconto</span>
              <span>-{money(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-2 border-t dark:border-gray-700">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>
          <div className="flex justify-end gap-6 text-sm text-gray-600 dark:text-gray-400 mt-2">
            {(isOwner || perms.sales?.fees) && (
            <button className="flex items-center gap-2 hover:text-gray-800 dark:hover:text-gray-200" onClick={()=>setFeesModalOpen(true)}>
              <span>🏷️</span>Adicionar Taxa
            </button>
            )}
            {(isOwner || perms.sales?.discount) && (
            <button className="flex items-center gap-2 hover:text-gray-800 dark:hover:text-gray-200" onClick={()=>setDiscountModalOpen(true)}>
              <span>🏷️</span>Adicionar Desconto
            </button>
            )}
            {(isOwner || perms.sales?.fees) && (
            <button className="flex items-center gap-2 hover:text-gray-800 dark:hover:text-gray-200" onClick={()=>setAddValueModalOpen(true)}>
              <span>➕</span>Adicionar
            </button>
            )}
          </div>
            
            <div className="flex gap-2 mt-4 relative">
              <button 
                onClick={() => setOptionsOpen(!optionsOpen)}
                className="flex-1 py-3 border border-green-600 text-green-600 dark:text-green-400 dark:border-green-400 rounded font-medium hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
              >
                Opções
              </button>
              
              {/* Options Popup */}
              {optionsOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-gray-800 shadow-xl rounded border dark:border-gray-700 z-30 overflow-hidden modal-card">
                  <button onClick={() => { setOptionsOpen(false); setNotesOpen(true) }} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm border-b dark:border-gray-700 text-gray-700 dark:text-gray-200">Adicionar observações</button>
                  {(isOwner || perms.sales?.finalize || (isEdit && perms.sales?.edit)) && (
                    <>
                    <button onClick={() => handleSave('Pedido')} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm border-b dark:border-gray-700 text-gray-700 dark:text-gray-200">Salvar pedido</button>
                    <button onClick={() => handleSave('Condicional')} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm border-b dark:border-gray-700 text-gray-700 dark:text-gray-200">Salvar condicional</button>
                    <button onClick={() => handleSave('Orçamento')} className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-200">Salvar orçamento</button>
                    </>
                  )}
                </div>
              )}

              {(isOwner || perms.sales?.finalize || (isEdit && perms.sales?.edit)) && (
              <button 
                onClick={() => setPayMethodsOpen(true)}
                disabled={cart.length === 0}
                className="flex-[2] py-3 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm flex flex-col items-center justify-center leading-tight"
              >
                <span>{isEdit ? 'Salvar' : 'Faturar'}</span>
                <span className="text-xs opacity-90">{remainingToPay > 0 ? `Restante: ${money(remainingToPay)}` : 'Pago'}</span>
              </button>
              )}
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
        onNew={(isOwner || perms.clients?.create) ? () => {
          setClientSelectOpen(false)
          setNewClientOpen(true)
        } : undefined}
      />
      
      <NewClientModal open={newClientOpen} onClose={() => setNewClientOpen(false)} storeId={storeId} user={user} />

      <SelectVariationModal
        open={varSelectOpen}
        onClose={() => {
          setVarSelectOpen(false)
          setTargetProduct(null)
        }}
        product={targetProduct}
        onChoose={handleVariationSelect}
        hideFifth
      />

      {notesOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b dark:border-gray-700">
              <div className="text-lg font-semibold text-gray-800 dark:text-white text-center">Observações</div>
            </div>
            <div className="p-4">
              <textarea
                value={notesText}
                onChange={e => setNotesText(e.target.value)}
                placeholder="digite suas observações..."
                className="w-full h-32 border dark:border-gray-600 rounded px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 dark:text-gray-100 focus:bg-white dark:focus:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
            <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center gap-3">
              <button
                onClick={() => setNotesOpen(false)}
                className="flex-1 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm font-medium"
              >
                × Cancelar
              </button>
              <button
                onClick={() => setNotesOpen(false)}
                className="flex-1 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      {feesModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b dark:border-gray-700">
              <div className="text-lg font-semibold text-gray-800 dark:text-white text-center">Adicionar taxas</div>
            </div>
            <div className="p-4 space-y-2">
              {availableFees.map(f => {
                const selected = appliedFees.some(af => af.id === f.id)
                return (
                  <button
                    key={f.id}
                    onClick={() => {
                      if (selected) {
                        setAppliedFees(prev => prev.filter(af => af.id !== f.id))
                      } else {
                        setAppliedFees(prev => [...prev, { id: f.id, name: f.name, type: f.type, value: Number(f.value||0) }])
                      }
                    }}
                    className={`w-full px-4 py-3 rounded text-sm flex items-center justify-between ${selected ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                  >
                    <span className="truncate">{f.name}</span>
                    <span className="shrink-0">{f.type==='percent' ? `${Number(f.value||0)}%` : money(f.value)}</span>
                  </button>
                )
              })}
              {availableFees.length === 0 && (
                <div className="text-sm text-gray-500 dark:text-gray-400">Nenhuma taxa configurada (Configurações → Taxas adicionais).</div>
              )}
            </div>
            <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center gap-3">
              <button
                onClick={() => setFeesModalOpen(false)}
                className="flex-1 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm font-medium"
              >
                ← Voltar
              </button>
              <button
                onClick={() => setFeesModalOpen(false)}
                className="flex-1 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
      {discountModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-lg shadow-xl overflow-hidden modal-card">
            <div className="p-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Desconto geral</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex justify-between items-center text-lg font-bold">
                <span className="text-gray-600 dark:text-gray-400">Total</span>
                <span className="text-green-600 dark:text-green-400">{money(subtotal + feesTotal)}</span>
              </div>
              
              {(() => {
                 const totalBase = subtotal + feesTotal
                 const fixedValue = discount.type === 'fixed' 
                   ? discount.value 
                   : (totalBase * discount.value / 100)
                 
                 const percentValue = discount.type === 'percent'
                   ? discount.value
                   : (totalBase > 0 ? (discount.value / totalBase * 100) : 0)

                 return (
                   <>
                    <div className="relative">
                      <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Desconto R$</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={discount.type === 'fixed' ? discount.value : (fixedValue ? round2(fixedValue) : '')}
                        onChange={e => {
                          const v = Math.max(0, Number(e.target.value))
                          setDiscount({ type: 'fixed', value: v })
                        }}
                        className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                        placeholder="0,00"
                      />
                    </div>
                    <div className="relative">
                      <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Desconto (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={discount.type === 'percent' ? discount.value : (percentValue ? round2(percentValue) : '')}
                        onChange={e => {
                          const v = Math.max(0, Math.min(100, Number(e.target.value)))
                          setDiscount({ type: 'percent', value: v })
                        }}
                        className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                        placeholder="0,00"
                      />
                    </div>
                   </>
                 )
              })()}

              <div className="grid grid-cols-4 gap-3">
                {[5,10,15,20].map(p => (
                  <button
                    key={p}
                    onClick={()=>setDiscount({ type:'percent', value:p })}
                    className="px-3 py-2 rounded border dark:border-gray-600 text-sm hover:bg-green-50 dark:hover:bg-green-900/30 dark:text-gray-200"
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center gap-3">
              <button
                onClick={() => setDiscountModalOpen(false)}
                className="flex-1 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm font-medium"
              >
                × Cancelar
              </button>
              <button
                onClick={() => setDiscountModalOpen(false)}
                className="flex-1 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      {addValueModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-lg shadow-xl overflow-hidden modal-card">
            <div className="p-4 border-b dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Adicionar valor</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex justify-between items-center text-lg font-bold">
                <span className="text-gray-600 dark:text-gray-400">Total</span>
                <span className="text-green-600 dark:text-green-400">{money(subtotal + feesTotal)}</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border dark:border-gray-600 focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 transition-all">
                <label className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1 block">Valor a adicionar</label>
                <input 
                  type="number"
                  step="0.01"
                  min="0.01"
                  autoFocus
                  value={addValueInput}
                  onChange={e => setAddValueInput(e.target.value)}
                  className="w-full bg-transparent border-none p-0 text-right text-2xl font-bold text-gray-800 dark:text-white focus:ring-0 placeholder-gray-400 outline-none"
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center gap-3">
              <button
                onClick={() => { setAddValueModalOpen(false); setAddValueInput('') }}
                className="flex-1 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm font-medium"
              >
                × Cancelar
              </button>
              <button
                onClick={() => {
                  const val = parseFloat(String(addValueInput).replace(',','.'))
                  if (isNaN(val) || val <= 0) return
                  const id = `manual_add_${Date.now()}`
                  setAppliedFees(prev => [...prev, { id, name: 'Adição', type: 'fixed', value: val }])
                  setAddValueModalOpen(false)
                  setAddValueInput('')
                }}
                className="flex-1 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modals Flow */}
      {payMethodsOpen && (
        <PaymentMethodsModal
        storeId={storeId}
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
              setChooseClientTypeOpen(true)
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
              else { setChooseClientTypeOpen(true) }
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
              else { setChooseClientTypeOpen(true) }
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
            else { setChooseClientTypeOpen(true) }
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
      
      {alertModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm p-6 relative animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl text-red-500">⚠️</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Atenção</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">{alertMessage}</p>
              <button 
                onClick={() => setAlertModalOpen(false)}
                className="w-full py-2.5 bg-gray-800 dark:bg-gray-700 hover:bg-gray-900 dark:hover:bg-gray-600 text-white rounded font-medium transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {chooseClientTypeOpen && (
        <ChooseClientTypeModal
          open={chooseClientTypeOpen}
          onClose={() => setChooseClientTypeOpen(false)}
          onChoose={(status) => {
            setChooseClientTypeOpen(false)
            handleSave(status)
          }}
        />
      )}

      <EditCartItemModal
        open={editItemModalOpen}
        onClose={() => { setEditItemModalOpen(false); setEditingItemIndex(null) }}
        item={editingItemIndex !== null ? cart[editingItemIndex] : null}
        onSave={handleUpdateCartItem}
        onRemove={() => {
            if(editingItemIndex !== null) {
                removeFromCart(editingItemIndex)
                setEditItemModalOpen(false)
                setEditingItemIndex(null)
            }
        }}
        canChangePrice={isOwner || perms.sales?.changePrice}
        canDiscount={isOwner || perms.sales?.discount}
      />
    </div>
  )
}

function ChooseClientTypeModal({ open, onClose, onChoose }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm p-6 relative animate-in fade-in zoom-in duration-200">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 text-center">Tipo de Cliente</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">Selecione o tipo de cliente para finalizar a venda.</p>
        <div className="flex flex-col gap-3">
          <button 
            onClick={() => onChoose('Cliente Final')} 
            className="w-full py-3 bg-green-600 text-white rounded font-medium hover:bg-green-700 shadow-sm flex items-center justify-center gap-2"
          >
            <span>👤</span> Cliente Final
          </button>
          <button 
            onClick={() => onChoose('Cliente Lojista')} 
            className="w-full py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2"
          >
            <span>🏢</span> Lojista
          </button>
        </div>
        <button 
          onClick={onClose} 
          className="mt-4 w-full py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm hover:underline"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
