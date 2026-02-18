import React, { useEffect, useMemo, useState } from 'react'
import { listenSubscription, upsertPlan, computeStatusWithInvoices } from '../services/subscriptions'
import { listenInvoices, generateInvoicesBatch } from '../services/invoices'
import { addInvoice } from '../services/invoices'
import { updateUser } from '../services/users'

const PLANS = [
  {
    id: 'start-2026',
    name: 'PLANO - START 2026',
    cycles: [
      { id: 'monthly', label: 'Mensal', price: 99.90 },
      { id: 'semiannual', label: 'Semestral', price: 499.90 },
      { id: 'annual', label: 'Anual', price: 999.90 },
    ],
    graceDays: 3,
    details: [
      'Até 3 usuários',
      'Cadastro de produtos, clientes e fornecedores',
      'Controle de estoque',
      'Controle de crediário',
      'PDV completo (computador e celular)',
      'Formas de pagamento',
      'Recibos digitais',
      'Catálogo online básico',
    ]
  },
  {
    id: 'premium-2026',
    name: 'PLANO - PREMIUM 2026',
    cycles: [
      { id: 'monthly', label: 'Mensal', price: 149.90 },
      { id: 'semiannual', label: 'Semestral', price: 699.90 },
      { id: 'annual', label: 'Anual', price: 1499.90 },
    ],
    graceDays: 5,
    details: [
      'Tudo do plano Essencial',
      'Até 5 usuários',
      'Controle de contas a pagar',
      'Cadastro de compras',
      'Importação de compras por XML',
      'Controle de taxas',
      'Controle de comissão',
      'Anexos em Ordens de Serviço',
      'Link de acompanhamento de OS',
      'Relatórios automáticos por e-mail',
    ]
  },
  {
    id: 'gold-2026',
    name: 'PLANO - GOLD 2026',
    cycles: [
      { id: 'monthly', label: 'Mensal', price: 189.90 },
      { id: 'semiannual', label: 'Semestral', price: 899.90 },
      { id: 'annual', label: 'Anual', price: 1899.90 },
    ],
    graceDays: 7,
    details: [
      'Tudo do plano Profissional',
      'Até 10 usuários',
      'Controle de metas de vendas',
      'Avaliação de atendimento no recibo',
      'Relatório DRE',
      'Assistente inteligente com IA',
      'Suporte prioritário',
    ]
  }
]

