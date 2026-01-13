import React, { useEffect, useState } from 'react'
import { getOrderById } from '../services/orders'
import { getStoreById } from '../services/stores'

const DEFAULT_WARRANTY = `Garantia de produtos e serviços. 
90 dias para defeito de fabricação. 
Não cobre aparelho ou produto com sinais de humidade. 
Não cobre produto quebrado . 
Não cobre riscos na tela. 
Não cobre trincos na tela. 
Não cobre manchas ,listras trincos internos 
Ou externos na peça . 
Não cobre selo ou lacre rompido. 
Fica ciente que cliente em caso de defetio 
deve Retornar A empresa,No prazo estabelecido. 
Em caso de insatisfação cliente tem 7 dias 
Para pedir estorno... E a empresa não tem responsabilidade 
de colocar a peça velha no lugar, pois sao descartadas diariamente. 
Visando e focanda na qualidade! 
todos os produto são testados na loja antes da saída para o cliente da loja e testado junto ao cliente. 
Sendo assim cliente ciente e de acordo 
Com todos os termos acima, citado.`

export default function OrderTrackingPage({ orderId, isSale = false }) {
  const [order, setOrder] = useState(null)
  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!orderId) return
      try {
        const o = await getOrderById(orderId)
        if (o) {
          setOrder(o)
          if (o.storeId) {
            const s = await getStoreById(o.storeId)
            setStore(s)
          }
        }
      } catch (error) {
        console.error('Error loading order:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [orderId])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Carregando...</div>
  }

  if (!order) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Pedido não encontrado.</div>
  }

  const isSaleOrder = isSale || order.type === 'sale'

  const formatDate = (d) => {
    if (!d) return '-'
    const date = d.toDate ? d.toDate() : new Date(d)
    return date.toLocaleString('pt-BR')
  }

  const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const storeAddress = [
    store?.address || store?.endereco,
    store?.number || store?.numero,
    store?.complement || store?.complemento,
    store?.neighborhood || store?.bairro,
    store?.city || store?.cidade,
    store?.state || store?.estado,
    store?.cep
  ].filter(Boolean).join(', ')

  const storePhone = store?.phone || store?.telefone || store?.whatsapp

  const orderNumber = order.number ? String(order.number).replace('#','') : order.id.slice(0,6).toUpperCase()

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 font-sans">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm overflow-hidden p-8 md:p-12">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start mb-8 border-b pb-6 border-dashed border-gray-200">
          <div className="flex flex-col gap-2 mb-4 md:mb-0">
            {store?.logoUrl && (
              <img src={store.logoUrl} alt={store.name} className="h-12 object-contain w-fit mb-2" />
            )}
            <h1 className="font-bold text-xl text-gray-800">{store?.name || store?.fantasyName || store?.razaoSocial || 'Sua Loja'}</h1>
            <div className="text-xs text-gray-500 space-y-0.5">
              {store?.cnpj && <p>CNPJ: {store.cnpj}</p>}
              {storeAddress && <p>{storeAddress}</p>}
              {storePhone && <p>Tel: {storePhone}</p>}
            </div>
          </div>

          <div className="flex flex-col items-end">
             <div className="flex items-center gap-2 mb-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold
                  ${isSaleOrder ? 'bg-green-100 text-green-800' : 
                    order.status === 'Finalizado' ? 'bg-green-100 text-green-800' : 
                    order.status === 'Cancelado' ? 'bg-red-100 text-red-800' : 
                    'bg-gray-100 text-gray-600'}`}>
                  {isSaleOrder ? 'Venda' : (order.status || 'Aberto')}
                </span>
                <h2 className="text-2xl font-bold text-gray-800">
                  {isSaleOrder ? 'VENDA Nº' : 'O.S Nº'} {orderNumber}
                </h2>
             </div>
          </div>
        </div>

        {/* Valor Total */}
        <div className="mb-8">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">VALOR TOTAL</p>
            <p className="text-3xl font-bold text-green-500">{formatCurrency(order.total || order.valor)}</p>
        </div>

        <div className="border-t border-dashed border-gray-200 my-6"></div>

        {/* Sales Products Table */}
        {isSaleOrder && order.products && order.products.length > 0 && (
          <div className="mb-8">
             <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase">Produtos</h3>
             <div className="w-full text-sm text-left">
                <div className="flex text-gray-500 border-b border-gray-100 pb-2 mb-2 font-semibold">
                  <div className="w-12">Qtd</div>
                  <div className="flex-1">Produto</div>
                  <div className="w-24 text-right">Unit.</div>
                  <div className="w-24 text-right">Total</div>
                </div>
                {order.products.map((p, i) => (
                  <div key={i} className="flex py-2 border-b border-gray-50 last:border-0">
                    <div className="w-12 text-gray-600">{p.quantity}</div>
                    <div className="flex-1 text-gray-800">{p.name}</div>
                    <div className="w-24 text-right text-gray-600">{formatCurrency(p.price)}</div>
                    <div className="w-24 text-right font-medium text-gray-800">{formatCurrency(p.total || (p.price * p.quantity))}</div>
                  </div>
                ))}
             </div>
             <div className="border-t border-dashed border-gray-200 my-6"></div>
          </div>
        )}

        {/* Payments Info (for both Sales and OS if available) */}
        {order.payments && order.payments.length > 0 && (
          <div className="mb-8">
             <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase">Pagamentos</h3>
             <div className="space-y-2">
               {order.payments.map((pay, i) => (
                 <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600 uppercase">{pay.method}</span>
                    <span className="font-medium text-gray-800">{formatCurrency(pay.amount)}</span>
                 </div>
               ))}
             </div>
             <div className="border-t border-dashed border-gray-200 my-6"></div>
          </div>
        )}

        {/* Termo de garantia Title - Only show if not sale OR if sale has warranty info */}
        {(!isSaleOrder || order.warrantyInfo) && (
          <div className="mb-6">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">TERMO DE GARANTIA</p>
          </div>
        )}
        
        {(!isSaleOrder || order.warrantyInfo) && (
          <div className="border-t border-dashed border-gray-200 my-6"></div>
        )}

        {/* Dados do Cliente */}
        <div className="mb-8">
          <h3 className="flex items-center gap-2 font-bold text-gray-800 mb-4">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
             Dados do cliente
          </h3>
          <p className="text-sm font-medium text-gray-700 uppercase">{order.client || 'Cliente não identificado'}</p>
        </div>

        {/* Dados Gerais - Only for OS */}
        {!isSaleOrder && (
          <div className="mb-8">
            <h3 className="flex items-center gap-2 font-bold text-gray-800 mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              Dados Gerais
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
               <div>
                 <p className="text-xs font-bold text-gray-800">Entrada</p>
                 <p className="text-sm text-gray-600 uppercase">{formatDate(order.createdAt || order.dateIn)}</p>
               </div>
               
               <div>
                 <p className="text-xs font-bold text-gray-800">Marca</p>
                 <p className="text-sm text-gray-600 uppercase">{order.brand || '-'}</p>
               </div>

               <div>
                 <p className="text-xs font-bold text-gray-800">Modelo</p>
                 <p className="text-sm text-gray-600 uppercase">{order.model || '-'}</p>
               </div>

               <div>
                 <p className="text-xs font-bold text-gray-800">Equipamento</p>
                 <p className="text-sm text-gray-600 uppercase">{order.equipment || '-'}</p>
               </div>
            </div>
            
            <div className="mt-4">
                 <p className="text-xs font-bold text-gray-800">Problema</p>
                 <p className="text-sm text-gray-600 uppercase">{order.problem || '-'}</p>
            </div>
          </div>
        )}

        {/* Observações de recebimento - Only for OS */}
        {!isSaleOrder && order.receiptNotes && (
          <div className="mb-8">
            <h3 className="font-bold text-gray-800 mb-2 text-sm">Observações de recebimento</h3>
            <p className="text-xs text-gray-600 uppercase whitespace-pre-wrap leading-relaxed">
              {order.receiptNotes}
            </p>
          </div>
        )}

        {/* Termo de garantia (Text) */}
        {(!isSaleOrder || order.warrantyInfo) && (
          <div className="mt-8 pt-6 border-t border-gray-100">
             <h3 className="font-bold text-gray-800 mb-2 text-sm">Termo de garantia</h3>
             <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">
               {order.warrantyInfo || store?.serviceOrderSettings?.warrantyText || DEFAULT_WARRANTY}
             </p>
          </div>
        )}

      </div>
      
      {/* Footer Branding */}
      <div className="text-center mt-8 text-gray-400 text-xs">
        <p>SisteMix comercio</p>
      </div>
    </div>
  )
}
