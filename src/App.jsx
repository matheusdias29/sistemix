import React, {useState} from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import SummaryCard from './components/SummaryCard'
import ProductsPage from './components/ProductsPage'
import ServiceOrdersPage from './components/ServiceOrdersPage'
import IntegrationsCard from './components/IntegrationsCard'
import NotificationsCard from './components/NotificationsCard'
import ClientsPage from './components/ClientsPage'
import SalesPage from './components/SalesPage'

export default function App(){
  const [view, setView] = useState('inicio')
  const [user] = useState({name: 'MATHEUS'})

  const labels = {
    inicio: 'Início',
    clientes: 'Clientes',
    produtos: 'Produtos',
    vendas: 'Vendas',
    caixa: 'Caixa',
    notas: 'Notas fiscais',
    os: 'Ordem de Serviço',
    cpagar: 'Contas a pagar',
    creceber: 'Contas a receber',
    estatisticas: 'Estatísticas',
  }

  return (
    <div className="min-h-screen bg-[#f7faf9]">
      <div className="flex">
        <Sidebar onNavigate={setView} active={view} />
        <div className="flex-1 p-6">
          <Header user={user} title={labels[view] || 'Início'} />

          {view === 'inicio' ? (
            <>
              <div className="grid grid-cols-3 gap-6 mt-6">
                <div className="col-span-2">
                  <SummaryCard />
                  <div className="mt-6 grid grid-cols-2 gap-6">
                    <div>
                      <div className="rounded-lg bg-white p-6 shadow">
                        <h3 className="font-semibold text-lg">Metas do Mês</h3>
                        <p className="mt-3 text-sm text-gray-600">Definir Uma Meta De Vendas</p>
                      </div>
                      <div className="mt-4 rounded-lg bg-white p-6 shadow">
                        <h3 className="font-semibold text-lg">Últimos dias</h3>
                        <ul className="mt-3 text-sm text-gray-700 space-y-2">
                          <li className="flex justify-between">02/10 - quinta-feira <span className="text-green-600">R$ 2.243,90</span></li>
                          <li className="flex justify-between">01/10 - quarta-feira <span className="text-green-600">R$ 838,90</span></li>
                          <li className="flex justify-between">30/09 - terça-feira <span className="text-green-600">R$ 1.183,70</span></li>
                        </ul>
                      </div>
                    </div>

                    <div>
                      <IntegrationsCard />
                      <div className="mt-4">
                        <NotificationsCard />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  {/* Right column short cards placeholder */}
                  <div className="rounded-lg bg-white p-6 shadow">
                    <h3 className="font-semibold">Resumo lateral</h3>
                    <p className="mt-2 text-sm text-gray-600">Ações rápidas e resumo</p>
                  </div>
                </div>
              </div>
            </>
          ) : view === 'vendas' ? (
            <div className="mt-6">
              <SalesPage />
            </div>
          ) : view === 'produtos' ? (
            <div className="mt-6">
              <ProductsPage />
            </div>
          ) : view === 'os' ? (
            <div className="mt-6">
              <ServiceOrdersPage />
            </div>
          ) : view === 'clientes' ? (
            <div className="mt-6">
              <ClientsPage />
            </div>
          ) : (
            <div className="rounded-lg bg-white p-6 shadow mt-6">
              <p className="text-sm text-gray-600">Página em construção.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}