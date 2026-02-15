import React, { useEffect, useState } from 'react'
import { login, findUserByEmail, findMemberByEmail } from '../services/users'
import { createTrialRequest } from '../services/trialRequests'
import { auth } from '../lib/firebase'
import { isSignInWithEmailLink, sendSignInLinkToEmail, signInWithEmailLink } from 'firebase/auth'
import iPhoneImg from '../assets/17pm.webp'
import logoWhite from '../assets/logofundobranco.png'

export default function LoginPage({ onLoggedIn }){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [useEmailLink, setUseEmailLink] = useState(false)
  const [emailForLinkPrompt, setEmailForLinkPrompt] = useState('')

  // Estados para cadastro
  const [isRegistering, setIsRegistering] = useState(false)
  const [regName, setRegName] = useState('')
  const [regWhatsapp, setRegWhatsapp] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showLoginPassword, setShowLoginPassword] = useState(false)

  // Estados de endereço removidos do cadastro

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
        if (owner) {
          const status = owner.status || (owner.active === false ? 'cancelado' : 'ativo')
          if (status === 'cancelado') {
            setError('Seu acesso foi cancelado. Entre em contato com o suporte.')
            setInfo('')
            setLoading(false)
            return
          }
          onLoggedIn(owner)
          setInfo('')
          return
        }
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
            permissions: member.permissions || {},
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
      if (owner) {
        const status = owner.status || (owner.active === false ? 'cancelado' : 'ativo')
        if (status === 'cancelado') {
          setError('Seu acesso foi cancelado. Entre em contato com o suporte.')
          setInfo('')
          setLoading(false)
          return
        }
        onLoggedIn(owner)
        setInfo('')
        return
      }
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
          permissions: member.permissions || {},
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

  // handleSearchCep removido

  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    if(!regName || !regEmail || !regPassword) {
      setError('Preencha todos os campos obrigatórios.')
      setLoading(false)
      return
    }

    try {
        const existing = await findUserByEmail(regEmail)
        if(existing) {
            setError('Este e-mail já está em uso em uma conta ativa.')
            setLoading(false)
            return
        }
        const reqId = await createTrialRequest({
          name: regName,
          email: regEmail,
          whatsapp: regWhatsapp,
          tempPassword: regPassword
        })
        setInfo('Solicitação enviada! Você será notificado por e-mail após análise.')
        // Redireciona para WhatsApp com mensagem pré-formatada
        const msg = `quero ativar meu teste gratis%0Aemail: ${encodeURIComponent(regEmail)}%0Aprotocolo: ${encodeURIComponent(reqId)}`
        const phone = '5518996003093'
        window.location.href = `https://wa.me/${phone}?text=${msg}`

    } catch (err) {
        console.error(err)
        setError(err?.message || 'Não foi possível enviar sua solicitação. Tente novamente.')
    } finally {
        setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 font-sans">
      {/* Esquerda: Branding e Ilustração (Cinza Escuro) */}
      <div className="hidden md:flex flex-col justify-between p-10 lg:p-16 bg-[#1a1c23] relative overflow-hidden border-r border-gray-700">
        <div>
          <div className="flex items-center gap-1 mb-6">
            <img 
              src={logoWhite} 
              alt="SisteMix" 
              className="h-12 w-auto object-contain"
            />
            <div className="font-bold text-2xl tracking-tight text-white">Siste<span className="text-green-500">Mix</span> Comércio</div>
          </div>
          <h1 className="text-gray-300 font-medium text-lg max-w-md">
            A gestão do seu negócio na palma da sua mão ou em qualquer lugar!!
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
              <div className="p-4 flex flex-col h-full bg-white relative">
                 {/* Mensagem de Venda Concluída */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-white/90">
                     
                     {/* Header Interno do Celular */}
                     <div className="absolute top-4 w-full text-center">
                        <div className="font-bold text-lg text-gray-800">Siste<span className="text-green-600">Mix</span> Comércio</div>
                     </div>

                     <div className="w-16 h-16 rounded-full border-4 border-green-500 flex items-center justify-center mb-4">
                       <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                       </svg>
                    </div>
                    <div className="text-gray-500 text-sm font-medium mb-1">Venda concluída</div>
                    <div className="text-3xl font-bold text-gray-900 mb-8">R$ 99,90</div>
                    
                    <div className="w-full px-8 space-y-3">
                       <div className="w-full h-10 border border-green-500 rounded-lg flex items-center justify-center text-green-600 font-medium text-sm">Enviar Recibo</div>
                       <div className="w-full h-10 bg-green-500 rounded-lg flex items-center justify-center text-white font-medium text-sm shadow-lg shadow-green-200">Nova Venda</div>
                    </div>
                 </div>

                 {/* Fundo desfocado (conteúdo anterior) */}
                  <div className="flex justify-between items-center mb-4 opacity-20">
                     <div className="w-8 h-8 bg-green-100 rounded-full"></div>
                     <div className="font-bold text-lg text-gray-800">Siste<span className="text-green-600">Mix</span> Comércio</div>
                  </div>
                  {/* Cards */}
                 <div className="space-y-3 opacity-20">
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
                 </div>
              </div>
           </div>

           {/* Elementos flutuantes decorativos (Cards laterais) */}
           
           {/* Card Superior Esquerdo */}
           <div className="absolute left-1/2 top-1/2 -translate-x-[260px] -translate-y-[180px] bg-white p-3 rounded-xl shadow-lg z-20 w-40 animate-pulse">
              <div className="flex items-center gap-2 mb-2">
                 <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">139</div>
                 <div className="text-xs font-bold text-gray-700">Vendas</div>
              </div>
              <div className="text-lg font-bold text-gray-900">R$ 14.999,90</div>
              <div className="text-[10px] text-green-500">+15%</div>
           </div>

           {/* Card Inferior Esquerdo */}
           <div className="absolute left-1/2 top-1/2 -translate-x-[280px] translate-y-[60px] bg-white p-4 rounded-xl shadow-lg z-20 w-48">
              <div className="text-xs text-gray-500 mb-1">A Receber</div>
              <div className="text-xl font-bold text-gray-900 mb-2">R$ 15.549,00</div>
              <div className="text-[10px] text-green-500">+25%</div>
              <div className="flex items-end justify-between h-8 gap-1">
                 {[20, 40, 60, 50, 30, 70].map((h, i) => (
                    <div key={i} style={{height: `${h}%`}} className="w-1.5 bg-green-500 rounded-t-sm"></div>
                 ))}
              </div>
           </div>

           {/* Card Superior Direito */}
           
           {/* Novo Card Promocional iPhone (Acima do popup de Clientes) */}
           <div className="absolute left-1/2 top-1/2 translate-x-[100px] -translate-y-[245px] bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-xl z-30 w-48 transition-all duration-300 hover:scale-105 cursor-pointer border border-gray-100 group">
              <div className="absolute -right-2 -top-2 bg-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-400 hover:text-red-500"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </div>
              
              <div className="flex gap-3">
                 <div className="w-12 h-16 bg-white rounded-md flex-shrink-0 relative overflow-hidden shadow-sm ring-1 ring-gray-100">
                    <img src={iPhoneImg} alt="iPhone 17 Pro Max" className="w-full h-full object-cover" />
                 </div>
                 <div className="flex flex-col justify-between py-0.5 w-full">
                    <div>
                       <div className="text-[10px] font-bold text-gray-800 leading-tight mb-1">iPhone 17 Pro Max</div>
                       <div className="flex flex-wrap gap-1">
                          <span className="text-[8px] bg-gray-50 text-gray-500 px-1 rounded border border-gray-100">Capa Premium</span>
                          <span className="text-[8px] bg-gray-50 text-gray-500 px-1 rounded border border-gray-100">30W</span>
                       </div>
                    </div>
                    <div className="text-right">
                       <div className="text-sm font-bold text-green-600">R$ 7.999,99</div>
                       <div className="text-[10px] font-bold text-blue-600 hover:underline">Comprar agora &rarr;</div>
                    </div>
                 </div>
              </div>
           </div>

           <div className="absolute left-1/2 top-1/2 translate-x-[100px] -translate-y-[120px] bg-white p-3 rounded-xl shadow-lg z-20 w-40">
              <div className="flex items-center gap-2 mb-2">
                 <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">+500</div>
                 <div className="text-xs font-bold text-gray-700">Clientes Ativos</div>
                
              </div>
               <div className="text-[10px] text-green-500">+55%</div>
              <div className="flex items-end justify-between h-8 gap-1">
                 {[20, 40, 30, 50, 80, 60].map((h, i) => (
                    <div key={i} style={{height: `${h}%`}} className="w-1.5 bg-green-500 rounded-t-sm"></div>
                 ))}
              </div>
              
           </div>

           {/* Card Inferior Direito */}
           <div className="absolute left-1/2 top-1/2 translate-x-[110px] translate-y-[80px] bg-white p-4 rounded-xl shadow-lg z-20 w-48 animate-pulse">
              <div className="text-xs text-gray-500 mb-1">Vendas este mês</div>
              <div className="text-xl font-bold text-gray-900 mb-2">R$ 45.000,00</div>
              <div className="text-[10px] text-green-500">Meta +15%</div>
              <div className="flex items-end justify-between h-8 gap-1">
                 {[20, 40, 30, 50, 80, 60].map((h, i) => (
                    <div key={i} style={{height: `${h}%`}} className="w-1.5 bg-green-500 rounded-t-sm"></div>
                 ))}
              </div>
           </div>

        </div>
      </div>

      {/* Direita: Formulário de Login ou Cadastro (Cinza Claro) */}
      <div className="flex flex-col justify-center items-center p-8 bg-gray-100">
        <div className="w-full max-w-md space-y-8">
          
          {isRegistering ? (
             // FORMULÁRIO DE CADASTRO
             <>
               <div className="text-left">
                  <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Teste grátis por 7 dias!</h2>
                  <p className="mt-2 text-sm text-gray-500">
                    Já possui conta? <button onClick={() => setIsRegistering(false)} className="text-green-500 font-bold hover:underline uppercase">FAÇA LOGIN</button>
                  </p>
               </div>

               <form className="space-y-4" onSubmit={handleRegister}>
                  <input 
                    className="w-full bg-[#E8F0FE] border-transparent focus:border-green-500 focus:bg-white focus:ring-0 rounded-lg px-4 py-3 text-gray-700 placeholder-gray-400 transition-colors" 
                    type="text" 
                    value={regName} 
                    onChange={e=>setRegName(e.target.value)} 
                    placeholder="Seu NOME" 
                    required
                  />
                  <input 
                    className="w-full bg-[#E8F0FE] border-transparent focus:border-green-500 focus:bg-white focus:ring-0 rounded-lg px-4 py-3 text-gray-700 placeholder-gray-400 transition-colors" 
                    type="text" 
                    value={regWhatsapp} 
                    onChange={e=>setRegWhatsapp(e.target.value)} 
                    placeholder="Seu WHATSAPP" 
                  />
                  <input 
                    className="w-full bg-[#E8F0FE] border-transparent focus:border-green-500 focus:bg-white focus:ring-0 rounded-lg px-4 py-3 text-gray-700 placeholder-gray-400 transition-colors" 
                    type="email" 
                    value={regEmail} 
                    onChange={e=>setRegEmail(e.target.value)} 
                    placeholder="seuemail@exemplo.com" 
                    required
                  />

                  {/* Campos de endereço removidos */}

                  <div className="relative">
                    <input 
                      className="w-full bg-[#E8F0FE] border-transparent focus:border-green-500 focus:bg-white focus:ring-0 rounded-lg px-4 py-3 text-gray-700 placeholder-gray-400 transition-colors pr-10" 
                      type={showPassword ? "text" : "password"}
                      value={regPassword} 
                      onChange={e=>setRegPassword(e.target.value)} 
                      placeholder="Senha" 
                      required
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {error && <div className="text-red-500 text-sm">{error}</div>}

                  <button 
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg uppercase tracking-wide transition-colors shadow-md disabled:opacity-60 disabled:cursor-not-allowed mt-4" 
                    disabled={loading} 
                    type="submit"
                  >
                    {loading ? 'Criando conta...' : 'Testar Gratuitamente'}
                  </button>

                  <p className="text-xs text-gray-500 mt-4 text-center">
                    Ao criar sua conta você concorda com nossos <a href="#" className="text-green-600 hover:underline">Termos de Uso</a> e <a href="#" className="text-green-600 hover:underline">Política de Privacidade</a>
                  </p>
               </form>
             </>
          ) : (
             // FORMULÁRIO DE LOGIN
             <>
                <div className="text-left">
                  <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Faça seu login abaixo</h2>
                  <p className="mt-2 text-sm text-gray-500">
                    Entre com seu e-mail e senha para acessar sua conta.
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center py-6 md:hidden">
                  <div className="flex items-center gap-1 mb-2">
                    <img 
                      src={logoWhite} 
                      alt="SisteMix" 
                      className="h-10 w-auto object-contain"
                    />
                    <div className="font-bold text-xl tracking-tight text-gray-900">Siste<span className="text-green-600">Mix</span> Comércio</div>
                  </div>
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
                    <div className="relative">
                      <input 
                        className="w-full bg-gray-100 border-transparent focus:border-green-500 focus:bg-white focus:ring-0 rounded-lg px-4 pr-12 py-3 text-gray-700 placeholder-gray-400 transition-colors" 
                        type={showLoginPassword ? 'text' : 'password'}
                        value={password} 
                        onChange={e=>setPassword(e.target.value)} 
                        placeholder="••••••••" 
                      />
                      <button 
                        type="button"
                        aria-label={showLoginPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        title={showLoginPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        onClick={() => setShowLoginPassword(v=>!v)}
                        className="absolute inset-y-0 right-0 w-10 flex items-center justify-center bg-gray-200 text-gray-600 rounded-r-lg hover:bg-gray-300"
                      >
                        {showLoginPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}

                  {error && <div className="text-red-500 text-sm">{error}</div>}
                  {info && <div className="text-blue-500 text-sm">{info}</div>}

                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-500">
                      Não possui conta? <button type="button" onClick={() => setIsRegistering(true)} className="text-green-500 font-semibold hover:underline">Experimente Grátis</button>
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
             </>
          )}
        </div>
      </div>
      {/* Botão Flutuante do WhatsApp */}
      <a 
        href="https://wa.me/5518996003093" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110 flex items-center justify-center group"
        title="Fale conosco no WhatsApp"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.463 1.065 2.876 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
        </svg>
        <span className="absolute right-full mr-3 bg-white text-gray-800 px-3 py-1 rounded-lg text-sm font-medium shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Fale conosco
        </span>
      </a>
    </div>
  )
}
