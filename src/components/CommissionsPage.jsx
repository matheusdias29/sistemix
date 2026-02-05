import React, { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Calendar, DollarSign, User, Wrench, Search, Filter, TrendingUp } from 'lucide-react'
import { listenOrders } from '../services/orders'

const currency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

export default function CommissionsPage({ storeId, store, onNavigate }) {
  const [orders, setOrders] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM

  useEffect(() => {
    const unsub = listenOrders((data) => setOrders(data), storeId)
    return () => unsub()
  }, [storeId])

  const filteredOrders = useMemo(() => {
    if (!selectedMonth) return orders
    return orders.filter(o => {
      const date = o.createdAt ? (o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt)) : new Date()
      const month = date.toISOString().slice(0, 7)
      return month === selectedMonth
    })
  }, [orders, selectedMonth])

  const report = useMemo(() => {
    const salesByAttendant = {}
    const osByTechnician = {}
    const osByAttendant = {}
    
    const commSettings = store?.commissionsSettings || {}
    const salesPct = Number(commSettings.salesAttendantPercent || 0)
    const osTechPct = Number(commSettings.osTechnicianPercent || 0)
    const osAttPct = Number(commSettings.osAttendantPercent || 0)

    filteredOrders.forEach(o => {
      const status = (o.status || '').toLowerCase()
      if (status.includes('cancelad')) return

      const isSale = status === 'venda' || status === 'cliente final' || status === 'cliente lojista' || status === 'finalizado'
      const isOS = status.includes('finalizada') || status.includes('faturada') || status === 'entregue'

      if (isSale) {
        // Vendas - Comissão para Atendente
        const attName = o.attendant || o.attendantName || 'Não informado'
        if (!salesByAttendant[attName]) salesByAttendant[attName] = { name: attName, total: 0, commission: 0, count: 0 }
        
        const total = Number(o.total || o.valor || 0)
        salesByAttendant[attName].total += total
        salesByAttendant[attName].count += 1

        // Prioriza valor salvo no pedido, senão calcula
        if (o.commissions?.salesAttendantValue !== undefined) {
          salesByAttendant[attName].commission += Number(o.commissions.salesAttendantValue || 0)
        } else {
          salesByAttendant[attName].commission += (total * (salesPct / 100))
        }
      } 
      
      if (isOS) {
        const total = Number(o.total || o.valor || 0)

        // OS - Comissão para Técnico
        if (o.technician || o.technicianName) {
          const techName = o.technician || o.technicianName
          if (!osByTechnician[techName]) osByTechnician[techName] = { name: techName, total: 0, commission: 0, count: 0 }
          
          osByTechnician[techName].total += total
          osByTechnician[techName].count += 1

          if (o.commissions?.osTechnicianValue !== undefined) {
            osByTechnician[techName].commission += Number(o.commissions.osTechnicianValue || 0)
          } else {
            osByTechnician[techName].commission += (total * (osTechPct / 100))
          }
        }

        // OS - Comissão para Atendente
        if (o.attendant || o.attendantName) {
          const attName = o.attendant || o.attendantName
          if (!osByAttendant[attName]) osByAttendant[attName] = { name: attName, total: 0, commission: 0, count: 0 }
          
          osByAttendant[attName].total += total
          osByAttendant[attName].count += 1

          if (o.commissions?.osAttendantValue !== undefined) {
            osByAttendant[attName].commission += Number(o.commissions.osAttendantValue || 0)
          } else {
            osByAttendant[attName].commission += (total * (osAttPct / 100))
          }
        }
      }
    })

    return {
      sales: Object.values(salesByAttendant).sort((a, b) => b.commission - a.commission),
      osTechnician: Object.values(osByTechnician).sort((a, b) => b.commission - a.commission),
      osAttendant: Object.values(osByAttendant).sort((a, b) => b.commission - a.commission)
    }
  }, [filteredOrders, store])

  const totalCommission = 
    report.sales.reduce((acc, i) => acc + i.commission, 0) +
    report.osTechnician.reduce((acc, i) => acc + i.commission, 0) +
    report.osAttendant.reduce((acc, i) => acc + i.commission, 0)

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate('inicio')}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Relatório de Comissões</h1>
            <p className="text-gray-500">Acompanhe o desempenho e comissões da equipe</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
          <Calendar size={20} className="text-gray-400 ml-2" />
          <input 
            type="month" 
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="outline-none text-gray-700 font-medium bg-transparent"
          />
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <DollarSign size={20} />
            </div>
            <h3 className="font-semibold text-gray-600">Total Comissões</h3>
          </div>
          <div className="text-2xl font-bold text-gray-900">{currency(totalCommission)}</div>
          <div className="text-sm text-gray-500 mt-1">Neste mês</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Vendas - Atendentes */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <User size={20} />
              </div>
              <h3 className="font-bold text-gray-800">Vendas (Atendentes)</h3>
            </div>
            <div className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              {store?.commissionsSettings?.salesAttendantPercent || 0}%
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {report.sales.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Nenhuma venda neste período</div>
            ) : (
              report.sales.map((item, idx) => (
                <div key={idx} className="p-5 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-bold text-gray-900 text-lg">{item.name}</div>
                    <div className="font-bold text-green-600 bg-green-50 px-2 py-1 rounded text-sm">
                      + {currency(item.commission)}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <div>{item.count} vendas realizadas</div>
                    <div>Total vendido: <span className="font-medium text-gray-700">{currency(item.total)}</span></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* OS - Técnicos */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
                <Wrench size={20} />
              </div>
              <h3 className="font-bold text-gray-800">O.S. (Técnicos)</h3>
            </div>
            <div className="text-sm font-medium text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
              {store?.commissionsSettings?.osTechnicianPercent || 0}%
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {report.osTechnician.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Nenhuma O.S. finalizada neste período</div>
            ) : (
              report.osTechnician.map((item, idx) => (
                <div key={idx} className="p-5 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-bold text-gray-900 text-lg">{item.name}</div>
                    <div className="font-bold text-green-600 bg-green-50 px-2 py-1 rounded text-sm">
                      + {currency(item.commission)}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <div>{item.count} serviços realizados</div>
                    <div>Total serviços: <span className="font-medium text-gray-700">{currency(item.total)}</span></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* OS - Atendentes (Só mostra se tiver comissão configurada ou gerada) */}
        {(report.osAttendant.some(i => i.commission > 0) || Number(store?.commissionsSettings?.osAttendantPercent || 0) > 0) && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden lg:col-span-2">
             <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                  <User size={20} />
                </div>
                <h3 className="font-bold text-gray-800">O.S. (Atendentes)</h3>
              </div>
              <div className="text-sm font-medium text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
                {store?.commissionsSettings?.osAttendantPercent || 0}%
              </div>
            </div>
            <div className="divide-y divide-gray-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {report.osAttendant.length === 0 ? (
                <div className="p-8 text-center text-gray-500 col-span-full">Nenhuma O.S. com atendente neste período</div>
              ) : (
                report.osAttendant.map((item, idx) => (
                  <div key={idx} className="p-5 hover:bg-gray-50 transition-colors border-r border-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-gray-900 text-lg">{item.name}</div>
                      <div className="font-bold text-green-600 bg-green-50 px-2 py-1 rounded text-sm">
                        + {currency(item.commission)}
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-sm text-gray-500">
                      <div>{item.count} O.S. atendidas</div>
                      <div>Total: <span className="font-medium text-gray-700">{currency(item.total)}</span></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
