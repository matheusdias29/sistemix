import React, { useMemo } from 'react'

export default function CommissionsModal({ open, onClose, orders, store }) {
  if (!open) return null

  // Aggregation Logic
  const report = useMemo(() => {
    const attendantMap = {}
    const techMap = {}
    const commSettings = store?.commissionsSettings || {}

    orders.forEach(o => {
      const status = (o.status || '').toLowerCase()
      // Skip cancelled
      if (status.includes('cancelad')) return

      const isSale = status === 'venda' || status === 'cliente final' || status === 'cliente lojista'
      // Use the same logic as HomePage for "Finished OS"
      const isOS = status.includes('finalizada') || status.includes('faturada')

      if (isSale) {
        const attName = o.attendantName || o.attendant || 'Não informado'
        const attKey = o.attendantId || attName // Group by ID if possible
        
        if (!attendantMap[attKey]) attendantMap[attKey] = { name: attName, total: 0, commission: 0 }
        attendantMap[attKey].total += Number(o.total || o.valor || 0)

        // Commission Calculation
        if (o.commissions?.salesAttendantValue !== undefined) {
            attendantMap[attKey].commission += Number(o.commissions.salesAttendantValue || 0)
        } else {
            const pct = Number(commSettings.salesAttendantPercent || 0)
            attendantMap[attKey].commission += (Number(o.total || o.valor || 0) * (pct / 100))
        }

      } else if (isOS) {
        // OS - Technician
        if (o.technicianName || o.technician) {
            const techName = o.technicianName || o.technician
            const techKey = o.technicianId || techName
            if (!techMap[techKey]) techMap[techKey] = { name: techName, total: 0, commission: 0 }
            techMap[techKey].total += Number(o.total || o.valor || 0)

            // Commission Calculation
            if (o.commissions?.osTechnicianValue !== undefined) {
                techMap[techKey].commission += Number(o.commissions.osTechnicianValue || 0)
            } else {
                const pct = Number(commSettings.osTechnicianPercent || 0)
                techMap[techKey].commission += (Number(o.total || o.valor || 0) * (pct / 100))
            }
        }
        
        // OS - Attendant (if we want to track OS attendant performance too)
        // ...
      }
    })

    const attendants = Object.values(attendantMap).sort((a, b) => b.total - a.total)
    const technicians = Object.values(techMap).sort((a, b) => b.total - a.total)

    return { attendants, technicians }
  }, [orders, store])

  const formatCurrency = (n) => Number(n||0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/70" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg w-[95vw] max-w-[600px] flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
          <h3 className="font-semibold text-lg text-gray-800 dark:text-white">Comissões e Desempenho</h3>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">✕</button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-8">
          
          {/* Attendants Section */}
          <div>
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span className="p-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded">🛒</span> Vendas por Atendente
            </h4>
            {report.attendants.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">Nenhuma venda registrada.</p>
            ) : (
              <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 font-medium">
                    <tr>
                      <th className="px-4 py-2">Atendente</th>
                      <th className="px-4 py-2 text-right">Total Vendido</th>
                      <th className="px-4 py-2 text-right">Comissão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {report.attendants.map((a, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-2 text-gray-800 dark:text-gray-200">{a.name}</td>
                        <td className="px-4 py-2 text-right font-medium text-green-600 dark:text-green-400">
                          {formatCurrency(a.total)}
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-gray-700 dark:text-gray-300">
                          {formatCurrency(a.commission)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Technicians Section */}
          <div>
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
              <span className="p-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded">🔧</span> O.S. por Técnico
            </h4>
            {report.technicians.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">Nenhuma O.S. finalizada.</p>
            ) : (
              <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 font-medium">
                    <tr>
                      <th className="px-4 py-2">Técnico</th>
                      <th className="px-4 py-2 text-right">Total O.S.</th>
                      <th className="px-4 py-2 text-right">Comissão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {report.technicians.map((t, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-4 py-2 text-gray-800 dark:text-gray-200">{t.name}</td>
                        <td className="px-4 py-2 text-right font-medium text-blue-600 dark:text-blue-400">
                          {formatCurrency(t.total)}
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-gray-700 dark:text-gray-300">
                          {formatCurrency(t.commission)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t dark:border-gray-700 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
