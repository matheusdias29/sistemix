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
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-white text-gray-800 font-sans">
      {/* Esquerda: Branding e Ilustração */}
      <div className="hidden md:flex flex-col justify-between p-10 lg:p-16 bg-white relative overflow-hidden">
        <div>
          <div className="flex items-center gap-2 mb-6">
            <div className="text-green-600">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 15H5V8h14v10z"/>
              </svg>
            </div>
            <div className="font-bold text-2xl tracking-tight text-gray-900">Siste<span className="text-green-600">Mix</span> Comércio</div>
          </div>
          <h1 className="text-green-500 font-medium text-lg max-w-md">
            Transforme a gestão do seu negócio hoje mesmo com Sistemix Comércio!!
          </h1>
        </div>

        {/* Ilustração CSS do Dashboard Mobile */}
        <div className="flex-1 flex items-center justify-center mt-8 relative">
           {/* Círculo de fundo decorativo */}
           <div className="absolute w-96 h-96 bg-green-50 rounded-full blur-3xl -z-10"></div>
           
           {/* Mockup do Celular */}
           <div className="relative w-64 h-[500px] bg-white rounded-[2.5rem] border-8 border-gray-100 shadow-2xl overflow-hidden z-10">
              {/* Barra de status */}
              <div className="h-6 w-full bg-white flex justify-end items-center px-4 space-x-1">
                 <div className="w-1 h-1 bg-black rounded-full"></div>
                 <div className="w-1 h-1 bg-black rounded-full"></div>
                 <div className="w-3 h-1.5 bg-black rounded-sm"></div>
              </div>
              {/* Conteúdo do App Mock */}
              <div className="p-4 flex flex-col h-full bg-gray-50">
                 {/* Header App */}
                 <div className="flex justify-between items-center mb-4">
                    <div className="w-8 h-8 bg-green-100 rounded-full"></div>
                    <div className="w-20 h-4 bg-gray-200 rounded"></div>
                 </div>
                 {/* Cards */}
                 <div className="space-y-3">
                    <div className="bg-white p-3 rounded-xl shadow-sm">
                       <div className="w-8 h-8 bg-green-50 rounded-lg mb-2 flex items-center justify-center text-green-600 text-xs">R$</div>
                       <div className="h-3 w-16 bg-gray-100 rounded mb-1"></div>
                       <div className="h-5 w-24 bg-gray-800 rounded"></div>
                    </div>
                    <div className="flex gap-3">
                       <div className="bg-white p-3 rounded-xl shadow-sm flex-1">
                          <div className="h-3 w-10 bg-gray-100 rounded mb-2"></div>
                          <div className="h-4 w-full bg-green-500 rounded"></div>
                       </div>
                       <div className="bg-white p-3 rounded-xl shadow-sm flex-1">
                          <div className="h-3 w-10 bg-gray-100 rounded mb-2"></div>
                          <div className="h-4 w-full bg-gray-200 rounded"></div>
                       </div>
                    </div>
                    <div className="bg-white p-3 rounded-xl shadow-sm h-32 flex items-end justify-between px-2 pb-2">
                       {[40, 60, 30, 80, 50, 70, 45].map((h, i) => (
                          <div key={i} style={{height: `${h}%`}} className="w-2 bg-green-500 rounded-t-sm"></div>
                       ))}
                    </div>
                 </div>
                 {/* Botão flutuante */}
                 <div className="mt-auto mb-6 mx-auto w-32 h-10 bg-green-500 rounded-full shadow-lg"></div>
              </div>
           </div>

           {/* Elementos flutuantes decorativos (Cards laterais) */}
           <div className="absolute left-0 top-1/3 -translate-x-12 bg-white p-3 rounded-xl shadow-lg transform rotate-[-5deg] z-20 w-40 animate-pulse">
              <div className="flex items-center gap-2 mb-2">
                 <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">101</div>
                 <div className="text-xs font-bold text-gray-700">Vendas</div>
              </div>
              <div className="text-lg font-bold text-gray-900">R$ 7.002,92</div>
              <div className="text-[10px] text-green-500">+15%</div>
           </div>

           <div className="absolute right-0 bottom-1/3 translate-x-8 bg-white p-4 rounded-xl shadow-lg transform rotate-[5deg] z-0 w-48">
              <div className="text-xs text-gray-500 mb-1">Vendas este mês</div>
              <div className="text-xl font-bold text-gray-900 mb-2">R$ 32.000,00</div>
              <div className="flex items-end justify-between h-8 gap-1">
                 {[20, 40, 30, 50, 80, 60].map((h, i) => (
                    <div key={i} style={{height: `${h}%`}} className="w-1.5 bg-green-500 rounded-t-sm"></div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      {/* Direita: Formulário de Login */}
      <div className="flex flex-col justify-center px-8 md:px-20 lg:px-32 bg-white">
        <div className="w-full max-w-md mx-auto">
          
          {/* Mobile Logo */}
          <div className="flex md:hidden items-center gap-2 mb-8 justify-center">
             <div className="text-green-600">
               <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                 <path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 15H5V8h14v10z"/>
               </svg>
             </div>
             <div className="font-bold text-xl tracking-tight text-gray-900">Siste<span className="text-green-600">Mix</span></div>
          </div>

          <div className="mb-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-2">Login</h2>
            <p className="text-gray-500">Entre com seu e-mail e senha para acessar sua conta.</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <input 
                className="w-full bg-gray-100 border-transparent focus:border-green-500 focus:bg-white focus:ring-0 rounded-lg px-4 py-3 text-gray-700 placeholder-gray-400 transition-colors" 
                type="email" 
                value={email} 
                onChange={e=>setEmail(e.target.value)} 
                placeholder="nome@email.com" 
              />
            </div>
            
            {!useEmailLink && (
              <div>
                <input 
                  className="w-full bg-gray-100 border-transparent focus:border-green-500 focus:bg-white focus:ring-0 rounded-lg px-4 py-3 text-gray-700 placeholder-gray-400 transition-colors" 
                  type="password" 
                  value={password} 
                  onChange={e=>setPassword(e.target.value)} 
                  placeholder="••••••••" 
                />
              </div>
            )}

            {error && <div className="text-red-500 text-sm">{error}</div>}
            {info && <div className="text-blue-500 text-sm">{info}</div>}

            <div className="flex items-center justify-between text-sm">
              <div className="text-gray-500">
                Não possui conta? <a href="#" className="text-green-500 font-semibold hover:underline">Experimente Grátis</a>
              </div>
              <a href="#" className="text-green-500 font-semibold hover:underline">Esqueceu sua Senha?</a>
            </div>

            <button 
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg uppercase tracking-wide transition-colors shadow-md disabled:opacity-60 disabled:cursor-not-allowed" 
              disabled={loading} 
              type="submit"
            >
              {loading ? (useEmailLink ? 'Enviando link...' : 'Entrando...') : (useEmailLink ? 'Enviar link' : 'Faça Login')}
            </button>
          </form>

          {/* Prompt para finalizar login por link quando aberto em outro dispositivo */}
          {isSignInWithEmailLink(auth, window.location.href) && !window.localStorage.getItem('emailForSignIn') && (
            <div className="mt-8 border-t border-gray-100 pt-6">
              <div className="font-semibold text-gray-900 mb-4">Finalizar login por link</div>
              <form className="space-y-4" onSubmit={handleCompleteWithPrompt}>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Confirme seu e-mail</label>
                  <input 
                    className="w-full bg-gray-100 border-transparent focus:border-green-500 focus:bg-white focus:ring-0 rounded-lg px-4 py-3" 
                    type="email" 
                    value={emailForLinkPrompt} 
                    onChange={e=>setEmailForLinkPrompt(e.target.value)} 
                    placeholder="nome@email.com" 
                  />
                </div>
                <button 
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg uppercase tracking-wide transition-colors shadow-md" 
                  disabled={loading} 
                  type="submit"
                >
                  {loading ? 'Finalizando...' : 'Finalizar login'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
