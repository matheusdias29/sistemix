import React, { useMemo, useState } from 'react'

export default function FiscalNotesPage({ storeId }){
  const [search, setSearch] = useState('')
  const [periodOpen, setPeriodOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)

  const notes = useMemo(() => ([
    { id: 'n1', type: 'nfe', series: 1, number: 1409, operation: 'Venda de Mercadorias', recipient: 'PREFEITURA MUNICIPAL DE COROADOS', issue: '13/11/2025', value: 64.90, status: 'authorized' },
    { id: 'n2', type: 'nfe', series: 1, number: 1408, operation: 'Venda de Mercadorias', recipient: 'SIDNEI SANTANA', issue: '12/11/2025', value: 1999.90, status: 'authorized' },
    { id: 'n3', type: 'nfe', series: 1, number: 1407, operation: 'Venda de Mercadorias', recipient: 'SOLANGE BORGES', issue: '10/11/2025', value: 171.00, status: 'authorized' },
    { id: 'n4', type: 'nfe', series: 1, number: 1406, operation: 'Venda de Mercadorias', recipient: 'PREFEITURA MUNICIPAL DE COROADOS', issue: '09/10/2025', value: 93.90, status: 'authorized' },
    { id: 'n5', type: 'nfe', series: 1, number: 1405, operation: 'Venda de Mercadorias', recipient: 'BEATRIZ STABILE GOBBY', issue: '07/10/2025', value: 50.00, status: 'authorized' },
    { id: 'n6', type: 'nfe', series: 1, number: 1404, operation: 'Venda de Mercadorias', recipient: 'PREFEITURA MUNICIPAL DE COROADOS', issue: '03/10/2025', value: 130.00, status: 'authorized' },
    { id: 'n7', type: 'nfe', series: 1, number: 1403, operation: 'Venda de Mercadorias', recipient: 'JACQUELINE MARTINS', issue: '12/09/2025', value: 2300.00, status: 'authorized' },
    { id: 'n8', type: 'nfe', series: 1, number: 1402, operation: 'Venda de Mercadorias', recipient: 'PATRICIA GALHARDO', issue: '03/09/2025', value: 1499.90, status: 'authorized' },
    { id: 'n9', type: 'nfe', series: 1, number: 1399, operation: 'Venda de Mercadorias', recipient: 'ASSOCIAÇÃO DOS PROPRIETÁRIOS DO IMBANTE DE BONITO', issue: '23/08/2025', value: 899.90, status: 'authorized' },
    { id: 'n10', type: 'nfe', series: 1, number: 1398, operation: 'Venda de Mercadorias', recipient: 'JORGE RIBEIRO', issue: '21/08/2025', value: 390.00, status: 'authorized' },
    { id: 'n11', type: 'nfe', series: 1, number: 1397, operation: 'Venda de Mercadorias', recipient: 'JOÃO VICTOR RODRIGUES SANTOS', issue: '19/08/2025', value: 219.00, status: 'authorized' },
    { id: 'n12', type: 'nfe', series: 1, number: 1396, operation: 'Venda de Mercadorias', recipient: 'FÁTIMA DA SILVA CARDOZO', issue: '18/08/2025', value: 399.90, status: 'authorized' },
    { id: 'n13', type: 'nfe', series: 1, number: 1395, operation: 'Venda de Mercadorias', recipient: 'MARÍLIO CHINCHE', issue: '07/08/2025', value: 49.90, status: 'authorized' },
    { id: 'n14', type: 'nfe', series: 1, number: 1394, operation: 'Venda de Mercadorias', recipient: 'ANDREA CRISTINA MAGNANI ALVES', issue: '06/08/2025', value: 309.90, status: 'authorized' },
    { id: 'n15', type: 'nfe', series: 1, number: 1393, operation: 'Venda de Mercadorias', recipient: 'MATEUS GABRIEL FRADI', issue: '30/07/2025', value: 300.00, status: 'authorized' },
    { id: 'n16', type: 'nfe', series: 1, number: 1392, operation: 'Venda de Mercadorias', recipient: 'MARIANA SILVA', issue: '29/07/2025', value: 0, status: 'rejected' }
  ]), [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return notes
    return notes.filter(n => {
      return String(n.recipient).toLowerCase().includes(q) ||
             String(n.operation).toLowerCase().includes(q) ||
             String(n.number).includes(q)
    })
  }, [search, notes])

  const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const totals = useMemo(() => {
    const a = notes.filter(n => n.status === 'authorized')
    const p = notes.filter(n => n.status === 'pending')
    const r = notes.filter(n => n.status === 'rejected')
    return {
      authorized: { count: a.length, value: a.reduce((s, n) => s + Number(n.value || 0), 0) },
      pending: { count: p.length, value: p.reduce((s, n) => s + Number(n.value || 0), 0) },
      rejected: { count: r.length, value: r.reduce((s, n) => s + Number(n.value || 0), 0) }
    }
  }, [notes])

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex-1 max-w-md relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder="Pesquisar..."
            className="w-full pl-9 pr-3 py-2 rounded border bg-white text-sm border-gray-300"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button className="px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50" onClick={()=>setPeriodOpen(v=>!v)}>Período</button>
            {periodOpen && (
              <div className="absolute right-0 mt-2 bg-white border rounded shadow text-sm p-3 w-56">
                <div className="text-gray-600">Selecione um período</div>
              </div>
            )}
          </div>
          <div className="relative">
            <button className="px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-700 hover:bg-gray-50" onClick={()=>setFiltersOpen(v=>!v)}>Filtros</button>
            {filtersOpen && (
              <div className="absolute right-0 mt-2 bg-white border rounded shadow text-sm p-3 w-56">
                <div className="text-gray-600">Filtros</div>
              </div>
            )}
          </div>
          <div className="relative">
            <button className="px-4 py-2 bg-white border border-green-600 text-green-700 rounded text-sm font-semibold hover:bg-green-50" onClick={()=>setOptionsOpen(v=>!v)}>Opções</button>
            {optionsOpen && (
              <div className="absolute right-0 mt-2 bg-white border rounded shadow text-sm w-48">
                <button className="w-full text-left px-3 py-2 hover:bg-gray-50">Download XML</button>
                <button className="w-full text-left px-3 py-2 hover:bg-gray-50">Inutilizar Notas Fiscais</button>
              </div>
            )}
          </div>
          <div className="relative">
            <button className="px-4 py-2 bg-green-600 text-white rounded text-sm font-semibold hover:bg-green-700" onClick={()=>setNewOpen(v=>!v)}>+ Novo</button>
            {newOpen && (
              <div className="absolute right-0 mt-2 bg-white border rounded shadow text-sm w-36">
                <button className="w-full text-left px-3 py-2 hover:bg-gray-50">NF-e</button>
                <button className="w-full text-left px-3 py-2 hover:bg-gray-50">NFC-e</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-gray-50 border rounded p-3 mb-3 grid grid-cols-3 gap-3">
        <div>
          <div className="text-xs text-gray-600">Autorizadas ({totals.authorized.count})</div>
          <div className="text-green-600 font-bold">{money(totals.authorized.value)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-600">Pendentes ({totals.pending.count})</div>
          <div className="text-green-600 font-bold">{money(totals.pending.value)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-600">Rejeitadas ({totals.rejected.count})</div>
          <div className="text-green-600 font-bold">{money(totals.rejected.value)}</div>
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 font-medium border-b">
            <tr>
              <th className="py-3 px-4 text-left">NF-e</th>
              <th className="py-3 px-4 text-left">NFC-e</th>
              <th className="py-3 px-4 text-left">Sér./ Nº</th>
              <th className="py-3 px-4 text-left">Operação</th>
              <th className="py-3 px-4 text-left">Destinatário</th>
              <th className="py-3 px-4 text-left">Emissão</th>
              <th className="py-3 px-4 text-right">Valor</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(n => (
              <tr key={n.id} className="hover:bg-gray-50">
                <td className="py-3 px-4">{n.type === 'nfe' ? `${n.series}/${n.number}` : '-'}</td>
                <td className="py-3 px-4">{n.type === 'nfce' ? `${n.series}/${n.number}` : '-'}</td>
                <td className="py-3 px-4">{`${n.series}/${n.number}`}</td>
                <td className="py-3 px-4 text-gray-700">{n.operation}</td>
                <td className="py-3 px-4 text-gray-700">{n.recipient}</td>
                <td className="py-3 px-4 text-gray-600">{n.issue}</td>
                <td className="py-3 px-4 text-right font-medium">{money(n.value)}</td>
                <td className="py-3 px-4 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                    n.status === 'authorized' ? 'bg-green-50 text-green-700 border-green-200' :
                    n.status === 'pending' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                    'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {n.status === 'authorized' ? 'Autorizada' : n.status === 'pending' ? 'Pendente' : 'Rejeitada'}
                  </span>
                </td>
                <td className="py-3 px-4 text-center text-gray-400">⋮</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="9" className="px-6 py-10 text-center text-gray-500">Nenhuma nota encontrada.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
