import React, { useState, useEffect, useMemo } from 'react'
import { listenAccountsReceivable, addAccountReceivable, updateAccountReceivable, removeAccountReceivable } from '../services/accountsReceivable'
import NewAccountReceivableModal from './NewAccountReceivableModal'
import SalesDateFilterModal from './SalesDateFilterModal'
import { PaymentMethodsModal, PaymentAmountModal } from './PaymentModals'
import { listenCurrentCash, addCashTransaction } from '../services/cash'

const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dateStr = (d) => {
  if (!d) return '-'
  if (typeof d === 'string' && d.includes('-')) {
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }
  return '-'
}

export default function AccountsReceivablePage({ storeId, user }) {
  const [accounts, setAccounts] = useState([])
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('pending') // 'pending' (A Receber), 'all' (Todos)
  
  const [dateFilterOpen, setDateFilterOpen] = useState(false)
  const [dateRange, setDateRange] = useState({ label: 'Todos', start: null, end: null })

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)
  
  // Dropdown e Modal Type
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [modalType, setModalType] = useState('receivable') // 'receivable' or 'credit'
  const [detailGroup, setDetailGroup] = useState(null)
  const [detailTab, setDetailTab] = useState('receivable')
  const [selectedDetailIds, setSelectedDetailIds] = useState(new Set())
  const [detailMenuOpenId, setDetailMenuOpenId] = useState(null)
  const [currentCash, setCurrentCash] = useState(null)
  const [receiveTargetAccounts, setReceiveTargetAccounts] = useState([])
  const [receivePayments, setReceivePayments] = useState([])
  const [receiveInfoOpen, setReceiveInfoOpen] = useState(false)
  const [receivePayMethodsOpen, setReceivePayMethodsOpen] = useState(false)
  const [receiveSelectedMethod, setReceiveSelectedMethod] = useState(null)
  const [receivePayAmountOpen, setReceivePayAmountOpen] = useState(false)
  const [receivePayAmountInput, setReceivePayAmountInput] = useState('')
  const [receivePayError, setReceivePayError] = useState('')
  const [receiveTotal, setReceiveTotal] = useState(0)

  useEffect(() => {
    const unsub = listenAccountsReceivable((items) => {
      setAccounts(items)
    }, storeId)
    return () => unsub()
  }, [storeId])

  useEffect(() => {
    const unsub = listenCurrentCash(storeId, (cash) => {
      setCurrentCash(cash)
    })
    return () => unsub && unsub()
  }, [storeId])

  useEffect(() => {
    setSelectedDetailIds(new Set())
    setDetailMenuOpenId(null)
  }, [detailGroup, detailTab])

  // Agrupar por Cliente
  const { grouped, totalReceivable, totalOverdue, totalCredits } = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    
    let tReceivable = 0
    let tOverdue = 0
    let tCredits = 0

    const groups = {}

    accounts.forEach(acc => {
      // Filtros básicos
      if (filterType === 'pending' && acc.status !== 'pending') return
      
      // Filtro de Data (Vencimento)
      if (dateRange.start && dateRange.end) {
         if (!acc.dueDate) return
         const [y, m, d] = acc.dueDate.split('-').map(Number)
         const accDate = new Date(y, m - 1, d, 12, 0, 0) // noon to avoid timezone edge cases
         if (accDate < dateRange.start || accDate > dateRange.end) return
      }

      // Busca
      const s = search.toLowerCase()
      const match = (
        (acc.clientName && acc.clientName.toLowerCase().includes(s)) ||
        (acc.description && acc.description.toLowerCase().includes(s)) ||
        (acc.receivedBy && acc.receivedBy.toLowerCase().includes(s))
      )
      if (search && !match) return

      // Identificar tipo
      const isCredit = acc.type === 'credit'

      // Totais globais
      if (acc.status === 'pending') {
        if (isCredit) {
          tCredits += acc.remainingValue
        } else {
          tReceivable += acc.remainingValue
          if (acc.dueDate && acc.dueDate < today) {
            tOverdue += acc.remainingValue
          }
        }
      }

      // Agrupamento por cliente
      const key = acc.clientName || 'Cliente Sem Nome'
      if (!groups[key]) {
        groups[key] = {
          clientName: acc.clientName || 'Cliente Sem Nome',
          items: [],
          totalDebit: 0,
          totalOverdue: 0,
          totalCredit: 0, // Total de créditos desse cliente
          countReceivable: 0,
          countOverdue: 0,
          countCredit: 0,
          latestCreatedAt: 0
        }
      }

      groups[key].items.push(acc)
      
      if (acc.status === 'pending') {
        if (isCredit) {
          groups[key].totalCredit += acc.remainingValue
          groups[key].countCredit++
        } else {
          groups[key].totalDebit += acc.remainingValue
          if (acc.dueDate && acc.dueDate < today) {
            groups[key].totalOverdue += acc.remainingValue
            groups[key].countOverdue++
          } else {
            groups[key].countReceivable++
          }
        }
      }

      const createdAt = acc.createdAt
      let ts = 0
      if (createdAt?.toDate) {
        ts = createdAt.toDate().getTime()
      } else if (typeof createdAt === 'string') {
        const t = Date.parse(createdAt)
        ts = isNaN(t) ? 0 : t
      }
      if (ts > groups[key].latestCreatedAt) {
        groups[key].latestCreatedAt = ts
      }
    })

    return {
      grouped: Object.values(groups).sort((a, b) => b.latestCreatedAt - a.latestCreatedAt),
      totalReceivable: tReceivable,
      totalOverdue: tOverdue,
      totalCredits: tCredits
    }
  }, [accounts, search, filterType, dateRange])

  const detailItems = useMemo(() => {
    if (!detailGroup) return []
    const key = detailGroup.clientName || 'Cliente Sem Nome'
    return accounts.filter(acc => (acc.clientName || 'Cliente Sem Nome') === key)
  }, [accounts, detailGroup])
  const detailToday = new Date().toISOString().split('T')[0]

  let detailTotalReceivable = 0
  let detailTotalPaid = 0
  let detailTotalOverdue = 0
  let detailTotalCredits = 0

  detailItems.forEach(acc => {
    const isCredit = acc.type === 'credit'
    const remaining = Number(acc.remainingValue ?? acc.value ?? 0)
    const paid = Number(acc.paidValue ?? 0)

    if (acc.status === 'pending') {
      if (isCredit) {
        detailTotalCredits += remaining
      } else {
        detailTotalReceivable += remaining
        if (acc.dueDate && acc.dueDate < detailToday) {
          detailTotalOverdue += remaining
        }
      }
    } else if (acc.status === 'paid') {
      detailTotalPaid += paid || acc.value || 0
    }
  })

  const filteredDetailItems = detailItems.filter(acc => {
    if (detailTab === 'receivable') return acc.status === 'pending'
    if (detailTab === 'received') return acc.status === 'paid'
    return true
  })

  const selectedDetailTotal = detailTab === 'receivable'
    ? filteredDetailItems.reduce((sum, acc) => {
        if (!selectedDetailIds.has(acc.id)) return sum
        if (acc.type === 'credit') return sum
        if (acc.status !== 'pending') return sum
        const remaining = Number(acc.remainingValue ?? acc.value ?? 0)
        return sum + remaining
      }, 0)
    : 0

  const receiveRemaining = Math.max(
    receiveTotal - receivePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    0
  )

  const handleReceiveSelected = () => {
    if (selectedDetailIds.size === 0) return

    const selectedAccounts = filteredDetailItems.filter(acc => {
      if (!selectedDetailIds.has(acc.id)) return false
      if (acc.type === 'credit') return false
      return acc.status === 'pending'
    })

    if (selectedAccounts.length === 0) return

    const total = selectedAccounts.reduce((sum, acc) => {
      const remaining = Number(acc.remainingValue ?? acc.value ?? 0)
      return sum + remaining
    }, 0)

    setReceiveTargetAccounts(selectedAccounts)
    setReceivePayments([])
    setReceiveSelectedMethod(null)
    setReceivePayAmountInput(total > 0 ? String(total.toFixed(2)) : '')
    setReceivePayError('')
    setReceiveTotal(total)
    setReceiveInfoOpen(true)
    setReceivePayMethodsOpen(false)
    setReceivePayAmountOpen(false)
  }

  const finalizeReceivePayments = async () => {
    if (!receiveTargetAccounts.length) {
      setReceivePayMethodsOpen(false)
      return
    }
    if (receiveRemaining > 0.01) {
      return
    }

    const todayStr = new Date().toISOString().split('T')[0]

    const paymentsToSave = receivePayments.map(p => ({
      method: p.method,
      methodCode: p.methodCode,
      amount: Number(p.amount || 0),
      date: p.date || new Date()
    }))

    try {
      setIsLoading(true)

      await Promise.all(
        receiveTargetAccounts.map(async acc => {
          const remaining = Number(acc.remainingValue ?? acc.value ?? 0)
          const paid = Number(acc.paidValue ?? 0)

          const updateData = {
            status: 'paid',
            paidValue: paid + remaining,
            remainingValue: 0,
            paymentDate: todayStr,
            receivedBy: user?.name || acc.receivedBy || 'Sistema'
          }

          if (paymentsToSave.length > 0) {
            updateData.payments = paymentsToSave
          }

          await updateAccountReceivable(acc.id, updateData)
        })
      )

      if (currentCash && paymentsToSave.length > 0) {
        const totalValue = paymentsToSave.reduce(
          (sum, p) => sum + Number(p.amount || 0),
          0
        )
        const mainMethod =
          paymentsToSave.length === 1 ? paymentsToSave[0] : null

        const description = 'Recebimento de contas'
        const notes = receiveTargetAccounts
          .map(acc => {
            const name = acc.clientName || 'Cliente'
            const desc = acc.description || ''
            return `${name} - ${desc}`
          })
          .join(' | ')

        await addCashTransaction(currentCash.id, {
          description,
          notes,
          value: totalValue,
          type: 'in',
          method: mainMethod ? mainMethod.methodCode : 'multiple',
          methodLabel: mainMethod ? mainMethod.method : 'Múltiplos métodos',
          date: new Date(),
          userId: user?.id,
          userName: user?.name,
          originalOrder: {
            id: receiveTargetAccounts[0]?.id,
            type: 'accounts_receivable',
            accounts: receiveTargetAccounts.map(acc => ({
              id: acc.id,
              clientId: acc.clientId,
              clientName: acc.clientName,
              description: acc.description,
              value: acc.value,
              remainingValue: acc.remainingValue
            }))
          }
        })
      }

      setSelectedDetailIds(new Set())
      setReceiveTargetAccounts([])
      setReceivePayments([])
      setReceivePayMethodsOpen(false)
      setReceiveSelectedMethod(null)
      setReceiveTotal(0)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (data) => {
    try {
      setIsLoading(true)
      
      if (Array.isArray(data)) {
        // Create multiple (installments)
        const promises = data.map(item => addAccountReceivable(item, storeId))
        await Promise.all(promises)
      } else {
        // Single item (create or edit)
        if (data.id) {
          // Edit
          const updateData = {
              clientId: data.clientId,
              clientName: data.clientName,
              description: data.description,
              details: data.details,
              value: data.value, 
              dueDate: data.dueDate || null,
              type: data.type
          }
          await updateAccountReceivable(data.id, updateData)
        } else {
          // Create
          await addAccountReceivable({ ...data, receivedBy: user?.name || 'Sistema' }, storeId)
        }
      }
      
      setIsModalOpen(false)
      setEditingAccount(null)
    } catch (error) {
      console.error(error)
      alert('Erro ao salvar conta')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      setIsLoading(true)
      await removeAccountReceivable(id)
      setIsModalOpen(false)
      setEditingAccount(null)
    } catch (error) {
      console.error(error)
      alert('Erro ao excluir conta')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full" onClick={() => setIsDropdownOpen(false)}>
      <div className="flex flex-col gap-6">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-6">
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto flex-1 items-center">
             {/* Search Bar */}
             <div className="relative w-full md:max-w-xs bg-gray-100 dark:bg-gray-700 rounded-lg">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-400 dark:text-gray-500">🔍</span>
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 bg-transparent border-none focus:ring-0 text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 text-base"
                  placeholder="Pesquisar..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              {/* Date Filter */}
              <button 
                onClick={() => setDateFilterOpen(true)}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  dateRange.label !== 'Todos' 
                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800' 
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600'
                }`}
              >
                <span>📅</span> {dateRange.label === 'Todos' ? 'Filtrar Vencimento' : dateRange.label}
              </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 w-full md:w-auto justify-end items-center relative">
             <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600">
               Opções
             </button>
             
             {/* Dropdown Button */}
             <div className="relative" onClick={e => e.stopPropagation()}>
               <button 
                 onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                 className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 shadow-sm flex items-center gap-2"
               >
                 + Novo
               </button>

               {/* Dropdown Menu */}
               {isDropdownOpen && (
                 <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 z-20 overflow-hidden animate-in fade-in zoom-in duration-200">
                   <button 
                     onClick={() => {
                       setModalType('receivable')
                       setEditingAccount(null)
                       setIsModalOpen(true)
                       setIsDropdownOpen(false)
                     }}
                     className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-3 border-b border-gray-50 dark:border-gray-700 transition-colors"
                   >
                     <span className="text-green-600 font-bold text-lg">↓$</span>
                     <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Conta a receber</span>
                   </button>
                   <button 
                     onClick={() => {
                       setModalType('credit')
                       setEditingAccount(null)
                       setIsModalOpen(true)
                       setIsDropdownOpen(false)
                     }}
                     className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-3 transition-colors"
                   >
                     <span className="text-green-600 font-bold text-lg">+$</span>
                     <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Crédito ao cliente</span>
                   </button>
                 </div>
               )}
             </div>
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-4">
           <div className="flex bg-gray-200 dark:bg-gray-700 rounded-full p-1">
              <button 
                onClick={() => setFilterType('pending')}
                className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${filterType === 'pending' ? 'bg-green-100 text-green-700 shadow-sm dark:bg-green-900/30 dark:text-green-300' : 'text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white'}`}
              >
                ✓ A Receber
              </button>
              <button 
                onClick={() => setFilterType('all')}
                className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${filterType === 'all' ? 'bg-white text-gray-800 shadow-sm dark:bg-gray-600 dark:text-white' : 'text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white'}`}
              >
                Todos
              </button>
           </div>
        </div>

        {/* Totals Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div>
             <span className="text-sm text-gray-500 dark:text-gray-400 font-medium block mb-1">Total A Receber</span>
             <span className="text-2xl font-bold text-green-600 dark:text-green-400">{money(totalReceivable)}</span>
           </div>
           <div>
             <span className="text-sm text-gray-500 dark:text-gray-400 font-medium block mb-1">Total Vencido</span>
             <span className="text-2xl font-bold text-red-500 dark:text-red-400">{money(totalOverdue)}</span>
           </div>
           <div>
             <span className="text-sm text-gray-500 dark:text-gray-400 font-medium block mb-1">Total Créditos</span>
             <span className="text-2xl font-bold text-green-600 dark:text-green-400">{money(totalCredits)}</span>
           </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
           <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
             <thead className="bg-gray-50 dark:bg-gray-700/50">
               <tr>
                 <th scope="col" className="px-6 py-3 text-left text-sm font-bold text-gray-600 dark:text-gray-300">Cliente / Descrição</th>
                 <th scope="col" className="px-6 py-3 text-right text-sm font-bold text-gray-600 dark:text-gray-300">Valor Débito</th>
                 <th scope="col" className="px-6 py-3 text-right text-sm font-bold text-gray-600 dark:text-gray-300">Valor Vencido</th>
                 <th scope="col" className="px-6 py-3 text-right text-sm font-bold text-gray-600 dark:text-gray-300">Valor Crédito</th>
                 <th scope="col" className="px-6 py-3 text-right text-sm font-bold text-gray-600 dark:text-gray-300">Status</th>
               </tr>
             </thead>
             <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
               {grouped.length === 0 ? (
                 <tr>
                   <td colSpan="5" className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                     Nenhuma conta encontrada.
                   </td>
                 </tr>
               ) : (
                 grouped.map((group, idx) => {
                   const groupKey = group.clientName || idx

                   return (
                     <tr
                       key={groupKey}
                       className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer group"
                       onClick={() => {
                         setDetailGroup(group)
                         setDetailTab('receivable')
                       }}
                     >
                       <td className="px-6 py-4 whitespace-nowrap">
                         <div className="text-sm text-gray-700 dark:text-gray-200">{group.clientName}</div>
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap text-right">
                         <div className="text-sm text-red-500 dark:text-red-400">{money(group.totalDebit)}</div>
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap text-right">
                         <div className="text-sm text-red-500">{group.totalOverdue > 0 ? money(group.totalOverdue) : '-'}</div>
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap text-right">
                         <div className="text-sm text-green-600">{group.totalCredit > 0 ? money(group.totalCredit) : '-'}</div>
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap text-right">
                         <div className="flex gap-2 justify-end">
                           {group.countOverdue > 0 && (
                             <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                               Vencido <span className="ml-1 bg-red-200 text-red-800 rounded-full w-5 h-5 flex items-center justify-center text-[10px]">{group.countOverdue}</span>
                             </span>
                           )}
                           {group.countReceivable > 0 && (
                             <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                               A Receber <span className="ml-1 bg-orange-200 text-orange-800 rounded-full w-5 h-5 flex items-center justify-center text-[10px]">{group.countReceivable}</span>
                             </span>
                           )}
                           {group.countCredit > 0 && (
                             <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                               Crédito <span className="ml-1 bg-green-200 text-green-800 rounded-full w-5 h-5 flex items-center justify-center text-[10px]">{group.countCredit}</span>
                             </span>
                           )}
                         </div>
                       </td>
                     </tr>
                   )
                 })
               )}
             </tbody>
           </table>
        </div>
      </div>

      {detailGroup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl">
            <div className="px-6 pt-4 border-b flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Contas a receber</div>
              <button
                className="text-sm text-gray-500 hover:text-gray-700"
                onClick={() => setDetailGroup(null)}
              >
                Voltar
              </button>
            </div>

            <div className="px-6 border-b flex gap-4 mt-2">
              <button
                className={`pb-2 text-sm font-medium ${
                  detailTab === 'receivable'
                    ? 'text-green-600 border-b-2 border-green-600'
                    : 'text-gray-500'
                }`}
                onClick={() => setDetailTab('receivable')}
              >
                A Receber
              </button>
              <button
                className={`pb-2 text-sm font-medium ${
                  detailTab === 'received'
                    ? 'text-green-600 border-b-2 border-green-600'
                    : 'text-gray-500'
                }`}
                onClick={() => setDetailTab('received')}
              >
                Recebido
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-gray-500">Total a receber</div>
                  <div className="text-base font-bold text-green-600">
                    {money(detailTotalReceivable)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Total pago</div>
                  <div className="text-base font-bold text-gray-800">
                    {money(detailTotalPaid)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Total vencido</div>
                  <div className="text-base font-bold text-red-500">
                    {money(detailTotalOverdue)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Total créditos</div>
                  <div className="text-base font-bold text-green-600">
                    {money(detailTotalCredits)}
                  </div>
                </div>
              </div>

              {detailTab === 'receivable' && selectedDetailTotal > 0 && (
                <div className="flex items-center justify-end">
                  <span className="text-sm text-gray-700 mr-3">
                    Valor a receber:{' '}
                    <span className="font-semibold">
                      {money(selectedDetailTotal)}
                    </span>
                  </span>
                  <button
                    onClick={handleReceiveSelected}
                    disabled={isLoading}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Receber
                  </button>
                </div>
              )}

              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      {detailTab === 'receivable' && (
                        <th className="px-4 py-2 w-10 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                            checked={
                              filteredDetailItems.length > 0 &&
                              filteredDetailItems.every(acc => selectedDetailIds.has(acc.id))
                            }
                            onChange={e => {
                              if (e.target.checked) {
                                const all = new Set(filteredDetailItems.map(acc => acc.id))
                                setSelectedDetailIds(all)
                              } else {
                                setSelectedDetailIds(new Set())
                              }
                            }}
                          />
                        </th>
                      )}
                      <th className="px-4 py-2 text-left text-xs font-bold text-gray-600">
                        Conta
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-bold text-gray-600">
                        Valor original
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-bold text-gray-600">
                        Valor pago
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-bold text-gray-600">
                        Disponível/A receber
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-bold text-gray-600">
                        Vencimento
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-bold text-gray-600">
                        Status
                      </th>
                      <th className="px-4 py-2 w-14"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredDetailItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={detailTab === 'receivable' ? 8 : 7}
                          className="px-4 py-6 text-center text-sm text-gray-500"
                        >
                          Nenhuma conta encontrada.
                        </td>
                      </tr>
                    ) : (
                      filteredDetailItems.map(acc => {
                        const isSelected = selectedDetailIds.has(acc.id)

                        return (
                          <tr
                            key={acc.id}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => {
                              if (acc.status !== 'pending') return
                              setModalType(acc.type || 'receivable')
                              setEditingAccount(acc)
                              setIsModalOpen(true)
                            }}
                          >
                            {detailTab === 'receivable' && (
                              <td className="px-4 py-2 text-center">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                  checked={isSelected}
                                  onClick={e => e.stopPropagation()}
                                  onChange={e => {
                                    const next = new Set(selectedDetailIds)
                                    if (e.target.checked) {
                                      next.add(acc.id)
                                    } else {
                                      next.delete(acc.id)
                                    }
                                    setSelectedDetailIds(next)
                                  }}
                                />
                              </td>
                            )}
                            <td className="px-4 py-2 text-sm text-gray-700">
                              <div className="font-medium">
                                {acc.clientName || 'Cliente sem nome'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {acc.description}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900">
                              {money(acc.value)}
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900">
                              {money(acc.paidValue)}
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900">
                              {money(acc.remainingValue)}
                            </td>
                            <td className="px-4 py-2 text-center text-sm text-gray-600">
                              {dateStr(acc.dueDate)}
                            </td>
                            <td className="px-4 py-2 text-center text-sm">
                              {acc.status === 'pending' ? (
                                acc.type === 'credit' ? (
                                  <span className="text-xs font-semibold text-green-600">
                                    Disponível
                                  </span>
                                ) : acc.dueDate && acc.dueDate < detailToday ? (
                                  <span className="text-xs font-semibold text-red-600">
                                    Vencido
                                  </span>
                                ) : (
                                  <span className="text-xs font-semibold text-orange-600">
                                    A receber
                                  </span>
                                )
                              ) : (
                                <span className="text-xs font-semibold text-green-600">
                                  Recebido
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right relative">
                              <button
                                className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 text-gray-500"
                                onClick={e => {
                                  e.stopPropagation()
                                  setDetailMenuOpenId(
                                    detailMenuOpenId === acc.id ? null : acc.id
                                  )
                                }}
                              >
                                <span className="text-lg leading-none">⋮</span>
                              </button>
                              {detailMenuOpenId === acc.id && (
                                <div className="absolute right-0 mt-2 w-32 bg-white rounded-md shadow-lg border border-gray-100 z-10">
                                  <button
                                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                                    onClick={() => {
                                      setDetailMenuOpenId(null)
                                    }}
                                  >
                                    Promissória
                                  </button>
                                  <button
                                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                                    onClick={() => {
                                      setDetailMenuOpenId(null)
                                    }}
                                  >
                                    Pagamentos
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {receiveInfoOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl">
            <div className="px-6 pt-4 border-b flex items-center justify-between">
              <div className="text-base font-semibold text-gray-800">
                Informações do Pagamento
              </div>
              <button
                className="text-sm text-gray-500 hover:text-gray-700"
                onClick={() => {
                  setReceiveInfoOpen(false)
                  setReceiveTargetAccounts([])
                }}
              >
                Voltar
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="text-sm font-semibold text-red-500">
                ↓ Débitos
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-bold text-gray-600">
                        Conta
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-bold text-gray-600">
                        Valor original
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-bold text-gray-600">
                        Em aberto
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-bold text-gray-600">
                        Pagamento
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-bold text-gray-600">
                        Valor pago
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {receiveTargetAccounts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-6 text-center text-sm text-gray-500"
                        >
                          Nenhuma conta selecionada.
                        </td>
                      </tr>
                    ) : (
                      receiveTargetAccounts.map(acc => {
                        const original = Number(acc.value || 0)
                        const remaining = Number(
                          acc.remainingValue ?? acc.value ?? 0
                        )
                        const paid = Number(acc.paidValue ?? 0)
                        const paymentNow = remaining

                        return (
                          <tr key={acc.id}>
                            <td className="px-4 py-2 text-sm text-gray-700">
                              <div className="font-medium">
                                {acc.clientName || 'Cliente sem nome'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {acc.description}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900">
                              {money(original)}
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900">
                              {money(remaining)}
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900">
                              {money(paymentNow)}
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900">
                              {money(paid)}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="text-sm text-gray-600"></div>
                <div className="text-sm text-gray-700">
                  Total a receber:{' '}
                  <span className="font-semibold">
                    {money(receiveTotal)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded"
                  onClick={() => {
                    setReceiveInfoOpen(false)
                    setReceiveTargetAccounts([])
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded"
                  onClick={() => {
                    if (receiveTargetAccounts.length === 0) {
                      setReceiveInfoOpen(false)
                      return
                    }
                    setReceiveInfoOpen(false)
                    setReceivePayMethodsOpen(true)
                  }}
                >
                  Receber
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <NewAccountReceivableModal
          storeId={storeId}
          onClose={() => {
            setIsModalOpen(false)
            setEditingAccount(null)
          }}
          onSave={handleSave}
          onDelete={handleDelete}
          isLoading={isLoading}
          initialData={editingAccount}
          defaultType={modalType}
        />
      )}

      <SalesDateFilterModal 
        open={dateFilterOpen}
        onClose={() => setDateFilterOpen(false)}
        onApply={setDateRange}
        currentLabel={dateRange.label}
      />

      {receivePayMethodsOpen && (
        <PaymentMethodsModal
          storeId={storeId}
          open={receivePayMethodsOpen}
          onClose={() => {
            setReceivePayMethodsOpen(false)
            setReceivePayments([])
            setReceiveSelectedMethod(null)
          }}
          remaining={receiveRemaining}
          payments={receivePayments}
          onRemovePayment={idx =>
            setReceivePayments(prev =>
              prev.filter((_, i) => i !== idx)
            )
          }
          onChooseMethod={m => {
            if (!receiveRemaining || receiveRemaining <= 0) return
            setReceiveSelectedMethod(m)
            setReceivePayAmountInput(
              String(receiveRemaining.toFixed(2))
            )
            setReceivePayError('')
            setReceivePayAmountOpen(true)
          }}
          onConfirm={finalizeReceivePayments}
        />
      )}

      {receivePayAmountOpen && (
        <PaymentAmountModal
          open={receivePayAmountOpen}
          onClose={() => setReceivePayAmountOpen(false)}
          method={receiveSelectedMethod}
          remaining={receiveRemaining}
          amount={receivePayAmountInput}
          setAmount={setReceivePayAmountInput}
          error={receivePayError}
          setError={setReceivePayError}
          onConfirm={() => {
            const amt = parseFloat(receivePayAmountInput) || 0
            if (!receiveSelectedMethod) return
            const remaining = receiveRemaining
            const applied = Math.min(amt, remaining)
            if (applied <= 0) {
              setReceivePayError('Valor deve ser maior que zero')
              return
            }
            const newPayment = {
              method: receiveSelectedMethod.label,
              methodCode: receiveSelectedMethod.code,
              amount: applied,
              date: new Date()
            }
            setReceivePayments(prev => [...prev, newPayment])
            setReceivePayAmountOpen(false)
          }}
        />
      )}
    </div>
  )
}
