import React, { useState, useEffect } from 'react'
import { getStoreById, updateStore } from '../services/stores'

export default function TermsPage({ storeId }) {
  const [terms, setTerms] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!storeId) return
    setLoading(true)
    getStoreById(storeId).then(s => {
      if (s && s.termsText) {
        setTerms(s.termsText)
      }
    }).finally(() => setLoading(false))
  }, [storeId])

  const handleSave = async () => {
    if (!storeId) return
    setSaving(true)
    try {
      await updateStore(storeId, { termsText: terms })
      alert('Termos salvos com sucesso!')
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar termos.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="text-lg font-semibold mb-4">Termos e Condições</h2>
      <p className="text-sm text-gray-500 mb-4">
        Edite os termos de garantia e condições de venda/serviço da sua loja. 
        Este texto poderá ser exibido nos comprovantes.
      </p>
      
      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : (
        <div className="flex flex-col gap-4">
          <textarea
            className="w-full border rounded p-3 h-64 text-sm focus:ring-green-500 focus:border-green-500"
            value={terms}
            onChange={e => setTerms(e.target.value)}
            placeholder="Digite aqui os termos de garantia, troca e devolução..."
          ></textarea>
          
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
