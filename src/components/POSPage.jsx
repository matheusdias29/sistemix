import React, { useState, useEffect, useMemo } from 'react'
import { listenCurrentCash, openCashRegister, closeCashRegister, getClosedCashRegisters, reopenCashRegister } from '../services/cash'
import { listenOrders } from '../services/orders'
import SaleDetailModal from './SaleDetailModal'

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

  const handleCloseCash = async () => {
    if(!currentCash) return
    if(!window.confirm('Tem certeza que deseja fechar o caixa?')) return
    try {
      await closeCashRegister(currentCash.id, {
        finalBalance: financials.cashBalance // Simplificado
      })
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

  // Helpers de formatação
  const money = (v) => Number(v||0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const dateStr = (ts) => {
    if(!ts) return ''
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    const dias = ['dom','seg','ter','qua','qui','sex','sáb']
    return `${dias[d.getDay()]} - ${d.getDate()}/${d.getMonth()+1}`
  }

  const { transactions, financials } = useMemo(() => {
    // Helper para processar dados de um caixa
    const processCash = (cash) => {
      if (!cash) return { transactions: [], financials: { opening: 0, sales: 0, os: 0, cashBalance: 0, methods: {}, totalIn: 0, totalOut: 0 } }
  
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
        type: 'in'
      })
  
      let salesTotal = 0
      let osTotal = 0
      let totalIn = 0
      let totalOut = 0 // Expenses placeholder
      
      const methods = {
        'Dinheiro': Number(cash.initialValue || 0)
      }
  
      orders.forEach(o => {
        if (o.payments && Array.isArray(o.payments) && o.payments.length > 0) {
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
              const isSale = (o.type === 'sale' || !o.type)
              const prefix = isSale ? 'Venda' : 'O.S.'
              const amount = Number(p.amount || 0)

              list.push({
                id: `${o.id}_p${idx}`,
                description: `${prefix} ${o.number || ''}`,
                date: pDateObj,
                method: p.methodCode,
                methodLabel: p.method || 'Outros',
                value: amount,
                type: 'in',
                originalOrder: o
              })
              
              if(isSale) salesTotal += amount
              else osTotal += amount
              
              totalIn += amount
              
              const mLabel = p.method || 'Outros'
              methods[mLabel] = (methods[mLabel] || 0) + amount
            }
          })
        }
      })
  
      list.sort((a,b) => {
        const ta = a.date?.toDate ? a.date.toDate().getTime() : (a.date instanceof Date ? a.date.getTime() : 0)
        const tb = b.date?.toDate ? b.date.toDate().getTime() : (b.date instanceof Date ? b.date.getTime() : 0)
        return tb - ta
      })
  
      const opening = Number(cash.initialValue || 0)
      const cashBalance = methods['Dinheiro'] || 0
  
      return { transactions: list, financials: { opening, sales: salesTotal, os: osTotal, cashBalance, methods, totalIn, totalOut } }
    }

    if (selectedPreviousCash) {
       return processCash(selectedPreviousCash)
    }
    return processCash(currentCash)

  }, [currentCash, orders, selectedPreviousCash])

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
                 <div className="flex items-center justify-between mb-4">
                   <h3 className="font-semibold text-gray-700">Movimentações</h3>
                   <button disabled className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded opacity-50 cursor-not-allowed">
                     Novo Lançamento
                   </button>
                 </div>
                 
                 <div className="border rounded-lg overflow-hidden">
                   <table className="w-full text-sm text-left">
                     <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                       <tr>
                         <th className="py-3 px-4">Descrição</th>
                         <th className="py-3 px-4">Data</th>
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
                             }
                           }}
                         >
                           <td className="py-3 px-4 text-gray-800 font-medium">{t.description}</td>
                           <td className="py-3 px-4 text-gray-500">{dateStr(t.date)}</td>
                           <td className="py-3 px-4 text-center text-gray-500">
                             {t.method === 'cash' || t.methodLabel?.toLowerCase().includes('dinheiro') ? '💵' : '💳'}
                           </td>
                           <td className="py-3 px-4 text-right font-medium text-green-600">{money(t.value)}</td>
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
                          <span>{method.toLowerCase().includes('dinheiro') ? '💵' : '💳'}</span> {method}
                        </span>
                        <span className="font-medium text-gray-900">{money(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8">
                  <button 
                    onClick={handleCloseCash}
                    className="w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded font-medium transition-colors"
                  >
                    Fechar Caixa
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
                        const receipts = balance - initial // Aproximado
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
                             <span>{method.toLowerCase().includes('dinheiro') ? '💵' : '💳'}</span> {method}
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
      />
    </div>
  )
}
