import React, { useEffect, useState } from 'react'
import { listenUsers } from '../../services/users'
import { listenAllStores } from '../../services/stores'

export default function AdminTrialUsers() {
  const [users, setUsers] = useState([])
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)

  const formatDateTime = (d) => {
    if (!d) return '-'
    try {
      if (typeof d?.toDate === 'function') return d.toDate().toLocaleString()
      if (typeof d?.seconds === 'number') return new Date(d.seconds * 1000).toLocaleString()
      return new Date(d).toLocaleString()
    } catch {
      return '-'
    }
  }

  useEffect(() => {
    const unsubUsers = listenUsers((list) => {
      setUsers(list.filter(u => !!u.trial))
      setLoading(false)
    })
    const unsubStores = listenAllStores((list) => setStores(list))
    return () => { unsubUsers(); unsubStores() }
  }, [])

  const getUserStores = (ownerId) => stores.filter(s => s.ownerId === ownerId)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Contas em Teste (7 dias)</h2>
      </div>
      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : users.length === 0 ? (
        <div className="text-gray-500">Nenhum usuário em teste.</div>
      ) : (
        <div className="space-y-3">
          {users.map(u => (
            <div key={u.id} className="bg-white p-4 rounded border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-800">{u.name || 'Sem nome'}</div>
                  <div className="text-sm text-gray-500">{u.email}</div>
                  <div className="text-xs text-gray-500">
                    Expira: {formatDateTime(u.trialValidUntil)}
                  </div>
                </div>
                <div className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">Em teste</div>
              </div>
              <div className="mt-3">
                <div className="text-xs font-semibold text-gray-600">Lojas</div>
                <div className="mt-1 space-y-1">
                  {getUserStores(u.id).map(s => (
                    <div key={s.id} className="text-sm text-gray-700">• {s.name}</div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
