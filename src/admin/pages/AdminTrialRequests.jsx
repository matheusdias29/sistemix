import React, { useEffect, useState } from 'react'
import { listenPendingTrials, approveTrial, rejectTrial } from '../../services/trialRequests'

export default function AdminTrialRequests({ adminUser }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rejectingId, setRejectingId] = useState(null)

  useEffect(() => {
    const unsub = listenPendingTrials(
      (list) => {
        setItems(list)
        setLoading(false)
      },
      (err) => {
        setError('Não foi possível carregar as solicitações (permissão ou índice ausente).')
        setLoading(false)
      }
    )
    return () => unsub && unsub()
  }, [])

  const handleApprove = async (it) => {
    setError('')
    try {
      await approveTrial(it, adminUser)
    } catch (e) {
      setError('Falha ao aprovar. Verifique as regras do Firestore.')
      console.error(e)
    }
  }

  const handleReject = async (it) => {
    const reason = prompt('Informe o motivo da rejeição:', '')
    if (reason === null) return
    setError('')
    setRejectingId(it.id)
    try {
      await rejectTrial(it, reason, adminUser)
    } catch (e) {
      setError('Falha ao rejeitar. Verifique as regras do Firestore.')
      console.error(e)
    } finally {
      setRejectingId(null)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Solicitações de Teste (Pendentes)</h2>
      </div>
      {error && <div className="mb-3 p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>}
      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-gray-500">Nenhuma solicitação pendente.</div>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <div key={it.id} className="bg-white p-4 rounded border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-800">{it.name || 'Sem nome'}</div>
                <div className="text-sm text-gray-500">{it.email}</div>
                <div className="text-xs text-gray-400">
                  Criado em {it.createdAt?.seconds ? new Date(it.createdAt.seconds * 1000).toLocaleString() : '-'} • Protocolo {it.requestId}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleApprove(it)} className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                  Aprovar
                </button>
                <button onClick={() => handleReject(it)} disabled={rejectingId===it.id} className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-60">
                  Rejeitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
