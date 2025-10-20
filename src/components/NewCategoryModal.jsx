import React, { useState, useEffect } from 'react'
import { addCategory, updateCategory } from '../services/categories'

export default function NewCategoryModal({ open, onClose, isEdit=false, category=null }){
  const [name, setName] = useState('')
  const [commissionRate, setCommissionRate] = useState('0')
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && isEdit && category) {
      setName(category.name || '')
      setCommissionRate(String(category.commissionRate ?? 0))
      setActive(category.active !== false)
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
      if(isEdit && category?.id){
        await updateCategory(category.id, {
          name: name.trim(),
          commissionRate: parseFloat(commissionRate) || 0,
          active: !!active,
        })
      } else {
        await addCategory({
          name: name.trim(),
          commissionRate: parseFloat(commissionRate) || 0,
          active: !!active,
        })
      }
      close()
    }catch(err){
      console.error(err)
      setError('Não foi possível salvar. Verifique sua conexão e regras do Firestore.')
    }finally{
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[70]">
      <div className="bg-white rounded-lg shadow-lg w-[520px]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">{isEdit ? 'Editar Categoria' : 'Nova Categoria'}</h3>
          <button onClick={close} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="text-sm text-red-600">{error}</div>}

          <div>
            <label className="text-sm text-gray-600">Nome</label>
            <input value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" placeholder="Ex.: Eletrônicos" />
          </div>

          <div>
            <label className="text-sm text-gray-600">Taxa de comissão</label>
            <input type="number" step="0.01" value={commissionRate} onChange={e=>setCommissionRate(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" placeholder="0" />
          </div>

          <div className="flex items-center justify-between">
             <label className="flex items-center gap-2 text-sm">
               <span>Cadastro Ativo</span>
               <button type="button" onClick={()=>setActive(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${active ? 'bg-green-500' : 'bg-gray-300'}`}>
                 <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${active ? 'translate-x-4' : 'translate-x-1'}`}></span>
               </button>
             </label>
           </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={close} className="px-3 py-2 border rounded text-sm">Cancelar</button>
            <button disabled={saving} type="submit" className="px-3 py-2 rounded text-sm bg-green-600 text-white disabled:opacity-60">Confirmar</button>
          </div>
        </form>
      </div>
    </div>
  )
}