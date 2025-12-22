import React, { useState, useEffect } from 'react'
import Switch from './Switch'
import SelectSupplierModal from './SelectSupplierModal'
import { listenFinancialCategories } from '../services/financialCategories'

export default function NewAccountPayableModal({ onClose, onSave, onDelete, isLoading, storeId, initialData }) {
  const [supplier, setSupplier] = useState(null)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(null)
  const [details, setDetails] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [value, setValue] = useState('')
  const [dueDate, setDueDate] = useState('')

  // Modais de seleção
  const [showSupplierSelect, setShowSupplierSelect] = useState(false)
  const [showCategorySelect, setShowCategorySelect] = useState(false)

  // Lista de categorias para o seletor
  const [categories, setCategories] = useState([])

  useEffect(() => {
    if (initialData) {
      setSupplier({ id: initialData.supplierId, name: initialData.supplierName })
      setDescription(initialData.description || '')
      setCategory({ id: initialData.categoryId, name: initialData.categoryName })
      setDetails(initialData.details || '')
      setIsRecurring(initialData.isRecurring || false)
      setValue(initialData.originalValue?.toString() || '') // Usando originalValue pois value não é salvo diretamente no objeto final da lista
      setDueDate(initialData.dueDate || '')
    } else {
      // Reset fields if no initialData (for new entry)
      setSupplier(null)
      setDescription('')
      setCategory(null)
      setDetails('')
      setIsRecurring(false)
      setValue('')
      setDueDate('')
    }
  }, [initialData])

  useEffect(() => {
    if (!storeId) return
    const unsub = listenFinancialCategories((items) => {
      // Filtra apenas ativas e de saída (out) para contas a pagar, se fizer sentido.
      // Geralmente contas a pagar são saídas.
      const valid = items.filter(i => i.active && i.type === 'out')
      setCategories(valid)
    }, storeId)
    return () => unsub()
  }, [storeId])

  const handleSubmit = () => {
    if (!supplier || !description || !category || !value || !dueDate) {
      alert('Preencha os campos obrigatórios')
      return
    }
    
    onSave({
      id: initialData?.id, // Passa ID se estiver editando
      supplierId: supplier.id,
      supplierName: supplier.name,
      description,
      categoryId: category.id,
      categoryName: category.name,
      details,
      isRecurring,
      value: parseFloat(value.toString().replace(',', '.')), // Ajuste simples
      dueDate // String YYYY-MM-DD
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">{initialData ? 'Editar Conta a Pagar' : 'Novo A Pagar'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 bg-[#f9fafb]">
          
          {/* Fornecedor */}
          <div 
            className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:border-green-500 transition-colors flex justify-between items-center group"
            onClick={() => setShowSupplierSelect(true)}
          >
            <div className="flex flex-col">
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Fornecedor</span>
              <span className={`font-medium ${supplier ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                {supplier ? supplier.name : 'Selecionar fornecedor...'}
              </span>
            </div>
            <span className="text-gray-400 group-hover:text-green-500">›</span>
          </div>

          {/* Descrição */}
          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
             <label className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1 block">Descrição</label>
             <input 
               type="text"
               className="w-full text-gray-900 font-medium outline-none placeholder-gray-400"
               placeholder="Ex: Compra de materiais"
               value={description}
               onChange={e => setDescription(e.target.value)}
             />
          </div>

          {/* Categoria */}
          <div className="relative">
             <div 
              className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:border-green-500 transition-colors flex justify-between items-center group"
              onClick={() => setShowCategorySelect(!showCategorySelect)}
            >
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Categoria</span>
                <span className={`font-medium ${category ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                  {category ? category.name : 'Selecionar categoria...'}
                </span>
              </div>
              <span className="text-gray-400 group-hover:text-green-500">›</span>
            </div>

            {/* Dropdown de Categorias */}
            {showCategorySelect && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                {categories.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500 text-center">Nenhuma categoria de saída encontrada.</div>
                ) : (
                  categories.map(cat => (
                    <div 
                      key={cat.id} 
                      className="px-4 py-3 hover:bg-gray-50 cursor-pointer text-sm font-medium text-gray-700 border-b last:border-0 border-gray-100"
                      onClick={() => {
                        setCategory(cat)
                        setShowCategorySelect(false)
                      }}
                    >
                      {cat.name}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Detalhes */}
          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
             <label className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1 block">Detalhes (opcional)</label>
             <textarea 
               className="w-full text-gray-900 font-medium outline-none placeholder-gray-400 resize-none h-20"
               placeholder="Informações adicionais..."
               value={details}
               onChange={e => setDetails(e.target.value)}
             />
          </div>

          {/* Recorrente Switch */}
          <div className="flex items-center gap-3 px-1">
            <Switch checked={isRecurring} onChange={setIsRecurring} />
            <span className="text-sm font-medium text-gray-700">Conta Recorrente/Fixa</span>
          </div>

          {/* Valor e Data */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
               <label className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1 block">Valor</label>
               <input 
                 type="number"
                 step="0.01"
                 className="w-full text-gray-900 font-medium outline-none placeholder-gray-400"
                 placeholder="0,00"
                 value={value}
                 onChange={e => setValue(e.target.value)}
               />
            </div>
            <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
               <label className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1 block">Data de Vencimento</label>
               <input 
                 type="date"
                 className="w-full text-gray-900 font-medium outline-none placeholder-gray-400"
                 value={dueDate}
                 onChange={e => setDueDate(e.target.value)}
               />
            </div>
          </div>

          {/* Botão Adicionar Parcela (Placeholder visual) */}
          <div>
            <button type="button" className="text-green-600 border border-green-600 rounded px-4 py-2 text-sm font-medium hover:bg-green-50 transition-colors">
              Adicionar Parcela
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white flex justify-between items-center gap-3">
          {initialData && onDelete ? (
             <button
               onClick={() => {
                 if (window.confirm('Tem certeza que deseja excluir esta conta?')) {
                   onDelete(initialData.id)
                 }
               }}
               className="px-4 py-2 text-red-500 hover:bg-red-50 rounded transition-colors flex items-center gap-2"
               title="Cancelar/Excluir Conta"
             >
               🗑 Cancelar
             </button>
          ) : (
            <div></div> // Spacer
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 text-gray-600 font-medium hover:text-gray-800 transition-colors"
            >
              ← Voltar
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-6 py-2 bg-green-500 text-white font-medium rounded hover:bg-green-600 shadow-lg shadow-green-500/30 transition-all transform active:scale-95 disabled:opacity-50 disabled:shadow-none"
            >
              {isLoading ? 'Salvando...' : '✓ Salvar'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Seleção de Fornecedor */}
      {showSupplierSelect && (
        <SelectSupplierModal 
          storeId={storeId} 
          onClose={() => setShowSupplierSelect(false)}
          onSelect={(s) => {
            setSupplier(s)
            setShowSupplierSelect(false)
          }}
        />
      )}
    </div>
  )
}
