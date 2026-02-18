import React, { useEffect, useState } from 'react'
import { listStoresByOwner } from '../services/stores'
import iPhoneImg from '../assets/17pm.webp'
import logoWhite from '../assets/logofundobranco.png'

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
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 font-sans">
      {/* Esquerda: Branding e Ilustração (Mantido do Login) */}
      <div className="hidden md:flex flex-col justify-between p-10 lg:p-16 bg-[#1a1c23] relative overflow-hidden border-r border-gray-700">
        <div>
          <div className="flex items-center gap-2 mb-6">
            <img 
              src={logoWhite} 
              alt="SisteMix" 
              className="h-12 w-auto object-contain"
            />
            <div>
              <div className="font-bold text-2xl tracking-tight text-white flex items-baseline">
                <span>Siste<span className="text-green-500">Mix</span> Comércio</span>
                <span className="ml-1 text-[12px] text-green-500 relative -top-1">®</span>
              </div>
              <div className="text-[8px] leading-[0.5] uppercase tracking-widest text-gray-300 text-center">
                O SEU GESTOR NA PALMA DA SUA MÃO
              </div>
            </div>
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

      {/* Direita: Seleção de Loja */}
      <div className="flex flex-col justify-center items-center p-8 bg-white">
        <div className="w-full max-w-2xl">
          {/* Mobile Branding */}
          <div className="flex flex-col items-center justify-center mb-8 md:hidden">
            <div className="flex items-center gap-2">
              <img 
                src={logoWhite} 
                alt="SisteMix" 
                className="h-10 w-auto object-contain"
              />
              <div>
                <div className="font-bold text-xl tracking-tight text-gray-900 flex items-baseline">
                  <span>Siste<span className="text-green-600">Mix</span> Comércio</span>
                  <span className="ml-1 inline-flex items-center justify-center rounded-full bg-green-600 text-white text-[10px] leading-none h-4 w-4 relative -top-1">R</span>
                </div>
                <div className="text-[8px] leading-[0.9] uppercase tracking-widest text-gray-500 text-center">
                  O SEU GESTOR NA PALMA DA SUA MÃO
                </div>
              </div>
            </div>
          </div>

          <div className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Minhas Empresas</h1>
            <p className="text-gray-500 text-lg">Selecione qual empresa você quer acessar</p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-gray-500">
               <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
               Carregando lojas...
            </div>
          ) : stores.length === 0 ? (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-8 text-center">
              <div className="text-gray-500 mb-4">Nenhuma loja encontrada para sua conta.</div>
              <button className="text-green-600 font-semibold hover:underline">
                Criar minha primeira loja
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {stores.map(s => (
                <div 
                  key={s.id} 
                  className="group bg-white border border-gray-200 hover:border-green-500 rounded-xl p-4 cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md flex items-center justify-between"
                  onClick={() => onSelect(s)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg group-hover:text-green-600 transition-colors uppercase">{s.name}</h3>
                      <p className="text-sm text-gray-500">{s.category || 'Comércio Varejista'}</p>
                    </div>
                  </div>
                  
                  <div className="bg-green-500 text-white px-6 py-2 rounded-lg font-semibold text-sm uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                    Acessar
                  </div>
                  <div className="text-gray-300 group-hover:hidden">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-12 pt-6 border-t border-gray-100">
             <a href="#" className="text-green-500 text-sm font-semibold hover:underline flex items-center gap-2">
               Cadastrar nova conta de empresa
             </a>
          </div>
        </div>
      </div>
    </div>
  )
}
