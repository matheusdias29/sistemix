import React, { useEffect, useState } from 'react'
import { getOrderById } from '../services/orders'
import { getStoreById } from '../services/stores'

export default function OrderTrackingPage({ orderId }) {
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
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Ordem de serviço não encontrada.</div>
  }

  const formatDate = (d) => {
    if (!d) return '-'
    // Handle Firestore timestamp or ISO string
    const date = d.toDate ? d.toDate() : new Date(d)
    return date.toLocaleString('pt-BR')
  }

  const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 font-sans">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm overflow-hidden p-8 md:p-12">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start mb-8 border-b pb-6 border-dashed border-gray-200">
          <div className="flex flex-col gap-2 mb-4 md:mb-0">
            {store?.logoUrl && (
              <img src={store.logoUrl} alt={store.name} className="h-12 object-contain w-fit mb-2" />
            )}
            <h1 className="font-bold text-xl text-gray-800">{store?.name || 'Sua Loja'}</h1>
            <div className="text-xs text-gray-500 space-y-0.5">
              {store?.cnpj && <p>{store.cnpj}</p>}
              {store?.phone && <p>{store.phone}</p>}
              <p>
                {[store?.address, store?.number, store?.neighborhood, store?.city, store?.state].filter(Boolean).join(', ')}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end">
             <div className="flex items-center gap-2 mb-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold
                  ${order.status === 'Finalizado' ? 'bg-green-100 text-green-800' : 
                    order.status === 'Cancelado' ? 'bg-red-100 text-red-800' : 
                    'bg-gray-100 text-gray-600'}`}>
                  {order.status || 'Aberto'}
                </span>
                <h2 className="text-2xl font-bold text-gray-800">O.S Nº {order.number ? String(order.number).replace('#','') : order.id.slice(0,6).toUpperCase()}</h2>
             </div>
          </div>
        </div>

        {/* Valor Total */}
        <div className="mb-8">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">VALOR TOTAL</p>
            <p className="text-3xl font-bold text-green-500">{formatCurrency(order.total)}</p>
        </div>

        <div className="border-t border-dashed border-gray-200 my-6"></div>

        {/* Termo de garantia (header only as per image structure, implies content below or just title) 
            Actually image shows "TERMO DE GARANTIA" followed by dashed line. 
            But further down there is "Termo de garantia" section with text.
            I will follow the flow of the image.
        */}
        <div className="mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">TERMO DE GARANTIA</p>
        </div>
        
        <div className="border-t border-dashed border-gray-200 my-6"></div>

        {/* Dados do Cliente */}
        <div className="mb-8">
          <h3 className="flex items-center gap-2 font-bold text-gray-800 mb-4">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
             Dados do cliente
          </h3>
          <p className="text-sm font-medium text-gray-700 uppercase">{order.client || 'Cliente não identificado'}</p>
        </div>

        {/* Dados Gerais */}
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

        {/* Observações de recebimento */}
        {order.receiptNotes && (
          <div className="mb-8">
            <h3 className="font-bold text-gray-800 mb-2 text-sm">Observações de recebimento</h3>
            <p className="text-xs text-gray-600 uppercase whitespace-pre-wrap leading-relaxed">
              {order.receiptNotes}
            </p>
          </div>
        )}

        {/* Termo de garantia (Text) */}
        <div className="mt-8 pt-6 border-t border-gray-100">
           <h3 className="font-bold text-gray-800 mb-2 text-sm">Termo de garantia</h3>
           <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">
             Garantia de produtos e serviços.
             90 dias para defeito de fabricação.
             Não cobre produto quebrado.
             Não cobre riscos na tela.
             Não cobre trincos na tela.
             Não cobre manchas, listras ou trincos internos.
             Ou externos na peça.
           </p>
        </div>

      </div>
      
      {/* Footer Branding */}
      <div className="text-center mt-8 text-gray-400 text-xs">
        <p>Sistema Apex Comercio</p>
      </div>
    </div>
  )
}