export default function SubscriptionPage({ user, onBack }) {
  const ownerId = user?.memberId ? user?.ownerId : user?.id
  const [sub, setSub] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [choosePlanOpen, setChoosePlanOpen] = useState(false)
  const [invoices, setInvoices] = useState([])
  const [filters, setFilters] = useState({ status: 'all', start: '', end: '', min: '', max: '', search: '' })
  const [batchLog, setBatchLog] = useState({ open: false, text: '' })

  useEffect(() => {
    if (!ownerId) return
    const stop = listenSubscription(ownerId, setSub)
    return () => stop && stop()
  }, [ownerId])

  useEffect(() => {
    if (!ownerId) return
    const stop = listenInvoices(ownerId, setInvoices)
    return () => stop && stop()
  }, [ownerId])

  const statusLabel = useMemo(() => {
    const st = computeStatusWithInvoices(sub, invoices)
    if (st === 'cancelado') return { text: 'Cancelado', className: 'bg-red-100 text-red-700' }
    if (st === 'em_atraso') return { text: 'Em atraso', className: 'bg-amber-100 text-amber-700' }
    return { text: 'Ativo', className: 'bg-green-100 text-green-700' }
  }, [sub, invoices])

  const formatDate = (d) => {
    if (!d) return '-'
    try {
      if (typeof d?.toDate === 'function') return d.toDate().toLocaleDateString()
      if (typeof d?.seconds === 'number') return new Date(d.seconds * 1000).toLocaleDateString()
      return new Date(d).toLocaleDateString()
    } catch { return '-' }
  }
  const parseDate = (d) => {
    try {
      if (typeof d?.toDate === 'function') return d.toDate()
      if (typeof d?.seconds === 'number') return new Date(d.seconds * 1000)
      return new Date(d)
    } catch { return null }
  }
  const daysOverdue = (due) => {
    const dd = parseDate(due)
    if (!dd) return 0
    const today = new Date()
    const diff = Math.floor((today.setHours(0,0,0,0) - dd.setHours(0,0,0,0)) / (1000*60*60*24))
    return diff > 0 ? diff : 0
  }

  const handleChoosePlan = async (plan) => {
    if (!ownerId) return
    setSaving(true)
    setError('')
    try {
      await upsertPlan(ownerId, plan)
      await updateUser(ownerId, { trial: false })
      setChoosePlanOpen(false)
    } catch (e) {
      setError('Erro ao salvar plano')
    } finally {
      setSaving(false)
    }
  }

  const [firstInvoiceMethod, setFirstInvoiceMethod] = useState('PIX')
  const hasAnyInvoice = invoices && invoices.length > 0
  const needsFirstInvoice = useMemo(() => {
    const trialEnd = sub?.trialEnd ? new Date(sub.trialEnd) : null
    return !!(sub?.planId && trialEnd && !hasAnyInvoice)
  }, [sub, hasAnyInvoice])

  const handleCreateFirstInvoice = async () => {
    if (!ownerId || !sub?.planId) return
    setSaving(true)
    setError('')
    try {
      const due = sub?.trialEnd ? new Date(sub.trialEnd) : new Date()
      await addInvoice({
        ownerId,
        amount: sub?.price || 0,
        dueDate: due,
        paymentMethod: firstInvoiceMethod
      })
    } catch (e) {
      setError('Erro ao criar primeira fatura')
    } finally {
      setSaving(false)
    }
  }

  const runBatchGeneration = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await generateInvoicesBatch({})
      setBatchLog({ open: true, text: `Geradas: ${res.generated}` })
    } catch (e) {
      console.error('generateInvoicesBatch error:', e)
      setError(`Erro ao gerar faturas automaticamente: ${e?.message || 'sem detalhes'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">Assinatura</div>
            <div className="text-sm text-slate-300 mt-1">Escolha o melhor plano para seu negócio</div>
          </div>
          {onBack && (
            <button onClick={onBack} className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-sm">
              Voltar
            </button>
          )}
        </div>
        {sub?.planName && (
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-sm">
            <span>Plano atual:</span>
            <span className="font-semibold">{sub.planName}</span>
            {sub?.billingCycle && <span className="uppercase text-xs px-2 py-0.5 rounded bg-white/10">{sub.billingCycle === 'monthly' ? 'Mensal' : sub.billingCycle === 'semiannual' ? 'Semestral' : 'Anual'}</span>}
            {sub?.price && <span className="font-semibold">R$ {Number(sub.price).toFixed(2)}</span>}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-gray-800">Planos 2026</div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOptionsOpen(v => !v)}
            className="px-3 py-2 rounded border text-sm text-gray-700 border-gray-300 hover:bg-gray-50"
          >
            Opções
          </button>
          {optionsOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10">
              <button
                className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                onClick={() => { setChoosePlanOpen(true); setOptionsOpen(false) }}
              >
                Trocar plano
              </button>
            </div>
          )}
        </div>
      </div>

      {(!sub?.planId || choosePlanOpen) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map(p => (
            <div
              key={p.id}
              className={`rounded-2xl border border-gray-100 p-6 bg-gradient-to-br from-slate-50 to-white shadow-sm hover:shadow-md ${p.id==='premium-2026' ? 'ring-1 ring-blue-300' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="text-lg font-bold text-gray-900">{p.name}</div>
                {p.id==='premium-2026' && (
                  <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">Recomendado</span>
                )}
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3">
                {p.cycles.map(cycle => (
                  <button
                    key={cycle.id}
                    type="button"
                    disabled={saving}
                    onClick={() => handleChoosePlan({
                      id: p.id,
                      name: p.name,
                      price: cycle.price,
                      billingCycle: cycle.id,
                      graceDays: p.graceDays
                    })}
                    className="flex items-center justify-between px-4 py-3 rounded-lg border text-sm transition-colors hover:bg-gray-50"
                  >
                    <span>{cycle.label}</span>
                    <span className="font-semibold">R$ {cycle.price.toFixed(2)}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 rounded-lg border border-gray-200 bg-white/90 p-4 space-y-2">
                {p.details.map((t, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl bg-white p-6 shadow border border-gray-100">
          <div className="text-base font-semibold text-gray-800">Status atual</div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusLabel.className}`}>
              {statusLabel.text}
            </span>
            <span className="text-sm text-gray-600">
              Plano: {sub?.planName || '—'}
              {sub?.billingCycle ? ` • ${sub.billingCycle === 'monthly' ? 'Mensal' : sub.billingCycle === 'semiannual' ? 'Semestral' : 'Anual'}` : ''}
              {sub?.price ? ` • R$ ${Number(sub.price).toFixed(2)}` : ''}
            </span>
            <span className="text-sm text-gray-600">Próx. vencimento: {formatDate(sub?.nextDueDate)}</span>
            {sub?.trialEnd && (
              <span className="text-sm text-blue-700 bg-blue-50 px-2 py-1 rounded">
                Teste expira em: {formatDate(sub.trialEnd)}
              </span>
            )}
          </div>
          {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        </div>

        {needsFirstInvoice && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
            <div className="text-sm text-blue-900">Crie a primeira fatura para após o período de teste.</div>
            <div className="mt-3 flex items-center gap-3">
              <select
                value={firstInvoiceMethod}
                onChange={e => setFirstInvoiceMethod(e.target.value)}
                className="px-3 py-2 border rounded text-sm"
              >
                <option value="PIX">PIX</option>
                <option value="CARTAO">Cartão</option>
                <option value="BOLETO">Boleto</option>
              </select>
              <button
                type="button"
                disabled={saving}
                onClick={handleCreateFirstInvoice}
                className="px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? 'Criando...' : 'Criar primeira fatura'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-gray-800">Faturas</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={runBatchGeneration}
              className="px-3 py-2 rounded bg-gray-900 text-white text-sm hover:bg-black disabled:opacity-60"
            >
              Gerar automaticamente
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            value={filters.status}
            onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="px-3 py-2 border rounded text-sm"
          >
            <option value="all">Todos</option>
            <option value="pending">Pendentes</option>
            <option value="overdue">Em atraso</option>
            <option value="paid">Pagas</option>
          </select>
          <input
            type="date"
            value={filters.start}
            onChange={e => setFilters(prev => ({ ...prev, start: e.target.value }))}
            className="px-3 py-2 border rounded text-sm"
            placeholder="Início"
          />
          <input
            type="date"
            value={filters.end}
            onChange={e => setFilters(prev => ({ ...prev, end: e.target.value }))}
            className="px-3 py-2 border rounded text-sm"
            placeholder="Fim"
          />
          <input
            type="text"
            value={filters.search}
            onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="px-3 py-2 border rounded text-sm"
            placeholder="Buscar cliente/descrição"
          />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th className="px-3 py-2">Nº</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2">Vencimento</th>
                <th className="px-3 py-2">Dias em atraso</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {invoices
                .filter(i => {
                  if (filters.status !== 'all' && i.status !== filters.status) return false
                  if (filters.start) {
                    const s = new Date(filters.start + 'T00:00:00')
                    const d = parseDate(i.dueDate)
                    if (!d || d < s) return false
                  }
                  if (filters.end) {
                    const e = new Date(filters.end + 'T23:59:59')
                    const d = parseDate(i.dueDate)
                    if (!d || d > e) return false
                  }
                  if (filters.search) {
                    const s = filters.search.toLowerCase()
                    const name = (i.clientName || '').toLowerCase()
                    const desc = (i.description || '').toLowerCase()
                    if (!(name.includes(s) || desc.includes(s))) return false
                  }
                  return true
                })
                .sort((a, b) => {
                  const da = parseDate(a.dueDate)?.getTime() || 0
                  const db = parseDate(b.dueDate)?.getTime() || 0
                  return da - db
                })
                .map(i => (
                  <tr key={i.id} className="border-t">
                    <td className="px-3 py-2">{i.number || '-'}</td>
                    <td className="px-3 py-2">{i.clientName || 'Assinatura'}</td>
                    <td className="px-3 py-2 text-right">R$ {Number(i.amount||0).toFixed(2)}</td>
                    <td className="px-3 py-2">{formatDate(i.dueDate)}</td>
                    <td className="px-3 py-2">{i.status==='overdue' ? daysOverdue(i.dueDate) : 0}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded text-xs ${i.status==='paid' ? 'bg-green-100 text-green-700' : i.status==='overdue' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>
                        {i.status==='paid' ? 'Paga' : i.status==='overdue' ? 'Em atraso' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" disabled className="px-3 py-1.5 rounded border text-xs text-gray-500">
                        Pagar
                      </button>
                    </td>
                  </tr>
                ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-gray-600">Nenhuma fatura encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {batchLog.open && (
          <div className="mt-3 text-xs text-gray-600">Resultado: {batchLog.text}</div>
        )}
      </div>
    </div>
  )
}
