import React, { useState, useEffect } from 'react'
import { addCategory, updateCategory } from '../services/categories'
import { getStoreById } from '../services/stores'

export default function NewCategoryModal({ open, onClose, isEdit=false, category=null, storeId }){
  const [name, setName] = useState('')
  const [commissionRate, setCommissionRate] = useState('0')
  const [active, setActive] = useState(true)
  const [showMarkups, setShowMarkups] = useState(false)
  const [defaultMarkups, setDefaultMarkups] = useState({ p1: '', p2: '', p3: '', p4: '', p5: '' })
  const [pricingGroups, setPricingGroups] = useState([])
  const [groupMarkups, setGroupMarkups] = useState({})
  const [groupModes, setGroupModes] = useState({})
  const [groupAddCost, setGroupAddCost] = useState({})
  const [activeGroupKey, setActiveGroupKey] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && isEdit && category) {
      setName(category.name || '')
      setCommissionRate(String(category.commissionRate ?? 0))
      setActive(category.active !== false)
      
      const dm = category.defaultMarkups || {}
      setDefaultMarkups({
        p1: dm.p1 || '',
        p2: dm.p2 || '',
        p3: dm.p3 || '',
        p4: dm.p4 || '',
        p5: dm.p5 || ''
      })
      if (Object.values(dm).some(v => v)) setShowMarkups(true)
      
      setError('')
    } else if (open && !isEdit) {
      setName('')
      setCommissionRate('0')
      setActive(true)
      setShowMarkups(false)
      setDefaultMarkups({ p1: '', p2: '', p3: '', p4: '', p5: '' })
      setError('')
    }
  }, [open, isEdit, category])

  useEffect(() => {
    async function loadPricingLabels() {
      if (!storeId) return
      try {
        const store = await getStoreById(storeId)
        const cfg = store?.pricingConfig
        const groups = (cfg?.groups && Array.isArray(cfg.groups)) ? cfg.groups : []
        setPricingGroups(groups)
        const initMarkups = {}
        const initModes = {}
        const initAddCost = {}
        groups.forEach(g => {
          const count = (g.labels || []).length
          initMarkups[g.key || 'P'] = Array.from({ length: count }, () => '')
          initModes[g.key || 'P'] = Array.from({ length: count }, () => 'percent')
          initAddCost[g.key || 'P'] = Array.from({ length: count }, () => true)
        })
        setActiveGroupKey(prev => prev ?? (groups[0]?.key || 'P'))
        if (isEdit && category) {
          const byGroup = category.defaultMarkupsByGroup || {}
          const modesByGroup = category.defaultMarkupModesByGroup || {}
          const addCostByGroup = category.defaultMarkupAddCostByGroup || {}
          Object.keys(initMarkups).forEach(k => {
            const arr = byGroup[k]
            if (Array.isArray(arr)) initMarkups[k] = arr.map(v => v ?? '')
            const mArr = modesByGroup[k]
            if (Array.isArray(mArr)) initModes[k] = mArr.map(v => (v === 'value' ? 'value' : 'percent'))
            const aArr = addCostByGroup[k]
            if (Array.isArray(aArr)) initAddCost[k] = aArr.map(v => v === false ? false : true)
          })
        } else if (category?.defaultMarkups) {
          const firstKey = groups[0]?.key
          if (firstKey) {
            initMarkups[firstKey] = [
              category.defaultMarkups.p1 ?? '',
              category.defaultMarkups.p2 ?? '',
              category.defaultMarkups.p3 ?? '',
              category.defaultMarkups.p4 ?? '',
              category.defaultMarkups.p5 ?? ''
            ].slice(0, (groups[0].labels || []).length)
          }
        }
        setGroupMarkups(initMarkups)
        setGroupModes(initModes)
        setGroupAddCost(initAddCost)
      } catch (e) {
        setPricingGroups([])
        setGroupMarkups({})
        setGroupModes({})
        setGroupAddCost({})
      }
    }
    if (open) loadPricingLabels()
  }, [open, storeId, isEdit, category])

  if(!open) return null

  const close = () => {
    if (saving) return
    onClose && onClose()
    setName('')
    setCommissionRate('0')
    setActive(true)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if(!name.trim()){
      setError('Informe o nome da categoria.')
      return
    }
    setSaving(true)
    try{
      const data = {
        name: name.trim(),
        commissionRate: parseFloat(commissionRate) || 0,
        active,
        defaultMarkups: {
          p1: parseFloat(defaultMarkups.p1) || 0,
          p2: parseFloat(defaultMarkups.p2) || 0,
          p3: parseFloat(defaultMarkups.p3) || 0,
          p4: parseFloat(defaultMarkups.p4) || 0,
          p5: parseFloat(defaultMarkups.p5) || 0,
        },
        defaultMarkupsByGroup: groupMarkups,
        defaultMarkupModesByGroup: groupModes,
        defaultMarkupAddCostByGroup: groupAddCost
      }
      if(isEdit && category?.id){
        await updateCategory(category.id, data)
      } else {
        await addCategory(data, storeId)
      }
      close()
    }catch(err){
      console.error('addCategory error:', err)
      const code = err?.code || 'unknown'
      const msg = err?.message || 'Sem detalhes.'
      setError(`Erro ao salvar: ${code}. ${msg}`)
    }finally{
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[70]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-[780px] max-w-[95vw]">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h3 className="font-semibold text-lg dark:text-white">{isEdit ? 'Editar Categoria' : 'Nova Categoria'}</h3>
          <button onClick={close} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

          <div>
            <label className="text-sm text-gray-600 dark:text-gray-300">Nome</label>
            <input value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" placeholder="Ex.: Eletrônicos" />
          </div>

          <div>
            <label className="text-sm text-gray-600 dark:text-gray-300">Taxa de comissão</label>
            <input type="number" step="0.01" value={commissionRate} onChange={e=>setCommissionRate(e.target.value)} className="mt-1 w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white" placeholder="0" />
          </div>

          <div>
            <button 
              type="button" 
              onClick={() => setShowMarkups(!showMarkups)}
              className="text-sm text-green-600 dark:text-green-400 font-medium hover:underline flex items-center gap-1 focus:outline-none"
            >
              <span className="text-xs">{showMarkups ? '▼' : '▶'}</span> Definir % de Precificação Padrão
            </button>
            
            {showMarkups && (
              <div className="mt-2 bg-gray-50 dark:bg-gray-700/30 p-4 rounded border dark:border-gray-700 transition-all space-y-5">
                <div className="flex items-center gap-2">
                  {pricingGroups.map(g => (
                    <button
                      key={g.key || 'P'}
                      type="button"
                      onClick={() => setActiveGroupKey(g.key || 'P')}
                      className={`px-3 py-1 rounded-full text-xs border ${activeGroupKey === (g.key || 'P') ? 'bg-green-600 text-white border-green-600' : 'bg-white dark:bg-gray-700 dark:text-gray-300'}`}
                    >
                      {g.key || 'P'}
                    </button>
                  ))}
                </div>
                {(() => {
                  const g = pricingGroups.find(x => (x.key || 'P') === activeGroupKey) || pricingGroups[0] || null
                  if (!g) return <div className="text-xs text-gray-500 dark:text-gray-400">Nenhum conjunto de precificação configurado.</div>
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold dark:text-gray-200">{g.key || 'P'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{(g.labels || []).length} precificações</div>
                      </div>
                      <div className="grid grid-cols-[1.8fr_9rem_13rem] items-center text-xs text-gray-500 dark:text-gray-400 font-medium px-1">
                        <div>Precificação</div>
                        <div className="text-center">Modo</div>
                        <div className="text-right">Valor</div>
                      </div>
                      <div className="space-y-2">
                        {(g.labels || []).map((label, idx) => (
                          <div key={idx} className="grid grid-cols-[1.8fr_9rem_13rem] items-center gap-3">
                            <div className="text-sm dark:text-gray-200 truncate whitespace-nowrap">
                              <span className="font-medium">{label || `Precificação ${idx+1}`}</span>
                            </div>
                            <div className="flex items-center gap-2 justify-center">
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-2">
                                <button 
                                  type="button"
                                  onClick={() => setGroupModes(prev => {
                                    const arr = (prev[g.key || 'P'] || []).slice()
                                    arr[idx] = 'percent'
                                    return { ...prev, [g.key || 'P']: arr }
                                  })}
                                  className={`px-2 py-1 rounded text-xs border ${((groupModes[g.key || 'P'] || [])[idx] || 'percent') === 'percent' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white dark:bg-gray-700 dark:text-gray-300'}`}
                                >
                                  %
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => setGroupModes(prev => {
                                    const arr = (prev[g.key || 'P'] || []).slice()
                                    arr[idx] = 'value'
                                    return { ...prev, [g.key || 'P']: arr }
                                  })}
                                  className={`px-2 py-1 rounded text-xs border ${((groupModes[g.key || 'P'] || [])[idx] || 'percent') === 'value' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white dark:bg-gray-700 dark:text-gray-300'}`}
                                >
                                  R$
                                </button>
                                </div>
                                {(((groupModes[g.key || 'P'] || [])[idx] || 'percent') === 'value') && (
                                  <button
                                    type="button"
                                    onClick={() => setGroupAddCost(prev => {
                                      const key = g.key || 'P'
                                      const existing = prev[key] || []
                                      const arr = Array.from({ length: (g.labels || []).length }, (_, i) => existing[i] === false ? false : true)
                                      arr[idx] = !(arr[idx] === true)
                                      return { ...prev, [key]: arr }
                                    })}
                                    className="mt-0.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border border-gray-300 text-gray-600 bg-white hover:border-green-400 hover:text-green-700"
                                  >
                                    <span className={`mr-1 inline-block h-3 w-5 rounded-full ${(((groupAddCost[g.key || 'P'] || [])[idx] ?? true) ? 'bg-green-500' : 'bg-gray-300')}`}>
                                      <span className={`block h-3 w-3 rounded-full bg-white shadow transform transition-transform ${(((groupAddCost[g.key || 'P'] || [])[idx] ?? true) ? 'translate-x-2' : '')}`}></span>
                                    </span>
                                    <span>Somar custo</span>
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="relative">
                                <input 
                                  type="number" 
                                  step="0.01" 
                                  value={((groupMarkups[g.key || 'P'] || [])[idx] ?? '')}
                                  onChange={e => setGroupMarkups(prev => {
                                    const arr = (prev[g.key || 'P'] || []).slice()
                                    arr[idx] = e.target.value
                                    return { ...prev, [g.key || 'P']: arr }
                                  })}
                                  className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 dark:text-white focus:ring-1 focus:ring-green-500 outline-none text-right" 
                                  placeholder="0" 
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400">
                                  {(((groupModes[g.key || 'P'] || [])[idx] || 'percent') === 'percent') ? '%' : 'R$'}
                                </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
             <label className="flex items-center gap-2 text-sm dark:text-gray-300">
               <span>Cadastro Ativo</span>
               <button type="button" onClick={()=>setActive(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                 <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${active ? 'translate-x-4' : 'translate-x-1'}`}></span>
               </button>
             </label>
           </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={close} className="px-3 py-2 border dark:border-gray-600 rounded text-sm dark:text-gray-300 dark:hover:bg-gray-700">Cancelar</button>
            <button disabled={saving} type="submit" className="px-3 py-2 rounded text-sm bg-green-600 text-white disabled:opacity-60">Confirmar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
