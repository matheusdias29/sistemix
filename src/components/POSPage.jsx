import React, { useState, useEffect, useMemo, useRef } from 'react'
import { listenCurrentCash, openCashRegister, closeCashRegister, getClosedCashRegisters, reopenCashRegister, addCashTransaction } from '../services/cash'
import { listenOrders } from '../services/orders'
import SaleDetailModal from './SaleDetailModal'
import CloseCashModal from './CloseCashModal'
import pixIcon from '../assets/pix.svg'

export default function POSPage({ storeId, user }){
  const [currentCash, setCurrentCash] = useState(null) // null = loading or not exists
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('atual')
  const [previousList, setPreviousList] = useState([])
  const [loadingPrev, setLoadingPrev] = useState(false)
  const [selectedPreviousCash, setSelectedPreviousCash] = useState(null)
  
  // Modal states
  const [openModalVisible, setOpenModalVisible] = useState(false)
  const [initialValue, setInitialValue] = useState('')
  const [opening, setOpening] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [closeModalOpen, setCloseModalOpen] = useState(false)
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false)
  const [withdrawalValues, setWithdrawalValues] = useState({})

  // Transaction Menu States
  const [showNewTransactionMenu, setShowNewTransactionMenu] = useState(false)
  const [transactionModalOpen, setTransactionModalOpen] = useState(false)
  const [transactionType, setTransactionType] = useState('add') // 'add' | 'remove' | 'expense'
  const menuRef = useRef(null)

  // Transaction Form States
  const [transDescription, setTransDescription] = useState('')
  const [transValue, setTransValue] = useState('')
  const [transSaving, setTransSaving] = useState(false)

  // Click outside to close menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowNewTransactionMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuRef]);

  // Listen to cash status
  useEffect(() => {
    const unsub = listenCurrentCash(storeId, (cash) => {
      setCurrentCash(cash)
      setLoading(false)
    })
    return () => unsub && unsub()
  }, [storeId])

  // Listen to orders (ALWAYS, to allow history view)
  useEffect(() => {
    if (!storeId) return
    const unsub = listenOrders((allOrders) => {
      setOrders(allOrders)
    }, storeId)
    return () => unsub && unsub()
  }, [storeId])

  // Load previous cash registers
  useEffect(() => {
    if (tab === 'anterior' && storeId) {
      setLoadingPrev(true)
      getClosedCashRegisters(storeId)
        .then(list => setPreviousList(list))
        .catch(err => console.error(err))
        .finally(() => setLoadingPrev(false))
    }
  }, [tab, storeId])

  const handleOpenCash = async (e) => {
    e.preventDefault()
    if (!initialValue) return
    
    // Validate positive
    const val = parseFloat(initialValue.replace(',','.'))
    if (isNaN(val) || val < 0) {
      alert('Valor inválido')
      return
    }

    try {
      setOpening(true)
      await openCashRegister({
        storeId,
        userId: user.id,
        userName: user.name,
        initialValue: val
      })
      setOpenModalVisible(false)
      setInitialValue('')
    } catch (err) {
      console.error(err)
      alert('Erro ao abrir caixa: ' + err.message)
    } finally {
      setOpening(false)
    }
  }

  const handleCloseCash = async (closingData) => {
    if(!currentCash) return
    try {
      await closeCashRegister(currentCash.id, {
        finalBalance: financials.cashBalance, // Manter compatibilidade
        sales: financials.sales,
        os: financials.os,
        totalIn: financials.totalIn,
        totalOut: financials.totalOut,
        moneyAdded: financials.moneyAdded,
        moneyRemoved: financials.moneyRemoved,
        ...closingData
      })
      setCloseModalOpen(false)
    } catch (err) {
      alert('Erro ao fechar caixa')
    }
  }

  const handleReopenCash = async () => {
    if (!selectedPreviousCash) return
    if (currentCash) {
      alert('Já existe um caixa aberto. Feche-o antes de reabrir outro.')
      return
    }
    
    if(!window.confirm(`Deseja reabrir o caixa #${selectedPreviousCash.number || ''}?`)) return

    try {
      await reopenCashRegister(selectedPreviousCash.id)
      // Reset state
      setSelectedPreviousCash(null)
      setTab('atual')
    } catch (err) {
      console.error(err)
      alert('Erro ao reabrir caixa')
    }
  }

  const handleSaveWithdrawal = async (e) => {
    e.preventDefault()
    if (!currentCash) return

    try {
      setTransSaving(true)
      
      const methods = financials?.methods || {}
      
      // Process each method with a value > 0
      for (const [method, valStr] of Object.entries(withdrawalValues)) {
        const val = parseFloat(valStr.replace(',','.'))
        if (!isNaN(val) && val > 0) {
           await addCashTransaction(currentCash.id, {
            description: 'Retirada de caixa',
            notes: transDescription,
            value: -val,
            type: 'remove',
            method: 'cash', // Although logically it might be Pix, the backend/model seems to track movements mostly as cash adjustments or we need a way to specify method label.
            // The system seems to use 'method' for internal code and 'methodLabel' for display in some places.
            // However, `addCashTransaction` uses `method: 'cash'` hardcoded in previous logic. 
            // If we want to reflect "Retirada de Pix", we should probably adjust the method.
            // But the user prompt shows "Retirada de caixa" generally.
            // Let's assume for now we mark them all as manual withdrawals. 
            // To make the summary correct ("Dinheiro", "Pix"), we need to store the method properly if the system supports it.
            // The `processCash` function groups by `methodLabel`.
            // But `addCashTransaction` in `cash.js` doesn't seem to take `methodLabel` explicitly unless we pass it.
            // Let's pass it.
            methodLabel: method,
            methodCode: method.toLowerCase() === 'dinheiro' ? 'cash' : 'other',
            date: new Date(),
            userId: user?.id,
            userName: user?.name
          })
        }
      }

      setWithdrawalModalOpen(false)
      setWithdrawalValues({})
      setTransDescription('')
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar retirada')
    } finally {
      setTransSaving(false)
    }
  }

  const handleSaveTransaction = async (e) => {
    e.preventDefault()
    if (!currentCash) return
    
    const val = parseFloat(transValue.replace(',','.'))
    if (isNaN(val) || val <= 0) {
      alert('Valor inválido')
      return
    }
    // Descrição fixa baseada no tipo (solicitação do usuário: "mostar no caixa com o nome de reforço de caixa")
    // O texto digitado entra como "notes" (detalhes)
    let title = ''
    if (transactionType === 'add') title = 'Reforço de caixa'
    else if (transactionType === 'expense') title = 'Despesa'
    else title = 'Sangria'

    let userNotes = transDescription.trim()

    try {
      setTransSaving(true)
      
      const isNegative = transactionType !== 'add'
      const finalValue = isNegative ? -val : val

      await addCashTransaction(currentCash.id, {
        description: title,
        notes: userNotes,
        value: finalValue,
        type: transactionType, // add, remove, expense
        method: 'cash', // Movimentação de caixa físico
        methodCode: 'cash',
        date: new Date(),
        userId: user?.id,
        userName: user?.name
      })

      setTransactionModalOpen(false)
      setTransDescription('')
      setTransValue('')
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar movimentação')
    } finally {
      setTransSaving(false)
    }
  }

  // Helpers de formatação
  const money = (v) => Number(v||0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const dateStr = (ts) => {
    if(!ts) return ''
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    const dias = ['dom','seg','ter','qua','qui','sex','sáb']
    return `${dias[d.getDay()]} - ${d.getDate()}/${d.getMonth()+1}`
  }

  const timeStr = (ts) => {
    if(!ts) return ''
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const { transactions, financials } = useMemo(() => {
    // Helper para processar dados de um caixa
    const processCash = (cash) => {
      const formatSaleNumber = (order) => {
         const isOS = order.type === 'service_order' || (order.status && order.status.includes('Os Finalizada'))
         const prefix = isOS ? 'O.S:' : 'PV:'
         if (order.number) {
           const digits = String(order.number).replace(/\D/g, '')
           const n = parseInt(digits, 10)
           return `${prefix}${String(n).padStart(4, '0')}`
         }
         return `${prefix}${String(order.id).slice(-4)}`
      }

      if (!cash) return { transactions: [], financials: { opening: 0, sales: 0, os: 0, cashBalance: 0, methods: {}, totalIn: 0, totalOut: 0, moneyAdded: 0 } }
  
      const openTime = cash.openedAt?.toDate ? cash.openedAt.toDate().getTime() : 0
      const closeTime = cash.closedAt?.toDate ? cash.closedAt.toDate().getTime() : (cash.status==='closed' ? Date.now() : Infinity)
      // Se fechado mas sem data, assumimos até agora para visualizar (fallback)
      
      const list = []
      
      // Abertura
      list.push({
        id: 'opening',
        description: 'Abertura de caixa',
        date: cash.openedAt,
        method: 'cash',
        methodLabel: 'Dinheiro',
        value: cash.initialValue,
        type: 'in',
        seller: cash.openedByName || '—'
      })
  
      let salesTotal = 0
      let osTotal = 0
      let totalIn = 0
      let totalOut = 0 // Expenses placeholder
      let moneyAdded = 0
      let moneyRemoved = 0
      
      const methods = {
        'Dinheiro': Number(cash.initialValue || 0)
      }
  
      // Movimentações manuais
      if (cash.transactions && Array.isArray(cash.transactions)) {
        cash.transactions.forEach(t => {
          // Filter by time range if necessary (though they belong to this cash doc)
          const tTime = t.date?.toDate ? t.date.toDate().getTime() : (new Date(t.date).getTime())
          
          list.push({
            id: t.id || `trans_${tTime}`,
            description: t.description || (t.value > 0 ? 'Suprimento' : 'Sangria'),
            notes: t.notes || '',
            date: t.date,
            method: t.methodCode || 'cash',
            methodLabel: t.methodLabel || 'Dinheiro',
            value: t.value,
            type: t.value > 0 ? 'in' : 'out',
            isManual: true,
            seller: t.userName || '—'
          })

          const amount = Number(t.value || 0)
          if (amount > 0) {
            totalIn += amount
            if (t.type === 'add') moneyAdded += amount
          }
          else {
            totalOut += Math.abs(amount)
            if (t.type === 'remove' || t.type === 'expense') moneyRemoved += Math.abs(amount)
          }
          
          methods['Dinheiro'] = (methods['Dinheiro'] || 0) + amount
        })
      }

      orders.forEach(o => {
        if (o.status && o.status.toLowerCase() === 'cancelada') return
        if (o.payments && Array.isArray(o.payments) && o.payments.length > 0) {
          const paymentsInThisCash = []

          o.payments.forEach((p, idx) => {
            let pTime = 0
            let pDateObj = null
            if (p.date) {
              pDateObj = p.date.toDate ? p.date.toDate() : new Date(p.date)
              pTime = pDateObj.getTime()
            } else {
              pDateObj = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0)
              pTime = pDateObj.getTime()
            }
  
            // Filter by time range
            if (pTime >= openTime && pTime <= closeTime) {
              paymentsInThisCash.push({ ...p, pTime, pDateObj, idx })
            }
          })

          if (paymentsInThisCash.length > 0) {
              // Robust detection of OS vs Sale matching visual formatting logic
              const isOS = o.type === 'service_order' || (o.status && o.status.includes('Os Finalizada'))
              const isSale = !isOS
              
              const totalAmt = paymentsInThisCash.reduce((s, p) => s + Number(p.amount||0), 0)
              const firstP = paymentsInThisCash[0]
              
              // Construct methods list for display
              const displayMethods = paymentsInThisCash.map(p => ({
                code: p.methodCode,
                label: p.method || 'Outros',
                amount: Number(p.amount||0)
              }))
              
              list.push({
                id: `${o.id}_grouped`,
                description: formatSaleNumber(o),
                date: firstP.pDateObj,
                method: firstP.methodCode, 
                methodLabel: firstP.method || 'Outros',
                displayMethods, 
                value: totalAmt,
                type: 'in',
                originalOrder: o,
                seller: o.attendant || o.userName || '—'
              })

              // Update financials
              paymentsInThisCash.forEach(p => {
                 const amount = Number(p.amount || 0)
                 if(isSale) salesTotal += amount
                 else osTotal += amount
                 
                 totalIn += amount
                 
                 let mLabel = p.method || 'Outros'
                 if (p.methodCode === 'cash' || mLabel.toLowerCase() === 'dinheiro') {
                    mLabel = 'Dinheiro'
                 }
                 methods[mLabel] = (methods[mLabel] || 0) + amount
              })
          }
        }
      })
  
      list.sort((a,b) => {
        const ta = a.date?.toDate ? a.date.toDate().getTime() : (a.date instanceof Date ? a.date.getTime() : 0)
        const tb = b.date?.toDate ? b.date.toDate().getTime() : (b.date instanceof Date ? b.date.getTime() : 0)
        return tb - ta
      })
  
      const opening = Number(cash.initialValue || 0)
      // O Saldo do Caixa deve ser a soma de todos os valores registrados (Abertura + Vendas de todos os tipos)
      const cashBalance = Object.values(methods).reduce((acc, v) => acc + v, 0)

      return { transactions: list, financials: { opening, sales: salesTotal, os: osTotal, cashBalance, methods, totalIn, totalOut, moneyAdded, moneyRemoved } }
    }

    if (selectedPreviousCash) {
       return processCash(selectedPreviousCash)
    }
    return processCash(currentCash)

  }, [currentCash, orders, selectedPreviousCash])

  const handleViewOrder = (order) => {
    if (setViewParams) {
      setViewParams({ id: order.id, type: 'os' })
    }
    if (onView) {
      onView('os')
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Carregando caixa...</div>

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-8rem)]">
      {/* Tabs */}
      <div className="flex items-center gap-6 border-b mb-6">
        <button 
          onClick={()=>setTab('atual')}
          className={`pb-2 text-sm font-medium transition-colors ${tab==='atual' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Caixa Atual
        </button>
        <button 
          onClick={()=>setTab('anterior')}
          className={`pb-2 text-sm font-medium transition-colors ${tab==='anterior' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Caixas Anteriores
        </button>
      </div>

      {tab === 'atual' && (
        <>
          {/* STATE 1: CAIXA FECHADO */}
          {!currentCash && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-6">
                <span className="text-4xl text-green-600">$</span>
              </div>
              <h2 className="text-xl font-medium text-gray-800 mb-2">Ops... Seu caixa está fechado</h2>
              <button 
                onClick={() => setOpenModalVisible(true)}
                className="mt-4 px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full font-medium transition-colors shadow-sm"
              >
                Abrir Caixa
              </button>
            </div>
          )}

          {/* STATE 3: CAIXA ABERTO */}
          {currentCash && (
            <div className="flex flex-col md:flex-row gap-6 items-start h-full">
              {/* Left Side: Movimentações (Placeholder for now as per instructions to focus on flow) */}

              <div className="flex-1 w-full bg-white rounded shadow-sm border p-4 min-h-[400px]">
                   <div className="flex items-center justify-between mb-4 relative">
                   <h3 className="font-semibold text-gray-700">Movimentações</h3>
                   <div ref={menuRef} className="relative">
                     <button 
                       onClick={() => setShowNewTransactionMenu(!showNewTransactionMenu)}
                       className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded shadow-sm flex items-center gap-1 transition-colors"
                     >
                       Novo Lançamento
                     </button>
                     
                     {showNewTransactionMenu && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border z-50 overflow-hidden origin-top-right">
                        <div className="bg-green-500 text-white px-4 py-2 text-sm font-medium text-center">
                          Novo Lançamento
                        </div>
                         <div className="py-1">
                           <button 
                             onClick={() => {
                               setTransactionType('add')
                               setTransDescription('')
                               setTransValue('')
                               setShowNewTransactionMenu(false)
                               setTransactionModalOpen(true)
                             }}
                             className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700 transition-colors"
                           >
                             <div className="w-6 h-6 rounded-full border-2 border-green-500 flex items-center justify-center text-green-500 font-bold text-xs">
                               +
                             </div>
                             Adicionar valores
                           </button>
                           <button 
                             onClick={() => {
                               setTransactionType('remove')
                               setTransDescription('')
                               setTransValue('')
                               setWithdrawalValues({})
                               setShowNewTransactionMenu(false)
                               setWithdrawalModalOpen(true)
                             }}
                             className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700 transition-colors"
                           >
                             <div className="w-6 h-6 rounded-full border-2 border-red-500 flex items-center justify-center text-red-500 font-bold text-xs">
                               -
                             </div>
                             Remover valores
                           </button>
                           <button 
                             onClick={() => {
                               setTransactionType('expense')
                               setTransDescription('')
                               setTransValue('')
                               setShowNewTransactionMenu(false)
                               setTransactionModalOpen(true)
                             }}
                             className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700 transition-colors"
                           >
                             <div className="w-6 h-6 flex items-center justify-center text-red-500">
                               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                               </svg>
                             </div>
                             Pagar despesas
                           </button>
                         </div>
                       </div>
                     )}
                   </div>
                 </div>
                 
                 <div className="border rounded-lg overflow-hidden">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                       <tr>
                         <th className="py-3 px-4">Descrição</th>
                         <th className="py-3 px-4">Data</th>
                         <th className="py-3 px-4">Hora</th>
                         <th className="py-3 px-4">Vendedor</th>
                         <th className="py-3 px-4 text-center">Meio Pg.</th>
                         <th className="py-3 px-4 text-right">Valor</th>
                         <th className="py-3 px-4 text-center">Status</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y">
                       {transactions.map(t => (
                         <tr 
                           key={t.id} 
                           className="hover:bg-gray-50 cursor-pointer transition-colors"
                           onClick={() => {
                            if (t.originalOrder) {
                              setSelectedOrder(t.originalOrder)
                              setDetailModalOpen(true)
                            } else if (t.isManual) {
                              setSelectedTransaction(t)
                            }
                          }}
                         >
                           <td className="py-3 px-4 text-gray-800 font-medium">{t.description}</td>
                           <td className="py-3 px-4 text-gray-500 text-xs">{dateStr(t.date)}</td>
                           <td className="py-3 px-4 text-gray-500 text-xs">{timeStr(t.date)}</td>
                           <td className="py-3 px-4 text-gray-500 text-xs truncate max-w-[100px]" title={t.seller}>{t.seller}</td>
                           <td className="py-3 px-4 text-center text-gray-500">
                             {t.displayMethods && t.displayMethods.length > 0 ? (
                               <div className="flex justify-center gap-1">
                                 {t.displayMethods.map((dm, idx) => (
                                   <span key={idx} title={`${dm.label}: ${money(dm.amount)}`}>
                                     {dm.code === 'cash' || dm.label?.toLowerCase().includes('dinheiro') ? '💵' : (
                                       dm.label?.toLowerCase().includes('pix') ? <img src={pixIcon} alt="PIX" className="inline-block w-4 h-4" /> : '💳'
                                     )}
                                   </span>
                                 ))}
                               </div>
                             ) : (
                               t.method === 'cash' || t.methodLabel?.toLowerCase().includes('dinheiro')
                                 ? '💵'
                                 : (t.methodLabel?.toLowerCase().includes('pix')
                                   ? <img src={pixIcon} alt="PIX" className="inline-block w-4 h-4" />
                                   : '💳')
                             )}
                          </td>
                          <td className={`py-3 px-4 text-right font-medium ${t.value < 0 ? 'text-red-600' : 'text-green-600'}`}>{money(t.value)}</td>
                          <td className="py-3 px-4 text-center text-green-500">✔</td>
                         </tr>
                       ))}
                       {transactions.length === 0 && (
                         <tr><td colSpan="6" className="py-8 text-center text-gray-400">Nenhuma movimentação</td></tr>
                       )}
                     </tbody>
                   </table>
                 </div>
              </div>

              {/* Right Side: Resumo */}
              <div className="w-full md:w-80 bg-gray-50 rounded border p-4">
                <h3 className="font-semibold text-gray-700 mb-4">Resumo do caixa</h3>
                
                <div className="space-y-3 text-sm">
                  <div className="text-xs text-gray-500 mb-2">
                    Caixa #{currentCash.id.slice(0,6)} aberto em {dateStr(currentCash.openedAt)}
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">Saldo de abertura</span>
                    <span className="font-medium text-gray-900">{money(financials.opening)}</span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">Total das vendas</span>
                    <span className="font-medium text-gray-900">{money(financials.sales)}</span>
                  </div>

                  <div className="flex items-center justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">Total Ordens de Serviço</span>
                    <span className="font-medium text-gray-900">{money(financials.os)}</span>
                  </div>

                  {financials.moneyAdded > 0 && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Dinheiro Adicionado</span>
                      <span className="font-medium text-gray-900">{money(financials.moneyAdded)}</span>
                    </div>
                  )}

                  {financials.moneyRemoved > 0 && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Valores Retirados</span>
                      <span className="font-medium text-gray-900">-{money(financials.moneyRemoved)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600 font-medium">Saldo do Caixa</span>
                    <span className="font-bold text-lg text-green-600">{money(financials.cashBalance)}</span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-gray-500">Total a prazo</span>
                    <span className="text-gray-500">R$ 0,00</span>
                  </div>

                  <div className="pt-4">
                    <div className="text-xs text-gray-500 mb-2">Total por meio de pagamento</div>
                    {Object.entries(financials.methods).map(([method, val]) => (
                      <div key={method} className="flex items-center justify-between text-sm mb-1">
                        <span className="flex items-center gap-2 text-gray-600">
                          <span>{method.toLowerCase().includes('dinheiro')
                            ? '💵'
                            : (method.toLowerCase().includes('pix')
                              ? <img src={pixIcon} alt="PIX" className="inline-block w-4 h-4" />
                              : '💳')}</span> {method}
                        </span>
                        <span className="font-medium text-gray-900">{money(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8">
                  <button 
                    onClick={() => setCloseModalOpen(true)}
                    className="w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded font-medium transition-colors"
                  >
                    Fechar Caixa
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Close Cash Modal */}
          {closeModalOpen && (
            <CloseCashModal
              open={closeModalOpen}
              onClose={() => setCloseModalOpen(false)}
              onConfirm={handleCloseCash}
              financials={financials}
            />
          )}

          {/* Withdrawal Modal */}
          {withdrawalModalOpen && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl animate-in fade-in zoom-in duration-200 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="text-lg font-bold text-gray-800">Retirada de Valores</h3>
                  <button onClick={() => setWithdrawalModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
                </div>
                
                <form onSubmit={handleSaveWithdrawal} className="p-6">
                  <div className="mb-6 text-sm text-gray-600">
                    Informe os valores por meio de pagamento a serem retirados do caixa:
                  </div>

                  <div className="space-y-4 mb-6">
                    <div className="grid grid-cols-12 gap-4 text-xs font-bold text-gray-500 uppercase mb-2 px-2">
                      <div className="col-span-4">Meio de pagamento</div>
                      <div className="col-span-4 text-right">Valor em caixa</div>
                      <div className="col-span-4">Valor da Retirada</div>
                    </div>
                    
                    {Object.entries(financials.methods).map(([method, balance]) => (
                      <div key={method} className="grid grid-cols-12 gap-4 items-center bg-gray-50 p-3 rounded-lg border">
                        <div className="col-span-4 flex items-center gap-2 font-medium text-gray-700">
                          <span>{method.toLowerCase().includes('dinheiro')
                            ? '💵'
                            : (method.toLowerCase().includes('pix')
                              ? <img src={pixIcon} alt="PIX" className="inline-block w-4 h-4" />
                              : '💠')}</span>
                          {method}
                        </div>
                        <div className="col-span-4 text-right font-medium text-gray-900">
                          {money(balance)}
                        </div>
                        <div className="col-span-4">
                          <input 
                            type="number"
                            step="0.01"
                            min="0"
                            max={balance}
                            value={withdrawalValues[method] || ''}
                            onChange={e => setWithdrawalValues(prev => ({ ...prev, [method]: e.target.value }))}
                            className="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-right text-sm focus:ring-green-500 focus:border-green-500"
                            placeholder="0,00"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 border focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 transition-all mb-6">
                    <input 
                      type="text"
                      value={transDescription}
                      onChange={e => setTransDescription(e.target.value)}
                      className="w-full bg-transparent border-none p-0 text-sm text-gray-700 focus:ring-0 placeholder-gray-400 outline-none"
                      placeholder="Observações"
                    />
                  </div>
                  
                  <div className="flex gap-3 justify-end">
                    <button 
                      type="button"
                      onClick={() => setWithdrawalModalOpen(false)}
                      className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded text-sm font-medium transition-colors"
                    >
                      ✕ Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={transSaving}
                      className="px-6 py-2 bg-green-500 hover:bg-green-600 rounded text-white text-sm font-bold transition-colors shadow-sm flex items-center gap-2"
                    >
                      {transSaving ? 'Salvando...' : (
                        <>
                          <span>✔</span> Salvar
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* New Transaction Modal */}
          {transactionModalOpen && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-in fade-in zoom-in duration-200 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b">
                  <h3 className="text-lg font-bold text-gray-800">
                    {transactionType === 'add' ? 'Adicionar dinheiro' : (transactionType === 'expense' ? 'Pagar despesas' : 'Remover valores')}
                  </h3>
                  <button onClick={() => setTransactionModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
                </div>
                
                <form onSubmit={handleSaveTransaction} className="p-6">
                  <div className="space-y-4">
                    <div className="bg-gray-100 rounded-lg p-4 flex flex-col items-end">
                      <label className="text-xs text-gray-500 font-medium mb-1">Valor em dinheiro</label>
                      <input 
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        autoFocus
                        value={transValue}
                        onChange={e => setTransValue(e.target.value)}
                        className="w-full bg-transparent border-none p-0 text-right text-3xl font-bold text-gray-800 focus:ring-0 placeholder-gray-400 outline-none"
                        placeholder="0,00"
                      />
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3 border focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 transition-all">
                      <textarea 
                        rows={3}
                        value={transDescription}
                        onChange={e => setTransDescription(e.target.value)}
                        className="w-full bg-transparent border-none p-0 text-sm text-gray-700 focus:ring-0 placeholder-gray-400 resize-none outline-none"
                        placeholder="Detalhes (opcional)"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-8 flex gap-3 justify-end">
                    <button 
                      type="button"
                      onClick={() => setTransactionModalOpen(false)}
                      className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded text-sm font-medium transition-colors"
                    >
                      ✕ Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={transSaving}
                      className={`px-6 py-2 rounded text-white text-sm font-bold transition-colors shadow-sm flex items-center gap-2 ${
                        transactionType === 'add' 
                          ? 'bg-green-500 hover:bg-green-600' 
                          : 'bg-red-500 hover:bg-red-600'
                      }`}
                    >
                      {transSaving ? 'Salvando...' : (
                        <>
                          <span>✔</span> Confirmar
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Transaction Detail Modal */}
          {selectedTransaction && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200 overflow-hidden">
                <div className="p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-6">
                    {selectedTransaction.value > 0 ? 'Valor adicionado' : 'Valor removido'}
                  </h3>

                  <div className={`text-4xl font-bold mb-2 ${selectedTransaction.value > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {money(selectedTransaction.value)}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {dateStr(selectedTransaction.date)}
                  </div>

                  <div className="flex gap-3 mb-8">
                    <button className="flex items-center gap-2 px-4 py-2 border border-green-500 text-green-600 rounded bg-green-50 hover:bg-green-100 text-sm font-medium transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Recibo
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-500 rounded hover:bg-gray-50 text-sm font-medium transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Cancelar
                    </button>
                  </div>

                  <div className="space-y-4 border-t pt-4">
                    <div>
                      <div className="text-xs font-bold text-gray-800 mb-1">Detalhes:</div>
                      <div className="text-sm text-gray-600">{selectedTransaction.notes || selectedTransaction.description}</div>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-gray-800 mb-1">Pagamento</div>
                      <div className="flex justify-between items-center">
                         <div className="flex items-center gap-2 text-gray-600">
                           {selectedTransaction?.method === 'cash' || selectedTransaction?.methodLabel?.toLowerCase().includes('dinheiro')
                             ? <span className="text-lg">💵</span>
                             : (selectedTransaction?.methodLabel?.toLowerCase().includes('pix')
                               ? <img src={pixIcon} alt="PIX" className="inline-block w-4 h-4" />
                               : <span className="text-lg">💳</span>)}
                           <span className="text-sm">{selectedTransaction?.methodLabel || (selectedTransaction?.method === 'cash' ? 'Dinheiro' : 'Outros')}</span>
                         </div>
                         <div className="font-medium text-gray-900">{money(selectedTransaction.value)}</div>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">Taxa: R$ 0,00</div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 flex justify-end border-t">
                  <button 
                    onClick={() => setSelectedTransaction(null)}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-700 font-medium text-sm"
                  >
                    <span>&larr;</span> Voltar
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'anterior' && (
        <>
          {/* List View */}
          {!selectedPreviousCash && (
            <div className="flex-1 bg-white rounded shadow p-4 overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                    <tr>
                      <th className="py-3 px-4">Número</th>
                      <th className="py-3 px-4">Abertura</th>
                      <th className="py-3 px-4">Fechamento</th>
                      <th className="py-3 px-4 text-right">Saldo inicial</th>
                      <th className="py-3 px-4 text-right">Saldo Final</th>
                      <th className="py-3 px-4 text-right">Recebimentos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loadingPrev ? (
                      <tr><td colSpan="6" className="py-8 text-center text-gray-500">Carregando...</td></tr>
                    ) : previousList.length === 0 ? (
                      <tr><td colSpan="6" className="py-8 text-center text-gray-400">Nenhum histórico encontrado.</td></tr>
                    ) : (
                      previousList.map(c => {
                        const balance = c.closingValues?.finalBalance || 0
                        const initial = c.initialValue || 0
                        
                        let receipts = 0
                        
                        // Verificar se temos os dados detalhados salvos (novos registros)
                        const hasDetailedStats = c.closingValues?.sales !== undefined || c.closingValues?.os !== undefined
                        
                        if (hasDetailedStats) {
                          receipts = (c.closingValues?.sales || 0) + (c.closingValues?.os || 0)
                        } else {
                          // Fallback para registros antigos: calcular com base nos pedidos carregados
                          // Reutiliza a lógica de processCash para encontrar vendas/OS do período
                          const openTime = c.openedAt?.toDate ? c.openedAt.toDate().getTime() : 0
                          const closeTime = c.closedAt?.toDate ? c.closedAt.toDate().getTime() : Date.now()
                          
                          let calculatedSales = 0
                          let calculatedOS = 0
                          
                          orders.forEach(o => {
                            if (o.payments && Array.isArray(o.payments)) {
                              o.payments.forEach(p => {
                                let pTime = 0
                                if (p.date) {
                                  pTime = p.date.toDate ? p.date.toDate().getTime() : new Date(p.date).getTime()
                                } else {
                                  pTime = o.createdAt?.toDate ? o.createdAt.toDate().getTime() : new Date(o.createdAt || 0).getTime()
                                }
                                
                                if (pTime >= openTime && pTime <= closeTime) {
                                  const amount = Number(p.amount || 0)
                                  const isSale = (o.type === 'sale' || !o.type)
                                  
                                  if(isSale) {
                                    calculatedSales += amount
                                  } else {
                                    // Check O.S. status
                                    const s = o.status || ''
                                    if (s === 'Os Finalizada e Faturada Cliente Final' || s === 'Os Faturada Cliente Final' || s === 'Os Faturada Cliente lojista') {
                                      calculatedOS += amount
                                    }
                                  }
                                }
                              })
                            }
                          })
                          
                          receipts = calculatedSales + calculatedOS
                        }

                        return (
                          <tr key={c.id} onClick={()=>setSelectedPreviousCash(c)} className="hover:bg-gray-50 cursor-pointer">
                            <td className="py-3 px-4 text-gray-800 font-medium">{c.number || '-'}</td>
                            <td className="py-3 px-4 text-gray-500">{dateStr(c.openedAt)}</td>
                            <td className="py-3 px-4 text-gray-500">{dateStr(c.closedAt)}</td>
                            <td className="py-3 px-4 text-right text-gray-900">{money(initial)}</td>
                            <td className="py-3 px-4 text-right text-gray-900 font-medium">{money(balance)}</td>
                            <td className="py-3 px-4 text-right text-green-600">{money(receipts)}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Detail View */}
          {selectedPreviousCash && (
            <div className="flex flex-col h-full">
               <div className="flex items-center justify-between mb-4">
                 <button onClick={()=>setSelectedPreviousCash(null)} className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-800">
                   <span>&larr;</span> Voltar
                 </button>
                 <button className="px-4 py-2 border rounded text-sm text-gray-600 hover:bg-gray-50" onClick={()=>window.print()}>Imprimir Relatório</button>
               </div>

               <div className="flex flex-col md:flex-row gap-6 items-start h-full">
                 {/* Transactions Table */}
                 <div className="flex-1 w-full bg-white rounded shadow-sm border p-4 min-h-[400px]">
                   <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                        <tr>
                          <th className="py-3 px-4">Descrição</th>
                          <th className="py-3 px-4">Data</th>
                          <th className="py-3 px-4 text-center">Meio Pg.</th>
                          <th className="py-3 px-4 text-right">Valor</th>
                          <th className="py-3 px-4 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {transactions.map(t => (
                          <tr key={t.id} className="hover:bg-gray-50">
                            <td className="py-3 px-4 text-gray-800 font-medium">{t.description}</td>
                            <td className="py-3 px-4 text-gray-500">{dateStr(t.date)}</td>
                            <td className="py-3 px-4 text-center text-gray-500">
                              {t.method === 'cash' || t.methodLabel?.toLowerCase().includes('dinheiro') ? '💵' : '💳'}
                            </td>
                            <td className={`py-3 px-4 text-right font-medium ${t.value < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {money(t.value)}
                            </td>
                            <td className="py-3 px-4 text-center text-green-500">✔</td>
                          </tr>
                        ))}
                        {transactions.length === 0 && (
                          <tr><td colSpan="5" className="py-8 text-center text-gray-400">Nenhuma movimentação</td></tr>
                        )}
                      </tbody>
                    </table>
                   </div>
                 </div>

                 {/* Summary Card */}
                 <div className="w-full md:w-96 bg-gray-50 rounded border p-6">
                   <h3 className="font-bold text-lg text-gray-800 mb-6">Resumo do caixa</h3>
                   
                   <div className="text-xs text-gray-500 mb-6">
                     Caixa #{selectedPreviousCash.number || '-'} aberto em {dateStr(selectedPreviousCash.openedAt)}
                   </div>
                   
                   <div className="space-y-3 text-sm">
                     <div className="flex items-center justify-between">
                       <span className="text-gray-600">Saldo de abertura</span>
                       <span className="font-medium text-gray-900">{money(financials.opening)}</span>
                     </div>
                     <div className="flex items-center justify-between">
                       <span className="text-gray-600">Total das vendas</span>
                       <span className="font-medium text-gray-900">{money(financials.sales)}</span>
                     </div>
                     <div className="flex items-center justify-between">
                       <span className="text-gray-600">Total Ordens de Serviço</span>
                       <span className="font-medium text-gray-900">{money(financials.os)}</span>
                     </div>
                     <div className="flex items-center justify-between">
                       <span className="text-gray-600">Pagamentos</span>
                       <span className="font-medium text-gray-900">{money(financials.totalOut)}</span>
                     </div>
                     
                     <div className="flex items-center justify-between py-4 border-t border-b border-gray-200 mt-2 mb-2">
                       <span className="font-bold text-gray-800">Saldo do Caixa</span>
                       <span className="font-bold text-xl text-green-600">{money(financials.cashBalance)}</span>
                     </div>

                     <div className="flex items-center justify-between">
                       <span className="text-gray-500">Total a prazo</span>
                       <span className="text-gray-500">R$ 0,00</span>
                     </div>

                     <div className="pt-6">
                       <div className="text-xs text-gray-500 mb-3">Total por meio de pagamento</div>
                       {Object.entries(financials.methods).map(([method, val]) => (
                        <div key={method} className="flex items-center justify-between text-sm mb-2">
                           <span className="flex items-center gap-2 text-gray-600">
                             <span>{method.toLowerCase().includes('dinheiro')
                               ? '💵'
                               : (method.toLowerCase().includes('pix')
                                 ? <img src={pixIcon} alt="PIX" className="inline-block w-4 h-4" />
                                 : '💳')}</span> {method}
                           </span>
                           <span className="font-medium text-gray-900">{money(val)}</span>
                         </div>
                       ))}
                     </div>
                   </div>

                   <div className="mt-8">
                     <button 
                       onClick={handleReopenCash}
                       className="w-full py-3 bg-white border border-green-500 text-green-600 hover:bg-green-50 rounded font-medium transition-colors shadow-sm"
                     >
                       Reabrir Caixa
                     </button>
                   </div>
                 </div>
               </div>
            </div>
          )}
        </>
      )}

      {/* MODAL DE ABERTURA */}
      {openModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
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
                  value={initialValue}
                  onChange={e => setInitialValue(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => setOpenModalVisible(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded transition-colors"
                  disabled={opening}
                >
                  ✕ Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded shadow-sm transition-colors flex items-center justify-center gap-2"
                  disabled={opening}
                >
                  {opening ? 'Abrindo...' : (
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

      {/* Modal Detalhes da Venda */}
      <SaleDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        sale={selectedOrder}
        onView={handleViewOrder}
      />
    </div>
  )
}
