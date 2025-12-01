import React, { useEffect, useState } from 'react'
import { login, findUserByEmail, findMemberByEmail } from '../services/users'
import { auth } from '../lib/firebase'
import { isSignInWithEmailLink, sendSignInLinkToEmail, signInWithEmailLink } from 'firebase/auth'

export default function LoginPage({ onLoggedIn }){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [useEmailLink, setUseEmailLink] = useState(false)
  const [emailForLinkPrompt, setEmailForLinkPrompt] = useState('')

  const mapAuthError = (err) => {
    const code = err?.code || ''
    if (code === 'auth/operation-not-allowed') return 'Login por e-mail/senha não habilitado ou método de link desativado. Ative em Authentication.'
    if (code === 'auth/invalid-email') return 'E-mail inválido.'
    return err?.message || 'Falha no login'
  }

  // Completa login por link se a URL atual contiver o código
  useEffect(() => {
    async function maybeCompleteEmailLinkSignIn(){
      try {
        if (!isSignInWithEmailLink(auth, window.location.href)) return
        setLoading(true)
        setError('')
        setInfo('Finalizando login por link...')
        let emailToUse = window.localStorage.getItem('emailForSignIn') || ''
        if (!emailToUse) {
          // Se o link foi aberto em outro dispositivo, solicitamos o email
          setInfo('Informe seu e-mail para finalizar o login por link.')
          setUseEmailLink(true)
          setLoading(false)
          return
        }
        const cred = await signInWithEmailLink(auth, emailToUse, window.location.href)
        const authedEmail = cred?.user?.email || emailToUse
        const owner = await findUserByEmail(authedEmail)
        if (owner) { onLoggedIn(owner); setInfo(''); return }
        const member = await findMemberByEmail(authedEmail)
        if (member) {
          onLoggedIn({
            id: member.ownerId,
            ownerId: member.ownerId,
            memberId: member.id,
            name: member.name || 'Usuário',
            email: member.email || authedEmail,
            role: member.role || 'staff',
            isSeller: !!member.isSeller,
            isTech: !!member.isTech,
            isAdmin: !!member.isAdmin,
            active: member.active !== false,
          })
          setInfo('')
          return
        }
        setError('Login concluído, mas nenhum perfil encontrado no banco de dados.')
        setLoading(false)
      } catch (err) {
        setError(mapAuthError(err))
        setLoading(false)
      }
    }
    maybeCompleteEmailLinkSignIn()
  }, [onLoggedIn])

  async function handleSubmit(e){
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')
    const emailTrim = email.trim()
    if (!emailTrim || (!useEmailLink && !password)) {
      setError('Informe e-mail e senha (ou use login por link).')
      setLoading(false)
      return
    }
    try {
      if (useEmailLink) {
        const actionCodeSettings = {
          url: window.location.origin,
          handleCodeInApp: true,
        }
        await sendSignInLinkToEmail(auth, emailTrim, actionCodeSettings)
        window.localStorage.setItem('emailForSignIn', emailTrim)
        setInfo('Link de login enviado para seu e-mail. Abra o link no mesmo dispositivo para finalizar automaticamente.')
      } else {
        const user = await login(emailTrim, password)
        onLoggedIn(user)
      }
    } catch (err) {
      setError(mapAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleCompleteWithPrompt(e){
    e?.preventDefault?.()
    const emailTrim = emailForLinkPrompt.trim()
    if (!emailTrim) { setError('Informe o e-mail para finalizar o login.'); return }
    try {
      setLoading(true)
      setError('')
      const cred = await signInWithEmailLink(auth, emailTrim, window.location.href)
      const authedEmail = cred?.user?.email || emailTrim
      const owner = await findUserByEmail(authedEmail)
      if (owner) { onLoggedIn(owner); setInfo(''); return }
      const member = await findMemberByEmail(authedEmail)
      if (member) {
        onLoggedIn({
          id: member.ownerId,
          ownerId: member.ownerId,
          memberId: member.id,
          name: member.name || 'Usuário',
          email: member.email || authedEmail,
          role: member.role || 'staff',
          isSeller: !!member.isSeller,
          isTech: !!member.isTech,
          isAdmin: !!member.isAdmin,
          active: member.active !== false,
        })
        setInfo('')
        return
      }
      setError('Login concluído, mas nenhum perfil encontrado no banco de dados.')
    } catch (err) {
      setError(mapAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7faf9]">
      <div className="w-[420px] bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <div className="font-bold text-xl">Siste<span className="text-green-600">Mix</span></div>
          <div className="text-sm text-gray-600 mt-1">Acesse sua conta</div>
        </div>

        {/* Alternador removido conforme solicitação */}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm">Email</label>
            <input className="mt-1 w-full border rounded p-2" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com" />
          </div>
          {!useEmailLink && (
            <div>
              <label className="text-sm">Senha</label>
              <input className="mt-1 w-full border rounded p-2" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••" />
            </div>
          )}
          {error && <div className="text-red-600 text-sm">{error}</div>}
          {info && <div className="text-blue-600 text-sm">{info}</div>}
          <button className="w-full bg-green-600 text-white py-2 rounded disabled:opacity-60" disabled={loading} type="submit">
            {loading ? (useEmailLink ? 'Enviando link...' : 'Entrando...') : (useEmailLink ? 'Enviar link por e-mail' : 'Entrar')}
          </button>
        </form>

        {/* Prompt para finalizar login por link quando aberto em outro dispositivo */}
        {isSignInWithEmailLink(auth, window.location.href) && !window.localStorage.getItem('emailForSignIn') && (
          <div className="mt-6 border-t pt-4">
            <div className="font-semibold text-sm mb-2">Finalizar login por link</div>
            <form className="space-y-3" onSubmit={handleCompleteWithPrompt}>
              <div>
                <label className="text-sm">Confirme seu e-mail</label>
                <input className="mt-1 w-full border rounded p-2" type="email" value={emailForLinkPrompt} onChange={e=>setEmailForLinkPrompt(e.target.value)} placeholder="voce@exemplo.com" />
              </div>
              <button className="w-full bg-green-600 text-white py-2 rounded disabled:opacity-60" disabled={loading} type="submit">
                {loading ? 'Finalizando...' : 'Finalizar login'}
              </button>
            </form>
          </div>
        )}

         {/* Texto informativo abaixo do botão removido conforme solicitação */}
      </div>
    </div>
  )
}
