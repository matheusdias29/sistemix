import React, { useState } from 'react'
import { login } from '../services/users'

export default function LoginPage({ onLoggedIn }){
  const [email, setEmail] = useState('bob@example.com')
  const [password, setPassword] = useState('123456')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e){
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const user = await login(email.trim(), password)
      onLoggedIn(user)
    } catch (err) {
      setError(err.message || 'Falha no login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7faf9]">
      <div className="w-[380px] bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <div className="font-bold text-xl">Siste<span className="text-green-600">Mix</span></div>
          <div className="text-sm text-gray-600 mt-1">Acesse sua conta</div>
        </div>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm">Email</label>
            <input className="mt-1 w-full border rounded p-2" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com" />
          </div>
          <div>
            <label className="text-sm">Senha</label>
            <input className="mt-1 w-full border rounded p-2" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••" />
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button className="w-full bg-green-600 text-white py-2 rounded disabled:opacity-60" disabled={loading} type="submit">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}