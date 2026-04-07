import React, { useEffect, useState } from 'react'
import { listenUsers } from '../../services/users'
import { listenAllStores } from '../../services/stores'
import { listenAllSubscriptions } from '../../services/subscriptions'

export default function AdminTrialUsers() {
  const [users, setUsers] = useState([])
  const [stores, setStores] = useState([])
  const [subs, setSubs] = useState([])
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
      setLoading(false)
      setUsers(list)
    })
    const unsubStores = listenAllStores((list) => setStores(list))
    const unsubSubs = listenAllSubscriptions((list) => setSubs(list))
    return () => { unsubUsers(); unsubStores(); unsubSubs() }
  }, [])

  const toDate = (d) => {
    if (!d) return null
    try {
      if (typeof d?.toDate === 'function') return d.toDate()
      if (typeof d?.seconds === 'number') return new Date(d.seconds * 1000)
      const x = new Date(d)
      return Number.isNaN(x.getTime()) ? null : x
    } catch {
      return null
    }
  }

  const trialUsers = (() => {
    const now = new Date()
    const subsByOwner = {}
    ;(subs || []).forEach(s => {
      if (!s?.id) return
      subsByOwner[s.id] = s
    })

    return (users || []).filter(u => {
      if (!u) return false
      if (!!u.trial) return true
      const sub = subsByOwner[u.id]
      const trialEnd = toDate(sub?.trialEnd)
      return !!trialEnd && trialEnd.getTime() >= now.getTime()
    })
  })()

  const getUserStores = (ownerId) => stores.filter(s => s.ownerId === ownerId)
  const getTrialValidUntil = (ownerId) => {
    const user = (users || []).find(u => u?.id === ownerId)
    const sub = (subs || []).find(s => s?.id === ownerId)
    return user?.trialValidUntil || sub?.trialEnd || null
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Contas em Teste (7 dias)</h2>
      </div>
      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : trialUsers.length === 0 ? (
        <div className="text-gray-500">Nenhum usuário em teste.</div>
      ) : (
        <div className="space-y-3">
          {trialUsers.map(u => (
            <div key={u.id} className="bg-white p-4 rounded border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-800">{u.name || 'Sem nome'}</div>
                  <div className="text-sm text-gray-500">{u.email}</div>
                  <div className="text-xs text-gray-500">
                    Expira: {formatDateTime(getTrialValidUntil(u.id))}
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
