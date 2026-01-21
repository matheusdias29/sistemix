import React, { useState, useEffect } from 'react'
import { Plus, Lock, ArrowLeft, X, Check } from 'lucide-react'
import clsx from 'clsx'
import { listenPaymentMethods, addPaymentMethod, updatePaymentMethod } from '../services/paymentMethods'

function InstallmentsModal({ open, onClose, onConfirm, initialConfig }) {
  const [config, setConfig] = useState(() => {
    if (initialConfig && initialConfig.length > 0) return initialConfig
    return Array.from({ length: 24 }, (_, i) => ({ count: i + 1, active: i === 0, tax: '' }))
  })

  // Update config when initialConfig changes (and modal is open) or when reopening
  useEffect(() => {
    if (open) {
      if (initialConfig && initialConfig.length > 0) {
        setConfig(initialConfig)
      } else {
        setConfig(Array.from({ length: 24 }, (_, i) => ({ count: i + 1, active: i === 0, tax: '' })))
      }
    }
  }, [open, initialConfig])

  const handleToggle = (index) => {
    setConfig(prev => {
      const newConfig = [...prev]
      newConfig[index] = { ...newConfig[index], active: !newConfig[index].active }
      return newConfig
    })
  }

  const handleTaxChange = (index, value) => {
    setConfig(prev => {
      const newConfig = [...prev]
      newConfig[index] = { ...newConfig[index], tax: value }
      return newConfig
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md h-[80vh] flex flex-col animate-scaleIn">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">Parcelas</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {config.map((item, index) => (
            <div key={item.count} className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => handleToggle(index)}
                className={clsx(
                  "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2",
                  item.active ? "bg-green-500" : "bg-gray-200"
                )}
              >
                <span
                  className={clsx(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    item.active ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
              
              <span className="text-gray-700 font-medium w-8">{item.count} x</span>
              
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text" // Changed to text to allow comma
                    placeholder="0,00"
                    className="w-full bg-gray-50 border-none rounded-lg px-3 py-2 text-right text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-green-500"
                    value={item.tax}
                    onChange={e => handleTaxChange(index, e.target.value)}
                    disabled={!item.active}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">Taxa</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-500 font-medium hover:text-gray-700 flex items-center gap-2"
          >
            <X size={18} />
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(config)}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <Check size={18} />
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

function PaymentMethodModal({ open, onClose, onConfirm, initialData }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [tax, setTax] = useState('')
  const [active, setActive] = useState(true)
  
  // Credit card specific fields
  const [cnpjCredenciadora, setCnpjCredenciadora] = useState('')
  const [paymentMode, setPaymentMode] = useState('unique') // 'unique' | 'installments'
  const [installmentsConfig, setInstallmentsConfig] = useState(
    Array.from({ length: 24 }, (_, i) => ({ count: i + 1, active: i === 0, tax: '' }))
  )
  const [installmentsModalOpen, setInstallmentsModalOpen] = useState(false)

  React.useEffect(() => {
    if (open) {
      if (initialData) {
        setName(initialData.label || '')
        setType(initialData.type || '')
        setTax(initialData.tax || '')
        setActive(initialData.active !== false)
        setCnpjCredenciadora(initialData.cnpjCredenciadora || '')
        setPaymentMode(initialData.paymentMode || 'unique')
        if (initialData.installmentsConfig && initialData.installmentsConfig.length > 0) {
          setInstallmentsConfig(initialData.installmentsConfig)
        } else {
          setInstallmentsConfig(Array.from({ length: 24 }, (_, i) => ({ count: i + 1, active: i === 0, tax: '' })))
        }
      } else {
        // Reset fields for new entry
        setName('')
        setType('')
        setTax('')
        setActive(true)
        setCnpjCredenciadora('')
        setPaymentMode('unique')
        setInstallmentsConfig(Array.from({ length: 24 }, (_, i) => ({ count: i + 1, active: i === 0, tax: '' })))
      }
    }
  }, [open, initialData])

  const handleInstallmentsConfirm = (config) => {
    setInstallmentsConfig(config)
    setInstallmentsModalOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scaleIn">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Forma de pagamento</h2>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <input
              type="text"
              placeholder="Nome"
              className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-green-500"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="relative">
            <select
              className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-gray-800 appearance-none focus:ring-2 focus:ring-green-500"
              value={type}
              onChange={e => setType(e.target.value)}
            >
              <option value="" disabled>Tipo de pagamento</option>
              <option value="pix">Pix</option>
              <option value="cartao_credito">Cartão de Crédito</option>
              <option value="cartao_debito">Cartão de Débito</option>
              <option value="cheque">Cheque</option>
              <option value="transferencia_bancaria">Transferência Bancária</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {type === 'cartao_credito' && (
            <>
              <div>
                <input
                  type="text"
                  placeholder="CNPJ Credenciadora"
                  className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-green-500"
                  value={cnpjCredenciadora}
                  onChange={e => setCnpjCredenciadora(e.target.value)}
                />
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="radio"
                      name="paymentMode"
                      className="peer sr-only"
                      checked={paymentMode === 'unique'}
                      onChange={() => setPaymentMode('unique')}
                    />
                    <div className="w-5 h-5 border-2 border-gray-300 rounded-full peer-checked:border-green-500 peer-checked:border-[6px] transition-all"></div>
                  </div>
                  <div>
                    <span className="block text-gray-800 font-medium">Utilizar pagamento único</span>
                    <span className="block text-gray-500 text-sm">Marque esta opção para utilizar uma única taxa de venda se quiser, e não informar quantidade de parcelas</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="radio"
                      name="paymentMode"
                      className="peer sr-only"
                      checked={paymentMode === 'installments'}
                      onChange={() => setPaymentMode('installments')}
                    />
                    <div className="w-5 h-5 border-2 border-gray-300 rounded-full peer-checked:border-green-500 peer-checked:border-[6px] transition-all"></div>
                  </div>
                  <div>
                    <span className="block text-gray-800 font-medium">Configurar parcelamento</span>
                    <span className="block text-gray-500 text-sm">Desta forma você poderá configurar a quantidade de parcelas.<br/>Você tera que informar a quantidade de parcelas no ato da venda ou recebimento</span>
                  </div>
                </label>
              </div>
            </>
          )}

          {/* Show tax input for non-credit card OR credit card with unique payment */}
          {(type !== 'cartao_credito' || (type === 'cartao_credito' && paymentMode === 'unique')) && (
            <div>
              <div className="relative">
                <input
                  type="text" // Changed to text for flexibility
                  placeholder=" "
                  className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-green-500"
                  value={tax}
                  onChange={e => setTax(e.target.value)}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Taxa de venda (%)</span>
              </div>
            </div>
          )}

          {/* Show installments config if credit card AND installments mode */}
          {type === 'cartao_credito' && paymentMode === 'installments' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-2">
                <span>Parcelas</span>
                <span>Taxa</span>
              </div>
              
              <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                {installmentsConfig.filter(i => i.active).map(item => (
                  <div key={item.count} className="flex justify-between items-center text-gray-700">
                    <span>{item.count} x</span>
                    <span>{item.tax || '0,00'}%</span>
                  </div>
                ))}
                {installmentsConfig.filter(i => i.active).length === 0 && (
                  <div className="text-gray-400 text-sm italic">Nenhuma parcela configurada</div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setInstallmentsModalOpen(true)}
                className="w-full border border-green-500 text-green-600 rounded-lg px-4 py-2 font-medium hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                Configurar Parcelas
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setActive(!active)}
              className={clsx(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2",
                active ? "bg-green-500" : "bg-gray-200"
              )}
            >
              <span
                className={clsx(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  active ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
            <span className="text-gray-700 font-medium">Ativo</span>
          </div>
        </div>

        <div className="p-4 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-500 font-medium hover:text-gray-700 flex items-center gap-2"
          >
            <X size={18} />
            Cancelar
          </button>
          <button
            onClick={() => onConfirm({ 
              name, 
              type, 
              tax, 
              active,
              // Add new fields to the result
              cnpjCredenciadora: type === 'cartao_credito' ? cnpjCredenciadora : undefined,
              paymentMode: type === 'cartao_credito' ? paymentMode : undefined,
              installmentsConfig: type === 'cartao_credito' && paymentMode === 'installments' ? installmentsConfig : undefined
            })}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <Check size={18} />
            Confirmar
          </button>
        </div>
      </div>
      
      {/* Installments Configuration Modal */}
      <InstallmentsModal
        open={installmentsModalOpen}
        onClose={() => setInstallmentsModalOpen(false)}
        onConfirm={handleInstallmentsConfirm}
        initialConfig={installmentsConfig}
      />
    </div>
  )
}

export default function PaymentMethodsPage({ storeId, onBack }) {
  const [methods, setMethods] = useState([])
  const [filter, setFilter] = useState('active') // 'active' | 'inactive'
  const [modalOpen, setModalOpen] = useState(false)
  const [editingMethod, setEditingMethod] = useState(null)

  useEffect(() => {
    return listenPaymentMethods(setMethods, storeId)
  }, [storeId])

  const filteredMethods = [
    ...(filter === 'active' ? [{ 
      id: 'sys_cash', 
      label: 'Dinheiro', 
      type: 'dinheiro', 
      active: true, 
      locked: true, 
      tax: '0,00' 
    }] : []),
    ...methods.filter(m => filter === 'active' ? m.active : !m.active)
  ]

  const handleSaveMethod = async (data) => {
    try {
      if (editingMethod) {
        await updatePaymentMethod(editingMethod.id, {
          label: data.name,
          ...data
        })
      } else {
        await addPaymentMethod(data, storeId)
      }
      setModalOpen(false)
      setEditingMethod(null)
    } catch (error) {
      console.error(error)
      alert('Erro ao salvar forma de pagamento')
    }
  }

  const handleEditClick = (method) => {
    if (method.locked) return
    setEditingMethod(method)
    setModalOpen(true)
  }

  const handleNewClick = () => {
    setEditingMethod(null)
    setModalOpen(true)
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <h1 className="text-2xl font-bold text-gray-800">Forma de Pagamento</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleNewClick}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
          >
            <Plus size={20} />
            Novo
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex-1 flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-gray-100 p-4 gap-2">
          <button
            onClick={() => setFilter('active')}
            className={clsx(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              filter === 'active' 
                ? "bg-green-100 text-green-700" 
                : "text-gray-500 hover:bg-gray-50"
            )}
          >
            Ativo
          </button>
          <button
            onClick={() => setFilter('inactive')}
            className={clsx(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              filter === 'inactive' 
                ? "bg-green-100 text-green-700" 
                : "text-gray-500 hover:bg-gray-50"
            )}
          >
            Inativo
          </button>
        </div>

        {/* Header */}
        <div className="grid grid-cols-[1fr_auto] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <div>Forma de Pagamento</div>
          <div className="w-8"></div>
        </div>

        {/* List */}
        <div className="divide-y divide-gray-100">
          {filteredMethods.map((method) => (
            <div 
              key={method.id}
              onClick={() => handleEditClick(method)}
              className="grid grid-cols-[1fr_auto] gap-4 px-6 py-4 items-center hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="text-gray-700 font-medium">{method.label}</span>
                <span className={clsx(
                  "px-2 py-0.5 text-xs rounded-full font-medium",
                  method.active 
                    ? "bg-green-100 text-green-700" 
                    : "bg-gray-100 text-gray-600"
                )}>
                  {method.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              
              <div className="flex items-center justify-end w-8">
                {method.locked && (
                  <Lock size={16} className="text-gray-400" />
                )}
              </div>
            </div>
          ))}

          {filteredMethods.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              Nenhuma forma de pagamento encontrada.
            </div>
          )}
        </div>
      </div>
      
      <PaymentMethodModal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)}
        onConfirm={handleSaveMethod}
        initialData={editingMethod}
      />
    </div>
  )
}
