import React from 'react'
import pixIcon from '../assets/pix.svg'

export function PaymentMethodsModal({ open, onClose, onChoose, onChooseMethod, onConfirm, remaining, payments, onRemovePayment }) {
  if (!open) return null

  const chooseHandler = onChoose || onChooseMethod

  const paymentMethods = [
    { 
      code: 'cash', 
      label: 'Dinheiro',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M7,15H9C9,16.08 10.37,17 12,17C13.63,17 15,16.08 15,15C15,13.9 13.96,13.5 11.76,12.97C9.64,12.44 7,11.78 7,9C7,7.21 8.47,5.69 10.5,5.18V3H13.5V5.18C15.53,5.69 17,7.21 17,9H15C15,7.92 13.63,7 12,7C10.37,7 9,7.92 9,9C9,10.1 10.04,10.5 12.24,11.03C14.36,11.56 17,12.22 17,15C17,16.79 15.53,18.31 13.5,18.82V21H10.5V18.82C8.47,18.31 7,16.79 7,15Z"/>
        </svg>
      )
    },
    { 
      code: 'pix', 
      label: 'PIX Lojista',
      icon: (<img src={pixIcon} alt="PIX" className="w-8 h-8" />)
    },
    { 
      code: 'debit_card', 
      label: 'Cartão De Débito',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.11,4 20,4M20,18H4V12H20V18M20,8H4V6H20V8Z"/>
        </svg>
      )
    },
    { 
      code: 'debit_card_lojista', 
      label: 'Cartão De Débito Lojista',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.11,4 20,4M20,18H4V12H20V18M20,8H4V6H20V8Z"/>
        </svg>
      )
    },
    { 
      code: 'credit_card', 
      label: 'Cartão De Crédito',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.11,4 20,4M20,18H4V12H20V18M20,8H4V6H20V8M7,15H9V17H7V15M11,15H17V17H11V15Z"/>
        </svg>
      )
    },
    { 
      code: 'credit_card_lojista', 
      label: 'Cartão De Crédito Lojista',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.11,4 20,4M20,18H4V12H20V18M20,8H4V6H20V8M7,15H9V17H7V15M11,15H17V17H11V15Z"/>
        </svg>
      )
    },
    { 
      code: 'cheque', 
      label: 'Cheque',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M21,5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5M19,19H5V5H19V19M17,17H7V15H17V17M17,13H7V11H17V13M17,9H7V7H17V9Z"/>
        </svg>
      )
    },
    { 
      code: 'conta', 
      label: 'Conta',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,19H5V5H19V19M17,12H7V10H17V12M15,16H7V14H15V16M17,8H7V6H17V8Z"/>
        </svg>
      )
    },
    { 
      code: 'troca_pecas', 
      label: 'TROCA DE PEÇAS - SH',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
        </svg>
      )
    },
    { 
      code: 'vale_funcionario', 
      label: 'Vale Funcionário',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
        </svg>
      )
    },
    { 
      code: 'garantia_conserto', 
      label: 'GARANTIA DE CONSERTO - GRATUITO',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11.5H16.3V16H7.7V11.5H9.2V10C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.5,8.7 10.5,10V11.5H13.5V10C13.5,8.7 12.8,8.2 12,8.2Z"/>
        </svg>
      )
    },
    { 
      code: 'garantia_produto', 
      label: 'GARANTIA DE PRODUTO ESPECÍFICO',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M10,17L6,13L7.41,11.59L10,14.17L16.59,7.58L18,9L10,17Z"/>
        </svg>
      )
    },
    { 
      code: 'crediario', 
      label: 'Crediário',
      icon: (
        <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,19H5V5H19V19M17,12H7V10H17V12M15,16H7V14H15V16M17,8H7V6H17V8Z"/>
        </svg>
      )
    }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[120]">
      <div className="bg-white rounded-lg w-[600px] max-w-[95vw] md:max-w-[80vw] max-h-[90vh] md:max-h-[80vh] overflow-y-auto md:overflow-hidden">
        <div className="p-4 border-b">
          <div className="text-center">
            <div className="text-sm text-gray-600">Restante a pagar:</div>
            <div className="text-3xl font-bold">R$ {Number(remaining||0).toFixed(2)}</div>
          </div>
          {payments && payments.length > 0 && (
            <div className="mt-3">
              {payments.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between py-2">
                  <div className="flex items-center">
                    <div className="mr-2">{(paymentMethods.find(m=>m.code===p.methodCode)||{}).icon}</div>
                    <span className="text-gray-700">{p.method}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="mr-3 font-medium">{p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    {onRemovePayment && (
                      <button type="button" onClick={() => onRemovePayment(idx)} className="text-gray-500 hover:text-red-600">✕</button>
                    )}
                  </div>
                </div>
              ))}
              <div className="border-t"></div>
            </div>
          )}
          <h2 className="text-sm font-medium mt-2 text-center">Selecionar forma de pagamento:</h2>
        </div>
        <div className="p-4 max-h-[60vh] md:max-h-96 overflow-y-auto">
          <div className="grid grid-cols-3 gap-2">
            {paymentMethods.map((method) => (
              <button
                key={method.code}
                onClick={() => chooseHandler && chooseHandler(method)}
                className="flex flex-col items-center p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 hover:border-green-300 transition-colors min-h-[80px]"
              >
                <div className="mb-1">
                  {method.icon}
                </div>
                <div className="text-xs font-medium text-center text-green-800 leading-tight">{method.label}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 border-t flex items-center justify-end space-x-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50">
            ✕ Cancelar
          </button>
          <button type="button" onClick={onConfirm} className="px-4 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600">
            ✓ Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

export function PaymentAmountModal({ open, onClose, method, remaining, amount, setAmount, error, setError, onConfirm }) {
  if (!open) return null

  const handleAmountChange = (e) => {
    const value = e.target.value
    setAmount(value)
    setError('')
  }

  const handleConfirm = () => {
    const amt = parseFloat(amount) || 0
    if (amt <= 0) {
      setError('Valor deve ser maior que zero')
      return
    }
    onConfirm()
  }

  const currentAmount = parseFloat(amount) || 0
  const willHaveChange = method?.code === 'cash' && currentAmount > remaining
  const changeAmount = willHaveChange ? currentAmount - remaining : 0
  const appliedAmount = method?.code === 'cash' ? Math.min(currentAmount, remaining) : Math.min(currentAmount, remaining)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[120]">
      <div className="bg-white rounded-lg w-96 max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Valor do pagamento</h2>
          <div className="text-center mt-1 font-medium">
            {method?.label}
          </div>
        </div>
        <div className="p-4">
          <div className="mb-4">
            <div className="flex items-center space-x-3">
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0,00"
                className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                autoFocus
              />
              <div className="px-3 py-2 border rounded-lg text-sm">
                <div className="text-gray-500">Valor</div>
                <div className="font-semibold">R$ {currentAmount.toFixed(2)}</div>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>

          <div className="text-sm text-gray-600">Restante a pagar: R$ {remaining.toFixed(2)}</div>

          {currentAmount > 0 && (
            <div className="space-y-3 mt-3">
              {method?.code === 'cash' && willHaveChange && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    💰 Troco de R$ {changeAmount.toFixed(2)} será registrado
                  </p>
                </div>
              )}

              {method?.code !== 'cash' && currentAmount > remaining && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Valor acima do restante. Será aplicado apenas R$ {remaining.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="p-4 border-t flex items-center justify-end space-x-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={handleConfirm} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">Confirmar</button>
        </div>
      </div>
    </div>
  )
}

export function AboveAmountConfirmModal({ open, amount, remaining, method, onCancel, onConfirm }) {
  if (!open) return null

  const excessAmount = amount - remaining

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[120]">
      <div className="bg-white rounded-lg w-96 max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center">
            <svg className="w-5 h-5 text-yellow-500 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12,2L13.09,8.26L22,9L13.09,9.74L12,16L10.91,9.74L2,9L10.91,8.26L12,2Z"/>
            </svg>
            Valor Acima do Restante
          </h2>
        </div>
        <div className="p-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Valor informado:</span>
              <span className="font-bold text-lg">R$ {amount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Valor restante:</span>
              <span className="font-medium">R$ {remaining.toFixed(2)}</span>
            </div>
            <div className="border-t border-yellow-300 pt-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Excesso:</span>
                <span className="font-medium text-yellow-700">R$ {excessAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center mb-4">
            {method?.icon && <div className="mr-2">{method.icon}</div>}
            <div>
              <p className="font-medium">Método: {method?.label}</p>
              <p className="text-sm text-gray-600">
                Será aplicado apenas R$ {remaining.toFixed(2)} para este método
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              💡 O valor será ajustado automaticamente para não exceder o restante da compra.
            </p>
          </div>
        </div>
        <div className="p-4 border-t flex items-center justify-end space-x-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
            Voltar e Corrigir
          </button>
          <button type="button" onClick={onConfirm} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">
            Aplicar R$ {remaining.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  )
}

export function PaymentRemainingModal({ open, remaining, onClose, onAddMore }) {
  if (!open) return null

  const percentagePaid = remaining > 0 ? ((100 - (remaining / (remaining + 100)) * 100)) : 100

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[120]">
      <div className="bg-white rounded-lg w-96 max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center">
            <svg className="w-5 h-5 text-orange-500 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,17A1.5,1.5 0 0,1 10.5,15.5A1.5,1.5 0 0,1 12,14A1.5,1.5 0 0,1 13.5,15.5A1.5,1.5 0 0,1 12,17M12,10A1,1 0 0,1 13,11V13A1,1 0 0,1 11,13V11A1,1 0 0,1 12,10Z"/>
            </svg>
            Pagamento Parcial
          </h2>
        </div>
        <div className="p-4">
          <div className="text-center mb-4">
            <div className="text-3xl font-bold text-orange-600 mb-2">
              R$ {remaining.toFixed(2)}
            </div>
            <p className="text-gray-600">ainda resta para completar o pagamento</p>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Status do pagamento:</span>
              <span className="font-medium text-orange-600">Parcial</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-orange-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${Math.max(percentagePaid, 10)}%` }}
              ></div>
            </div>
          </div>

          <p className="text-center text-gray-600 mb-4">
            Você pode finalizar com pagamento parcial ou adicionar outro método de pagamento.
          </p>
        </div>
        <div className="p-4 border-t flex items-center justify-end space-x-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
            Finalizar Parcial
          </button>
          <button type="button" onClick={onAddMore} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">
            + Adicionar Pagamento
          </button>
        </div>
      </div>
    </div>
  )
}

export function AfterAboveAdjustedModal({ open, method, remaining, onClose }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[120]">
      <div className="bg-white rounded-lg w-96 max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center">
            <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
            </svg>
            Pagamento Ajustado com Sucesso
          </h2>
        </div>
        <div className="p-4">
          <div className="flex items-center mb-4">
            {method?.icon && <div className="mr-2">{method.icon}</div>}
            <div>
              <p className="font-medium">Método: {method?.label}</p>
              <p className="text-sm text-gray-600">
                Pagamento registrado com sucesso
              </p>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-green-800">
              ✅ O pagamento foi ajustado automaticamente para não exceder o valor restante da compra.
            </p>
          </div>

          {remaining > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Ainda resta:</span>
                <span className="font-bold text-lg text-orange-600">R$ {remaining.toFixed(2)}</span>
              </div>
              <p className="text-sm text-orange-700 mt-1">
                Você pode adicionar mais formas de pagamento para completar.
              </p>
            </div>
          )}
        </div>
        <div className="p-4 border-t flex items-center justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600">
            Continuar
          </button>
        </div>
      </div>
    </div>
  )
}
