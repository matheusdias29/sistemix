import React, { useState, useEffect } from 'react'
import { listenFinancialCategories, addFinancialCategory, updateFinancialCategory, deleteFinancialCategory } from '../services/financialCategories'
import NewFinancialCategoryModal from './NewFinancialCategoryModal'

export default function FinancialCategoriesTab({ storeId }) {
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // 'all', 'active', 'inactive'
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!storeId) return
    const unsub = listenFinancialCategories((items) => {
      setCategories(items)
    }, storeId)
    return () => unsub()
  }, [storeId])

  const filtered = categories.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' 
      ? true 
      : filterStatus === 'active' 
        ? c.active 
        : !c.active
    return matchSearch && matchStatus
  })

  const handleSave = async (data) => {
    try {
      setIsLoading(true)
      if (data.id) {
        // Edit
        await updateFinancialCategory(data.id, {
          name: data.name,
          type: data.type,
          active: data.active
        })
      } else {
        // Create
        await addFinancialCategory(data, storeId)
      }
      setIsModalOpen(false)
      setEditingCategory(null)
    } catch (error) {
      console.error(error)
      alert('Erro ao salvar categoria')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      setIsLoading(true)
      await deleteFinancialCategory(id)
      setIsModalOpen(false)
      setEditingCategory(null)
    } catch (error) {
      console.error(error)
      alert('Erro ao excluir categoria')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (cat) => {
    setEditingCategory(cat)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingCategory(null)
  }

  // Helper para ícone
  const renderIcon = (type) => {
    if (type === 'in') {
      return (
        <div className="w-6 h-6 rounded-full border border-green-500 flex items-center justify-center text-green-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        </div>
      )
    }
    return (
      <div className="w-6 h-6 rounded-full border border-red-500 flex items-center justify-center text-red-500">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      {/* Top Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <div className="flex flex-col gap-3 w-full md:w-auto flex-1">
          {/* Search */}
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-400">🔍</span>
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg leading-5 bg-gray-100 dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:bg-white dark:focus:bg-gray-800 focus:ring-1 focus:ring-green-500 sm:text-sm transition duration-150 ease-in-out text-gray-900 dark:text-white"
              placeholder="Pesquisar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Status Filters */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus(filterStatus === 'active' ? 'all' : 'active')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterStatus === 'active' 
                  ? 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' 
                  : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
              }`}
            >
              ✓ Ativo
            </button>
            <button
              onClick={() => setFilterStatus(filterStatus === 'inactive' ? 'all' : 'inactive')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterStatus === 'inactive' 
                  ? 'bg-gray-200 text-gray-800 border border-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:border-gray-500' 
                  : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
              }`}
            >
              Inativo
            </button>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors dark:bg-green-600 dark:hover:bg-green-500"
        >
          <span>+ Novo</span>
        </button>
      </div>

      {/* Table/List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Nome
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="2" className="px-6 py-10 text-center text-gray-500 dark:text-gray-400 text-sm">
                  Nenhuma categoria encontrada.
                </td>
              </tr>
            ) : (
              filtered.map((cat) => (
                <tr 
                  key={cat.id} 
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                  onClick={() => handleEdit(cat)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 mr-3">
                        {renderIcon(cat.type)}
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {cat.name}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      cat.active 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {cat.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <NewFinancialCategoryModal
          initialData={editingCategory}
          onClose={handleCloseModal}
          onSave={handleSave}
          onDelete={handleDelete}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}
