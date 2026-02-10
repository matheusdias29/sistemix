import React, { useState, useEffect } from 'react'
import { addCategory, updateCategory } from '../services/categories'

export default function NewCategoryModal({ open, onClose, isEdit=false, category=null, storeId }){
  const [name, setName] = useState('')
  const [commissionRate, setCommissionRate] = useState('0')
  const [active, setActive] = useState(true)
  const [showMarkups, setShowMarkups] = useState(false)
  const [defaultMarkups, setDefaultMarkups] = useState({ p1: '', p2: '', p3: '', p4: '', p5: '' })
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
        }
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-[520px]">
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
              <div className="mt-2 grid grid-cols-3 gap-3 bg-gray-50 dark:bg-gray-700/30 p-3 rounded border dark:border-gray-700 transition-all">
                <div className="col-span-3 text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Defina a margem de lucro (%) padrão para cada precificação ao selecionar esta categoria.
                </div>
                {[
                  { num: 1, label: 'P/cliente final' },
                  { num: 2, label: 'cartão 7x Até 12x' },
                  { num: 3, label: 'cartão 13x até 18x' },
                  { num: 4, label: 'Lojista Levar' },
                  { num: 5, label: 'P/instalar na loja' }
                ].map(({ num, label }) => (
                  <div key={num}>
                    <label className="text-xs text-gray-600 dark:text-gray-300 font-medium block">{label} (%)</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      value={defaultMarkups[`p${num}`]} 
                      onChange={e => setDefaultMarkups(prev => ({ ...prev, [`p${num}`]: e.target.value }))}
                      className="mt-1 w-full border dark:border-gray-600 rounded px-2 py-1.5 text-sm dark:bg-gray-700 dark:text-white focus:ring-1 focus:ring-green-500 outline-none" 
                      placeholder="0" 
                    />
                  </div>
                ))}
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