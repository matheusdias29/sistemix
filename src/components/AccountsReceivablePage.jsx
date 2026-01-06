import React, { useState, useEffect, useMemo } from 'react'
import { listenAccountsReceivable, addAccountReceivable, updateAccountReceivable, removeAccountReceivable } from '../services/accountsReceivable'
import NewAccountReceivableModal from './NewAccountReceivableModal'
import SalesDateFilterModal from './SalesDateFilterModal'

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

  // Estado para expandir clientes
  const [expandedClients, setExpandedClients] = useState({}) // { clientId: true/false }

  useEffect(() => {
    const unsub = listenAccountsReceivable((items) => {
      setAccounts(items)
    }, storeId)
    return () => unsub()
  }, [storeId])

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

      // Agrupamento
      const key = acc.receivedBy || 'Sem Funcionário'
      if (!groups[key]) {
        groups[key] = {
          receivedBy: acc.receivedBy || 'Sem Funcionário',
          items: [],
          totalDebit: 0,
          totalOverdue: 0,
          totalCredit: 0, // Total de créditos desse cliente
          countReceivable: 0,
          countOverdue: 0,
          countCredit: 0
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
    })

    return {
      grouped: Object.values(groups),
      totalReceivable: tReceivable,
      totalOverdue: tOverdue,
      totalCredits: tCredits
    }
  }, [accounts, search, filterType, dateRange])

  const toggleExpand = (key) => {
    setExpandedClients(prev => ({ ...prev, [key]: !prev[key] }))
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
             <div className="relative w-full md:max-w-xs bg-gray-100 rounded-lg">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-400">🔍</span>
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 bg-transparent border-none focus:ring-0 text-gray-700 placeholder-gray-400 text-base"
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
                    ? 'bg-green-50 text-green-700 border-green-200' 
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span>📅</span> {dateRange.label === 'Todos' ? 'Filtrar Vencimento' : dateRange.label}
              </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 w-full md:w-auto justify-end items-center relative">
             <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
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
                 <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-100 z-20 overflow-hidden animate-in fade-in zoom-in duration-200">
                   <button 
                     onClick={() => {
                       setModalType('receivable')
                       setEditingAccount(null)
                       setIsModalOpen(true)
                       setIsDropdownOpen(false)
                     }}
                     className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50 transition-colors"
                   >
                     <span className="text-green-600 font-bold text-lg">↓$</span>
                     <span className="text-sm font-medium text-gray-700">Conta a receber</span>
                   </button>
                   <button 
                     onClick={() => {
                       setModalType('credit')
                       setEditingAccount(null)
                       setIsModalOpen(true)
                       setIsDropdownOpen(false)
                     }}
                     className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                   >
                     <span className="text-green-600 font-bold text-lg">+$</span>
                     <span className="text-sm font-medium text-gray-700">Crédito ao cliente</span>
                   </button>
                 </div>
               )}
             </div>
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-4">
           <div className="flex bg-gray-200 rounded-full p-1">
              <button 
                onClick={() => setFilterType('pending')}
                className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${filterType === 'pending' ? 'bg-green-100 text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
              >
                ✓ A Receber
              </button>
              <button 
                onClick={() => setFilterType('all')}
                className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${filterType === 'all' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
              >
                Todos
              </button>
           </div>
        </div>

        {/* Totals Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div>
             <span className="text-sm text-gray-500 font-medium block mb-1">Total A Receber</span>
             <span className="text-2xl font-bold text-green-600">{money(totalReceivable)}</span>
           </div>
           <div>
             <span className="text-sm text-gray-500 font-medium block mb-1">Total Vencido</span>
             <span className="text-2xl font-bold text-red-500">{money(totalOverdue)}</span>
           </div>
           <div>
             <span className="text-sm text-gray-500 font-medium block mb-1">Total Créditos</span>
             <span className="text-2xl font-bold text-green-600">{money(totalCredits)}</span>
           </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
           <table className="min-w-full divide-y divide-gray-100">
             <thead className="bg-gray-50">
               <tr>
                 <th scope="col" className="px-6 py-3 text-left text-sm font-bold text-gray-600">Funcionário</th>
                 <th scope="col" className="px-6 py-3 text-right text-sm font-bold text-gray-600">Valor Débito</th>
                 <th scope="col" className="px-6 py-3 text-right text-sm font-bold text-gray-600">Valor Vencido</th>
                 <th scope="col" className="px-6 py-3 text-right text-sm font-bold text-gray-600">Valor Crédito</th>
                 <th scope="col" className="px-6 py-3 text-right text-sm font-bold text-gray-600">Status</th>
               </tr>
             </thead>
             <tbody className="bg-white divide-y divide-gray-100">
               {grouped.length === 0 ? (
                 <tr>
                   <td colSpan="5" className="px-6 py-10 text-center text-gray-500">
                     Nenhuma conta encontrada.
                   </td>
                 </tr>
               ) : (
                 grouped.map((group, idx) => {
                    const groupKey = group.receivedBy || idx
                    const isExpanded = expandedClients[groupKey]
                    
                    return (
                      <React.Fragment key={groupKey}>
                        <tr 
                          className="hover:bg-gray-50 transition-colors cursor-pointer group"
                          onClick={() => toggleExpand(groupKey)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-700 uppercase">{group.receivedBy}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="text-sm text-red-500">{money(group.totalDebit)}</div>
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
                        
                        {/* Expanded Details */}
                        {isExpanded && (
                          <tr className="bg-gray-50">
                            <td colSpan="5" className="px-6 py-4">
                               <div className="border rounded-lg bg-white overflow-hidden">
                                 <table className="min-w-full divide-y divide-gray-100">
                                   <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-sm font-bold text-gray-600">Cliente</th>
                                        <th className="px-4 py-2 text-left text-sm font-bold text-gray-600">Descrição</th>
                                        <th className="px-4 py-2 text-center text-sm font-bold text-gray-600">Vencimento</th>
                                        <th className="px-4 py-2 text-right text-sm font-bold text-gray-600">Valor</th>
                                        <th className="px-4 py-2 text-center text-sm font-bold text-gray-600">Status</th>
                                        <th className="px-4 py-2 w-10"></th>
                                      </tr>
                                   </thead>
                                   <tbody className="divide-y divide-gray-50">
                                      {group.items.map(item => (
                                        <tr key={item.id} className="hover:bg-gray-50">
                                           <td className="px-4 py-2 text-sm text-gray-700 font-medium">
                                              {item.clientName || 'Cliente Sem Nome'}
                                           </td>
                                           <td className="px-4 py-2 text-sm text-gray-700">
                                              {item.type === 'credit' && <span className="text-green-600 font-bold mr-1">[CRÉDITO]</span>}
                                              {item.description}
                                           </td>
                                           <td className="px-4 py-2 text-center text-sm text-gray-600">{dateStr(item.dueDate)}</td>
                                           <td className="px-4 py-2 text-right text-sm text-gray-900">{money(item.remainingValue)}</td>
                                           <td className="px-4 py-2 text-center">
                                              {item.status === 'pending' ? (
                                                item.type === 'credit' ? (
                                                  <span className="text-xs text-green-600 font-bold">Disponível</span>
                                                ) : (
                                                  new Date(item.dueDate) < new Date() 
                                                    ? <span className="text-xs text-red-600 font-bold">Vencido</span>
                                                    : <span className="text-xs text-orange-600 font-bold">Pendente</span>
                                                )
                                              ) : (
                                                <span className="text-xs text-green-600 font-bold">Pago</span>
                                              )}
                                           </td>
                                           <td className="px-4 py-2 text-right">
                                              <button 
                                                className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  setEditingAccount(item)
                                                  setIsModalOpen(true)
                                                }}
                                              >
                                                Editar
                                              </button>
                                           </td>
                                        </tr>
                                      ))}
                                   </tbody>
                                 </table>
                               </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                 })
               )}
             </tbody>
           </table>
        </div>
      </div>

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
    </div>
  )
}
