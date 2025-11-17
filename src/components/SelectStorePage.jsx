import React, { useEffect, useState } from 'react'
import { listStoresByOwner } from '../services/stores'

export default function SelectStorePage({ user, onSelect }){
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load(){
      setLoading(true)
      const data = await listStoresByOwner(user.id)
      if (mounted) setStores(data)
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [user.id])

  return (
    <div className="min-h-screen bg-[#f7faf9] p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold">Selecione a loja</h1>
        <p className="text-sm text-gray-600 mt-1">Bem-vindo, {user.name}. Escolha uma loja para continuar.</p>

        {loading ? (
          <div className="mt-6">Carregando lojas...</div>
        ) : stores.length === 0 ? (
          <div className="mt-6 text-sm text-gray-600">Nenhuma loja encontrada para sua conta.</div>
        ) : (
          <div className="grid grid-cols-3 gap-4 mt-6">
            {stores.map(s => (
              <div key={s.id} className="bg-white rounded-lg shadow p-4 cursor-pointer hover:border-green-600 border" onClick={() => onSelect(s)}>
                <div className="font-semibold">{s.name}</div>
                <div className="text-xs text-gray-600 mt-1">ID: {s.id}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}