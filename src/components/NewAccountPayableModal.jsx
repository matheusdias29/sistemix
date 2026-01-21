import React, { useState, useEffect } from 'react'
import Switch from './Switch'
import SelectSupplierModal from './SelectSupplierModal'
import NewSupplierModal from './NewSupplierModal'
import SelectFinancialCategoryModal from './SelectFinancialCategoryModal'
import NewFinancialCategoryModal from './NewFinancialCategoryModal'
import { listenFinancialCategories, addFinancialCategory } from '../services/financialCategories'
import { listenSuppliers } from '../services/suppliers'

export default function NewAccountPayableModal({ onClose, onSave, onDelete, isLoading, storeId, initialData }) {
  const [supplier, setSupplier] = useState(null)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(null)
  const [details, setDetails] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  
  // Lista dinâmica de parcelas/pagamentos
  // Cada item: { id: timestamp/random, value: string, dueDate: string }
  const [items, setItems] = useState([{ id: Date.now(), value: '', dueDate: '' }])

  // Modais de seleção
  const [showSupplierSelect, setShowSupplierSelect] = useState(false)
  const [showCategorySelect, setShowCategorySelect] = useState(false)
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false)
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false)
  const [isSavingCategory, setIsSavingCategory] = useState(false)

  // Dados para seleção
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])

  useEffect(() => {
    if (initialData) {
      setSupplier({ id: initialData.supplierId, name: initialData.supplierName })
      setDescription(initialData.description || '')
      setCategory({ id: initialData.categoryId, name: initialData.categoryName })
      setDetails(initialData.details || '')
      setIsRecurring(initialData.isRecurring || false)
      
      // Carrega o item único como o primeiro da lista
      setItems([{
        id: Date.now(),
        value: initialData.originalValue?.toString() || '',
        dueDate: initialData.dueDate || ''
      }])
    } else {
      setSupplier(null)
      setDescription('')
      setCategory(null)
      setDetails('')
      setIsRecurring(false)
      setItems([{ id: Date.now(), value: '', dueDate: '' }])
    }
  }, [initialData])

  useEffect(() => {
    if (!storeId) return
    const unsubCat = listenFinancialCategories((allCats) => {
      // Mostrar todas as categorias ativas (entrada e saída)
      const valid = allCats.filter(i => i.active)
      setCategories(valid)
    }, storeId)

    const unsubSup = listenSuppliers((items) => {
      setSuppliers(items)
    }, storeId)

    return () => {
      unsubCat()
      unsubSup()
    }
  }, [storeId])

  const handleSaveCategory = async (data) => {
    try {
      setIsSavingCategory(true)
      await addFinancialCategory(data, storeId)
      setShowNewCategoryModal(false)
    } catch (error) {
      console.error(error)
      alert('Erro ao salvar categoria')
    } finally {
      setIsSavingCategory(false)
    }
  }

  const handleAddItem = () => {
    setItems(prev => [...prev, { id: Date.now() + Math.random(), value: '', dueDate: '' }])
  }

  const handleRemoveItem = (id) => {
    if (items.length === 1) {
      // Se for o último, apenas limpa os valores em vez de remover
      updateItem(id, 'value', '')
      updateItem(id, 'dueDate', '')
      return
    }
    setItems(prev => prev.filter(item => item.id !== id))
  }

  const updateItem = (id, field, val) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: val }
      }
      return item
    }))
  }

  const handleSubmit = () => {
    if (!supplier || !description || !category) {
      alert('Preencha Fornecedor, Descrição e Categoria.')
      return
    }

    // Valida itens
    const validItems = items.filter(i => i.value && i.dueDate)
    if (validItems.length === 0) {
      alert('Preencha pelo menos um valor e data de vencimento.')
      return
    }

    if (validItems.length === 1) {
      // Salvar Único
      const item = validItems[0]
      onSave({
        id: initialData?.id,
        supplierId: supplier.id,
        supplierName: supplier.name,
        description,
        categoryId: category.id,
        categoryName: category.name,
        details,
        isRecurring,
        value: parseFloat(item.value.toString().replace(',', '.')),
        dueDate: item.dueDate
      })
    } else {
      // Salvar Múltiplos
      const accounts = validItems.map((item, index) => ({
        supplierId: supplier.id,
        supplierName: supplier.name,
        description: `${description} (${index + 1}/${validItems.length})`,
        categoryId: category.id,
        categoryName: category.name,
        details,
        isRecurring: false, // Parcelas individuais não são recorrentes
        value: parseFloat(item.value.toString().replace(',', '.')),
        dueDate: item.dueDate
      }))
      onSave(accounts)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 font-sans">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">{initialData ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 bg-white">
          
          {/* Fornecedor */}
          <div 
            className="bg-gray-100 p-3 rounded-lg border border-transparent hover:border-gray-300 cursor-pointer transition-colors flex justify-between items-center group"
            onClick={() => setShowSupplierSelect(true)}
          >
            <span className={`font-medium ${supplier ? 'text-gray-900' : 'text-gray-500'}`}>
              {supplier ? supplier.name : 'Fornecedor'}
            </span>
            <span className="text-gray-400">›</span>
          </div>

          {/* Descrição */}
          <div className="bg-gray-100 p-3 rounded-lg border border-transparent hover:border-gray-300 transition-colors">
             <input 
               type="text"
               className="w-full bg-transparent text-gray-900 font-medium outline-none placeholder-gray-500"
               placeholder="Descrição"
               value={description}
               onChange={e => setDescription(e.target.value)}
             />
          </div>

          {/* Categoria */}
          <div 
            className="bg-gray-100 p-3 rounded-lg border border-transparent hover:border-gray-300 cursor-pointer transition-colors flex justify-between items-center group"
            onClick={() => setShowCategorySelect(true)}
          >
             <span className={`font-medium ${category ? 'text-gray-900' : 'text-gray-500'}`}>
              {category ? category.name : 'Categoria'}
            </span>
            <span className="text-gray-400">›</span>
          </div>

          {/* Detalhes */}
          <div className="bg-gray-100 p-3 rounded-lg border border-transparent hover:border-gray-300 transition-colors">
             <textarea 
               className="w-full bg-transparent text-gray-900 font-medium outline-none placeholder-gray-500 resize-none h-20"
               placeholder="Detalhes (opcional)"
               value={details}
               onChange={e => setDetails(e.target.value)}
             />
          </div>

          {/* Recorrente Switch */}
          <div className="flex items-center gap-3 px-1">
            <Switch checked={isRecurring} onChange={setIsRecurring} />
            <span className="text-sm font-medium text-gray-700">Conta Recorrente/Fixa</span>
          </div>

          {/* Lista de Itens (Parcelas) */}
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={item.id} className="flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                <div className="bg-gray-100 p-3 rounded-lg flex-1">
                   <div className="flex justify-between items-center">
                     <span className="text-xs text-gray-500 mb-1 block">Valor</span>
                   </div>
                   <input 
                     type="number"
                     step="0.01"
                     className="w-full bg-transparent text-gray-900 font-bold text-lg outline-none placeholder-gray-400 text-right"
                     placeholder="0,00"
                     value={item.value}
                     onChange={e => updateItem(item.id, 'value', e.target.value)}
                   />
                </div>
                
                <div className="bg-gray-100 p-3 rounded-lg flex-1">
                   <div className="flex justify-between items-center">
                     <span className="text-xs text-gray-500 mb-1 block">Data de Vencimento</span>
                   </div>
                   <input 
                     type="date"
                     className="w-full bg-transparent text-gray-900 font-medium outline-none placeholder-gray-400"
                     value={item.dueDate}
                     onChange={e => updateItem(item.id, 'dueDate', e.target.value)}
                   />
                </div>

                <button 
                  onClick={() => handleRemoveItem(item.id)}
                  className="bg-gray-800 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-black transition-colors shrink-0"
                  title="Remover parcela"
                >
                  <span className="text-xs font-bold">&times;</span>
                </button>
              </div>
            ))}
          </div>

          {/* Botão Adicionar Parcela */}
          {!initialData && (
             <button 
               type="button"
               onClick={handleAddItem}
               className="text-green-500 border border-green-500 rounded px-4 py-2 text-sm font-medium hover:bg-green-50 transition-colors inline-block"
             >
               Adicionar Parcela
             </button>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white flex justify-end items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-500 font-medium hover:text-gray-700 transition-colors text-sm flex items-center gap-2"
            >
              <span className="text-lg">&times;</span> Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-6 py-2 bg-green-500 text-white font-medium rounded hover:bg-green-600 shadow-md transition-all transform active:scale-95 disabled:opacity-50 disabled:shadow-none text-sm flex items-center gap-2"
            >
              <span className="text-lg">✓</span> {isLoading ? 'Salvando...' : 'Salvar'}
            </button>
        </div>
      </div>

      {/* Modais Aninhados */}
      {showSupplierSelect && (
        <SelectSupplierModal
          open={showSupplierSelect}
          suppliers={suppliers}
          onClose={() => setShowSupplierSelect(false)}
          onSelect={(s) => {
            setSupplier(s)
            setShowSupplierSelect(false)
          }}
          onNew={() => {
            setShowSupplierSelect(false)
            setShowNewSupplierModal(true)
          }}
        />
      )}

      {showNewSupplierModal && (
        <NewSupplierModal
          open={showNewSupplierModal}
          onClose={() => setShowNewSupplierModal(false)}
          storeId={storeId}
        />
      )}

      {showCategorySelect && (
        <SelectFinancialCategoryModal 
          categories={categories}
          open={showCategorySelect}
          onClose={() => setShowCategorySelect(false)}
          onSelect={(c) => {
            setCategory(c)
            setShowCategorySelect(false)
          }}
          onNew={() => {
            setShowCategorySelect(false)
            setShowNewCategoryModal(true)
          }}
        />
      )}

      {showNewCategoryModal && (
        <NewFinancialCategoryModal
          onClose={() => setShowNewCategoryModal(false)}
          onSave={handleSaveCategory}
          isLoading={isSavingCategory}
        />
      )}
    </div>
  )
}
