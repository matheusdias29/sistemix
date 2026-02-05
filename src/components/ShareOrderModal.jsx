import React, { useState } from 'react'

export default function ShareOrderModal({ open, onClose, order, store }) {
  if (!open || !order) return null

  const orderNumber = order.number || String(order.id).slice(-4)
  const [whatsapp, setWhatsapp] = useState('')

  const shareUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/comprovantes/ordem-servico/${order.id}` 
    : ''

  const handleWhatsapp = () => {
    if (!whatsapp) return alert('Digite o número do Whatsapp')
    const phone = whatsapp.replace(/\D/g, '')
    const storeName = store?.name || 'nossa loja'
    const text = encodeURIComponent(`Olá, segue o link para acompanhamento de sua ordem de serviço aqui na ${storeName} ${shareUrl}`)
    window.open(`https://wa.me/55${phone}?text=${text}`, '_blank')
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Ordem de Serviço ${orderNumber}`,
          text: `Acompanhe o status da sua OS ${orderNumber}`,
          url: shareUrl
        })
      } catch (err) {
        console.error('Error sharing:', err)
      }
    } else {
      handleCopy()
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl)
    alert('Link copiado!')
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 flex flex-col items-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">O.S Nº {orderNumber}</h2>

          <input
            type="text"
            placeholder="Whatsapp (com DDD)"
            value={whatsapp}
            onChange={e => setWhatsapp(e.target.value)}
            className="w-full bg-gray-100 border-none rounded-lg px-4 py-3 text-gray-700 placeholder-gray-400 mb-4 focus:ring-2 focus:ring-green-500 outline-none"
          />

          <button 
            onClick={handleWhatsapp}
            className="w-full bg-[#4ADE80] hover:bg-[#22c55e] text-white font-semibold rounded-lg py-3 mb-3 flex items-center justify-center gap-2 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Enviar Por Whatsapp
          </button>

          <button 
            onClick={handleShare}
            className="w-full border border-[#4ADE80] text-[#4ADE80] hover:bg-green-50 font-semibold rounded-lg py-3 mb-3 flex items-center justify-center gap-2 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            Compartilhar Link
          </button>

          <button 
            onClick={handleCopy}
            className="w-full border border-[#4ADE80] text-[#4ADE80] hover:bg-green-50 font-semibold rounded-lg py-3 mb-6 flex items-center justify-center gap-2 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            Copiar Link
          </button>

          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-sm font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
