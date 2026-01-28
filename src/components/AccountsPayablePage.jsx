import React, { useState, useEffect, useMemo } from 'react'
import FinancialCategoriesTab from './FinancialCategoriesTab'
import NewAccountPayableModal from './NewAccountPayableModal'
import SalesDateFilterModal from './SalesDateFilterModal'
import AccountsPayableFilterModal from './AccountsPayableFilterModal'
import { listenAccountsPayable, addAccountPayable, updateAccountPayable, removeAccountPayable } from '../services/accountsPayable'
// import { getOpenCashRegister, addCashTransaction } from '../services/cash' // Removido por solicitação

const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dateStr = (d) => {
  if (!d) return '-'
  // Se for string YYYY-MM-DD
  if (typeof d === 'string' && d.includes('-')) {
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }
  // Se for timestamp
  if (d?.toDate) return d.toDate().toLocaleDateString('pt-BR')
  return '-'
}

export default function AccountsPayablePage({ storeId }) {
  const [activeTab, setActiveTab] = useState('accounts') // 'accounts' or 'categories'
  const [accounts, setAccounts] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('pending') // 'pending' (A Pagar), 'paid' (Pago), 'cancelled' (Cancelado)
  
  // Date Filter
  const [dateFilterLabel, setDateFilterLabel] = useState('Todos')
  const [dateFilterStart, setDateFilterStart] = useState(null)
  const [dateFilterEnd, setDateFilterEnd] = useState(null)
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false)

  const [sortBy, setSortBy] = useState('dueDate')
  const [isSortOpen, setIsSortOpen] = useState(false)

  // Advanced Filters
  const [filterSupplierId, setFilterSupplierId] = useState('')
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  // Seleção
  const [selectedIds, setSelectedIds] = useState(new Set())

  useEffect(() => {
    if (!storeId) return
    const unsub = listenAccountsPayable((items) => {
      setAccounts(items)
    }, storeId)
    return () => unsub()
  }, [storeId])

  const filtered = useMemo(() => {
    return accounts.filter(acc => {
      // Filtro de status
      if (statusFilter === 'pending' && acc.status !== 'pending') return false
      if (statusFilter === 'paid' && acc.status !== 'paid') return false
      if (statusFilter === 'cancelled' && acc.status !== 'cancelled') return false
      
      // Filtro de data
      if (dateFilterStart && dateFilterEnd) {
        if (!acc.dueDate) return false
        let d = null
        if (typeof acc.dueDate === 'string') {
           // YYYY-MM-DD
           d = new Date(acc.dueDate + 'T12:00:00') 
        } else if (acc.dueDate?.toDate) {
           d = acc.dueDate.toDate()
        }
        
        if (!d) return false
        // Zera horas para comparação segura se necessário, mas o filtro já manda 00:00 e 23:59
        if (d < dateFilterStart || d > dateFilterEnd) return false
      }

      // Filtro Avançado (Fornecedor e Categoria)
      if (filterSupplierId && acc.supplierId !== filterSupplierId) return false
      if (filterCategoryId && acc.categoryId !== filterCategoryId) return false

      // Busca
      const s = search.toLowerCase()
      const match = (
        (acc.description && acc.description.toLowerCase().includes(s)) ||
        (acc.supplierName && acc.supplierName.toLowerCase().includes(s)) ||
        (acc.categoryName && acc.categoryName.toLowerCase().includes(s))
      )
      return match
    })
  }, [accounts, search, statusFilter, dateFilterStart, dateFilterEnd, filterSupplierId, filterCategoryId])

  const totalValue = useMemo(() => {
    return filtered.reduce((acc, curr) => acc + (curr.remainingValue || 0), 0)
  }, [filtered])

  const selectedTotal = useMemo(() => {
    return filtered
      .filter(f => selectedIds.has(f.id))
      .reduce((acc, curr) => acc + (curr.remainingValue || 0), 0)
  }, [filtered, selectedIds])

  const sorted = useMemo(() => {
    const getDateValue = (d) => {
      if (!d) return 0
      if (typeof d === 'string' && d.includes('-')) {
        return new Date(d + 'T00:00:00').getTime()
      }
      if (d?.toDate) {
        return d.toDate().getTime()
      }
      return 0
    }

    const copy = [...filtered]

    if (sortBy === 'createdAt') {
      copy.sort((a, b) => getDateValue(a.createdAt) - getDateValue(b.createdAt))
    } else {
      copy.sort((a, b) => getDateValue(a.dueDate) - getDateValue(b.dueDate))
    }

    return copy
  }, [filtered, sortBy])

  const handleSave = async (data) => {
    try {
      setIsLoading(true)
      
      if (data.id) {
        // Atualizar
        const existingAccount = accounts.find(a => a.id === data.id)
        const newOriginalValue = Number(data.value || 0)
        const paidValue = existingAccount ? existingAccount.paidValue : 0
        const newRemainingValue = newOriginalValue - paidValue

        const updateData = {
          supplierId: data.supplierId,
          supplierName: data.supplierName,
          description: data.description,
          categoryId: data.categoryId,
          categoryName: data.categoryName,
          details: data.details,
          isRecurring: data.isRecurring,
          originalValue: newOriginalValue,
          remainingValue: newRemainingValue,
          dueDate: data.dueDate
        }

        await updateAccountPayable(data.id, updateData)
      } else {
        // Criar (pode ser um array ou um objeto único)
        if (Array.isArray(data)) {
          // Processar array de parcelas
          await Promise.all(data.map(item => addAccountPayable(item, storeId)))
        } else {
          // Processar item único
          await addAccountPayable(data, storeId)
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
      await removeAccountPayable(id)
      setIsModalOpen(false)
      setEditingAccount(null)
    } catch (error) {
      console.error(error)
      alert('Erro ao excluir conta')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (account) => {
    setEditingAccount(account)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingAccount(null)
  }

  const handlePaySelected = async () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`Confirma o pagamento de ${selectedIds.size} conta(s) no total de ${money(selectedTotal)}?`)) return

    try {
      setIsLoading(true)
      const ids = Array.from(selectedIds)
      
      // Busca caixa aberto (Removido: não lançar mais no caixa)
      // const openCash = await getOpenCashRegister(storeId)

      // Processa pagamentos em paralelo
      await Promise.all(ids.map(async (id) => {
        const acc = accounts.find(a => a.id === id)
        if (!acc) return
        
        // const payAmount = Number(acc.remainingValue ?? acc.originalValue ?? 0)

        await updateAccountPayable(id, {
          status: 'paid',
          paidValue: acc.originalValue, // Assume pagamento total por enquanto
          remainingValue: 0,
          paymentDate: new Date().toISOString().split('T')[0] // Data de hoje YYYY-MM-DD
        })

        // Lança no caixa (Removido por solicitação)
        /*
        if (openCash && payAmount > 0) {
          await addCashTransaction(openCash.id, {
            type: 'account_payable',
            value: -payAmount, 
            description: `Pagamento Conta: ${acc.description || ''} (${acc.supplierName || 'Fornecedor'})`,
            categoryId: acc.categoryId || null,
            categoryName: acc.categoryName || null,
            paymentMethod: 'Dinheiro', 
            date: new Date()
          })
        }
        */
      }))

      setSelectedIds(new Set()) // Limpa seleção
      alert('Pagamentos realizados com sucesso!')
    } catch (error) {
      console.error(error)
      alert('Erro ao processar pagamentos')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSelect = (id) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(f => f.id)))
    }
  }

  return (
    <div className="w-full">
      {/* Header / Tabs */}
      <div className="mb-6">
        
        <div className="flex gap-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
              activeTab === 'accounts'
                ? 'text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Contas A Pagar
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
              activeTab === 'categories'
                ? 'text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Categorias
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mt-4">
        {activeTab === 'accounts' ? (
          <div className="animate-fade-in space-y-4">
            
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto flex-1">
                {/* Search */}
                <div className="relative w-full md:max-w-xs bg-gray-100 rounded-lg">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400">🔍</span>
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 bg-transparent border-none focus:ring-0 text-sm placeholder-gray-400"
                    placeholder="Pesquisar..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>

                {/* Filtros Botões */}
                <div className="flex gap-2">
                   <button 
                     onClick={() => setIsDateFilterOpen(true)}
                     className={`px-3 py-2 border rounded-lg text-sm font-medium shadow-sm flex items-center gap-2 ${
                       dateFilterLabel !== 'Todos' 
                         ? 'bg-green-50 text-green-700 border-green-200' 
                         : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                     }`}
                   >
                     📄 {dateFilterLabel !== 'Todos' ? dateFilterLabel : 'Filtrar Vencimento'}
                   </button>
                   <button 
                     onClick={() => setIsFilterModalOpen(true)}
                     className={`px-3 py-2 border rounded-lg text-sm font-medium shadow-sm flex items-center gap-2 ${
                       (filterSupplierId || filterCategoryId)
                         ? 'bg-green-50 text-green-700 border-green-200' 
                         : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                     }`}
                   >
                     ⚙ Filtros {(filterSupplierId || filterCategoryId) ? '(Ativo)' : ''}
                   </button>
                   <div className="relative">
                     <button
                       type="button"
                       onClick={() => setIsSortOpen(prev => !prev)}
                       className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 font-medium hover:bg-gray-50 shadow-sm flex items-center gap-2"
                     >
                       ⇅
                     </button>
                     {isSortOpen && (
                       <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                         <button
                           type="button"
                           onClick={() => {
                             setSortBy('dueDate')
                             setIsSortOpen(false)
                           }}
                           className={`w-full text-left px-3 py-2 text-xs ${
                             sortBy === 'dueDate'
                               ? 'bg-green-50 text-green-700'
                               : 'text-gray-700 hover:bg-gray-50'
                           }`}
                         >
                           Data de Vencimento
                         </button>
                         <button
                           type="button"
                           onClick={() => {
                             setSortBy('createdAt')
                             setIsSortOpen(false)
                           }}
                           className={`w-full text-left px-3 py-2 text-xs border-t border-gray-100 ${
                             sortBy === 'createdAt'
                               ? 'bg-green-50 text-green-700'
                               : 'text-gray-700 hover:bg-gray-50'
                           }`}
                         >
                           Data de Criação
                         </button>
                       </div>
                     )}
                   </div>
                </div>
              </div>

              <div className="flex gap-3 w-full md:w-auto justify-end">
                <button className="px-4 py-2 bg-white border border-green-600 text-green-600 rounded-lg text-sm font-medium hover:bg-green-50 shadow-sm">
                  Exportar
                </button>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 shadow-sm flex items-center gap-2"
                >
                  + Novo
                </button>
              </div>
            </div>

            {/* Tabs Status */}
            <div className="flex gap-2 border-b border-transparent">
              <button 
                onClick={() => setStatusFilter('pending')}
                className={`px-4 py-1 rounded-full text-xs font-bold transition-colors border ${statusFilter === 'pending' ? 'bg-orange-100 text-orange-600 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'}`}
              >
                ✓ A Pagar
              </button>
              <button 
                onClick={() => setStatusFilter('paid')}
                className={`px-4 py-1 rounded-full text-xs font-bold transition-colors border ${statusFilter === 'paid' ? 'bg-green-100 text-green-600 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'}`}
              >
                ✓ Pago
              </button>
              <button 
                onClick={() => setStatusFilter('cancelled')}
                className={`px-4 py-1 rounded-full text-xs font-bold transition-colors border ${statusFilter === 'cancelled' ? 'bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'}`}
              >
                Cancelado
              </button>
            </div>

            {/* Total Bar */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 flex justify-between items-center border border-gray-100 dark:border-gray-700">
               <div>
                 <span className="text-xs text-gray-500 dark:text-gray-400 font-medium block mb-1">Total</span>
                 <span className={`text-xl font-bold ${statusFilter === 'pending' ? 'text-green-600 dark:text-green-400' : 'text-gray-800 dark:text-white'}`}>
                   {money(totalValue)}
                 </span>
               </div>
               
               {statusFilter === 'pending' && selectedIds.size > 0 ? (
                 <div className="flex items-center gap-4 animate-fade-in">
                   <span className="text-sm text-gray-600 dark:text-gray-300">
                     Valor a pagar: <span className="font-bold text-gray-800 dark:text-white">{money(selectedTotal)}</span>
                   </span>
                   <button 
                     onClick={handlePaySelected}
                     className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded shadow-sm transition-colors"
                   >
                     Pagar
                   </button>
                 </div>
               ) : (
                 <span className="text-xs text-gray-400 dark:text-gray-500">Selecione as contas que deseja pagar</span>
               )}
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left w-10">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600"
                        checked={filtered.length > 0 && selectedIds.size === filtered.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-sm font-bold text-gray-600 dark:text-gray-300">Conta</th>
                    <th scope="col" className="px-4 py-3 text-right text-sm font-bold text-gray-600 dark:text-gray-300">Valor Original</th>
                    <th scope="col" className="px-4 py-3 text-right text-sm font-bold text-gray-600 dark:text-gray-300">Valor Pago</th>
                    <th scope="col" className="px-4 py-3 text-right text-sm font-bold text-gray-600 dark:text-gray-300">A Pagar</th>
                    <th scope="col" className="px-4 py-3 text-center text-sm font-bold text-gray-600 dark:text-gray-300">Vencimento</th>
                    <th scope="col" className="px-4 py-3 text-center text-sm font-bold text-gray-600 dark:text-gray-300">Data de Pagamento</th>
                    <th scope="col" className="px-4 py-3 text-center text-sm font-bold text-gray-600 dark:text-gray-300">Status</th>
                    <th scope="col" className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-6 py-10 text-center text-gray-500 dark:text-gray-400 text-sm">
                        Nenhuma conta encontrada.
                      </td>
                    </tr>
                  ) : (
                    sorted.map((acc) => (
                      <tr 
                        key={acc.id} 
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                        onClick={(e) => {
                          if (e.target.type === 'checkbox') return
                          handleEdit(acc)
                        }}
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                           <input 
                             type="checkbox" 
                             className="rounded border-gray-300 text-green-600 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600"
                             checked={selectedIds.has(acc.id)}
                             onChange={() => toggleSelect(acc.id)}
                           />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-900 dark:text-white uppercase">{acc.supplierName || 'Fornecedor Desconhecido'}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{acc.description} | {acc.categoryName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                          {money(acc.originalValue)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                          {money(acc.paidValue)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                          {money(acc.remainingValue)}
                        </td>
                        <td className={`px-4 py-4 whitespace-nowrap text-center text-sm ${acc.status === 'pending' ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                          {dateStr(acc.dueDate)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400">
                          {dateStr(acc.paymentDate)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            acc.status === 'pending' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                            acc.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {acc.status === 'pending' ? 'A Pagar' : acc.status === 'paid' ? 'Pago' : 'Cancelado'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer">
                          ⋮
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        ) : (
          <FinancialCategoriesTab storeId={storeId} />
        )}
      </div>

      <SalesDateFilterModal
        open={isDateFilterOpen}
        onClose={() => setIsDateFilterOpen(false)}
        currentLabel={dateFilterLabel}
        onApply={({ label, start, end }) => {
          setDateFilterLabel(label)
          setDateFilterStart(start)
          setDateFilterEnd(end)
        }}
      />

      <AccountsPayableFilterModal
        open={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        storeId={storeId}
        initialSupplierId={filterSupplierId}
        initialCategoryId={filterCategoryId}
        onApply={({ supplierId, categoryId }) => {
          setFilterSupplierId(supplierId)
          setFilterCategoryId(categoryId)
        }}
      />

      {isModalOpen && (
        <NewAccountPayableModal
          storeId={storeId}
          initialData={editingAccount}
          onClose={handleCloseModal}
          onSave={handleSave}
          onDelete={handleDelete}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}
