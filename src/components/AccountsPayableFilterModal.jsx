import React, { useState, useEffect } from 'react'
import { listenSuppliers } from '../services/suppliers'
import { listenFinancialCategories, addFinancialCategory } from '../services/financialCategories'
import SearchSelectionModal from './SearchSelectionModal'
import NewSupplierModal from './NewSupplierModal'
import NewFinancialCategoryModal from './NewFinancialCategoryModal'

export default function AccountsPayableFilterModal({ 
  open, 
  onClose, 
  onApply, 
  storeId,
  initialSupplierId,
  initialCategoryId
}) {
  const [suppliers, setSuppliers] = useState([])
  const [categories, setCategories] = useState([])
  
  const [selectedSupplierId, setSelectedSupplierId] = useState(initialSupplierId || '')
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategoryId || '')

  const [isSelectingSupplier, setIsSelectingSupplier] = useState(false)
  const [isSelectingCategory, setIsSelectingCategory] = useState(false)

  // Modais de criação
  const [newSupplierOpen, setNewSupplierOpen] = useState(false)
  const [newCategoryOpen, setNewCategoryOpen] = useState(false)
  const [catLoading, setCatLoading] = useState(false)

  useEffect(() => {
    if (open && storeId) {
      const unsubSuppliers = listenSuppliers((data) => {
        setSuppliers(data)
      }, storeId)
      
      const unsubCategories = listenFinancialCategories((data) => {
        setCategories(data)
      }, storeId)
      
      return () => {
        if (unsubSuppliers) unsubSuppliers()
        if (unsubCategories) unsubCategories()
      }
    }
  }, [open, storeId])

  // Sincroniza estado interno quando abre o modal com valores iniciais
  useEffect(() => {
    if (open) {
      setSelectedSupplierId(initialSupplierId || '')
      setSelectedCategoryId(initialCategoryId || '')
    }
  }, [open, initialSupplierId, initialCategoryId])

  if (!open) return null

  const handleApply = () => {
    onApply({
      supplierId: selectedSupplierId,
      categoryId: selectedCategoryId
    })
    onClose()
  }

  const handleClear = () => {
    setSelectedSupplierId('')
    setSelectedCategoryId('')
  }

  const getSupplierName = () => {
    if (!selectedSupplierId) return 'Todos os fornecedores'
    const s = suppliers.find(x => x.id === selectedSupplierId)
    return s ? s.name : 'Fornecedor não encontrado'
  }

  const getCategoryName = () => {
    if (!selectedCategoryId) return 'Todas as categorias'
    const c = categories.find(x => x.id === selectedCategoryId)
    return c ? c.name : 'Categoria não encontrada'
  }

  const handleSaveCategory = async (data) => {
    try {
      setCatLoading(true)
      await addFinancialCategory(data, storeId)
      setNewCategoryOpen(false)
    } catch (error) {
      console.error(error)
      alert('Erro ao criar categoria')
    } finally {
      setCatLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
         <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700">
               <h3 className="text-lg font-bold text-gray-800 dark:text-white">Filtrar</h3>
            </div>
            
            <div className="p-6 space-y-6">
               {/* Fornecedor */}
               <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">Fornecedor</label>
                  <button
                     onClick={() => setIsSelectingSupplier(true)}
                     className="w-full text-left bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-3 px-4 rounded-lg flex justify-between items-center hover:bg-white dark:hover:bg-gray-600 hover:border-green-500 dark:hover:border-green-500 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  >
                     <span className={selectedSupplierId ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400'}>
                       {getSupplierName()}
                     </span>
                     <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                     </svg>
                  </button>
               </div>

               {/* Categoria */}
               <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">Categoria</label>
                  <button
                     onClick={() => setIsSelectingCategory(true)}
                     className="w-full text-left bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-3 px-4 rounded-lg flex justify-between items-center hover:bg-white dark:hover:bg-gray-600 hover:border-green-500 dark:hover:border-green-500 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500/20"
                  >
                     <span className={selectedCategoryId ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400'}>
                       {getCategoryName()}
                     </span>
                     <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                     </svg>
                  </button>
               </div>
               
               <div className="flex justify-center pt-2">
                  <button 
                    onClick={handleClear}
                    className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium hover:underline transition-colors"
                  >
                    Limpar Filtros
                  </button>
               </div>
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-end gap-3">
               <button 
                  onClick={onClose}
                  className="px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium text-sm transition-colors flex items-center gap-1"
               >
                  ✕ Cancelar
               </button>
               <button 
                  onClick={handleApply}
                  className="px-6 py-2 bg-green-600 dark:bg-green-600 hover:bg-green-700 dark:hover:bg-green-500 text-white font-bold rounded-lg shadow-sm text-sm transition-colors transform active:scale-95"
               >
                  Filtrar
               </button>
            </div>
         </div>
      </div>

      <SearchSelectionModal
        open={isSelectingSupplier}
        onClose={() => setIsSelectingSupplier(false)}
        title="Selecionar Fornecedor"
        items={suppliers}
        onSelect={(item) => {
          setSelectedSupplierId(item.id)
          setIsSelectingSupplier(false)
        }}
        onNew={() => setNewSupplierOpen(true)}
      />

      <SearchSelectionModal
        open={isSelectingCategory}
        onClose={() => setIsSelectingCategory(false)}
        title="Selecionar Categoria"
        items={categories}
        onSelect={(item) => {
          setSelectedCategoryId(item.id)
          setIsSelectingCategory(false)
        }}
        onNew={() => setNewCategoryOpen(true)}
      />

      {newSupplierOpen && (
        <NewSupplierModal
          open={newSupplierOpen}
          onClose={() => setNewSupplierOpen(false)}
          storeId={storeId}
        />
      )}

      {newCategoryOpen && (
        <NewFinancialCategoryModal
          onClose={() => setNewCategoryOpen(false)}
          onSave={handleSaveCategory}
          isLoading={catLoading}
        />
      )}
    </>
  )
}

