import React, { useEffect, useState } from 'react'
import { addSupplier, updateSupplier } from '../services/suppliers'
import { searchCep } from '../services/cep'

export default function NewSupplierModal({ open, onClose, isEdit=false, supplier=null, storeId }){
  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [phone, setPhone] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [isCompany, setIsCompany] = useState(false)

  // Sanfonas (accordions)
  const [addrOpen, setAddrOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

  // Endereço
  const [cep, setCep] = useState('')
  const [address, setAddress] = useState('')
  const [number, setNumber] = useState('')
  const [complement, setComplement] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')

  // Info adicional
  const [code, setCode] = useState('')
  const [stateRegistration, setStateRegistration] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')

  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && isEdit && supplier) {
      setName(supplier.name || '')
      setWhatsapp(supplier.whatsapp || '')
      setPhone(supplier.phone || '')
      setCnpj(supplier.cnpj || '')
      setIsCompany(!!supplier.isCompany)
      setCep(supplier.cep || '')
      setAddress(supplier.address || '')
      setNumber(supplier.number || '')
      setComplement(supplier.complement || '')
      setNeighborhood(supplier.neighborhood || '')
      setCity(supplier.city || '')
      setState(supplier.state || '')
      setCode(supplier.code || '')
      setStateRegistration(supplier.stateRegistration || '')
      setEmail(supplier.email || '')
      setNotes(supplier.notes || '')
      setActive(supplier.active !== false)
      setError('')
    }
  }, [open, isEdit, supplier])

  if(!open) return null

  const close = () => {
    if (saving) return
    onClose && onClose()
    // reset
    setName('')
    setWhatsapp('')
    setPhone('')
    setCnpj('')
    setIsCompany(false)
    setAddrOpen(false)
    setInfoOpen(false)
    setCep('')
    setAddress('')
    setNumber('')
    setComplement('')
    setNeighborhood('')
    setCity('')
    setState('')
    setCode('')
    setStateRegistration('')
    setEmail('')
    setNotes('')
    setActive(true)
    setError('')
  }

  const handleSearchCep = async () => {
    if(!cep) return
    try {
      const data = await searchCep(cep)
      if(data){
        setAddress(data.address)
        setNeighborhood(data.neighborhood)
        setCity(data.city)
        setState(data.state)
      }
    } catch(err){
      console.error(err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if(!name.trim()){
      setError('Informe o nome do fornecedor.')
      return
    }
    setSaving(true)
    try{
      const payload = {
        name: name.trim(),
        whatsapp: whatsapp.trim(),
        phone: phone.trim(),
        cnpj: cnpj.trim(),
        isCompany,
        cep: cep.trim(),
        address: address.trim(),
        number: number.trim(),
        complement: complement.trim(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        state: state.trim(),
        code: code.trim(),
        stateRegistration: stateRegistration.trim(),
        email: email.trim(),
        notes: notes.trim(),
        active,
      }
      if (isEdit && supplier?.id){
        await updateSupplier(supplier.id, payload)
      } else {
        await addSupplier(payload, storeId)
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
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[90]">
      <div className="bg-white rounded-lg shadow-lg w-[840px] max-w-[98vw]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">{isEdit ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h3>
          <button onClick={close} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-4">
            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-600">Nome</label>
                <input value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Whatsapp</label>
                <input value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Telefone</label>
                <input value={phone} onChange={e=>setPhone(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-start md:items-end">
              <div>
                <label className="text-xs text-gray-600">CNPJ</label>
                <div className="mt-1 flex items-center gap-2">
                  <input value={cnpj} onChange={e=>setCnpj(e.target.value)} className="flex-1 border rounded px-3 py-2 text-sm" />
                  <button type="button" className="px-3 py-2 border rounded text-sm">🔎</button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <span>É empresa</span>
                <button type="button" onClick={()=>setIsCompany(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${isCompany ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${isCompany ? 'translate-x-4' : 'translate-x-1'}`}></span>
                </button>
              </label>
            </div>

            {/* Sanfona: Endereço (fechada por padrão) */}
            <div className="mt-4 border rounded">
              <button type="button" onClick={()=>setAddrOpen(v=>!v)} className="w-full px-3 py-2 text-left flex items-center justify-between">
                <span className="font-semibold text-sm">Endereço (opcional)</span>
                <span className="text-gray-500">{addrOpen ? '▴' : '▾'}</span>
              </button>
              {addrOpen && (
                <div className="px-3 pt-2 pb-3 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-start md:items-end">
                    <div>
                      <label className="text-xs text-gray-600">CEP</label>
                      <div className="mt-1 flex items-center gap-2">
                        <input value={cep} onChange={e=>setCep(e.target.value)} className="flex-1 border rounded px-3 py-2 text-sm" />
                        <button type="button" onClick={handleSearchCep} className="px-3 py-2 border rounded text-sm hover:bg-gray-50">🔎</button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-600">Endereço</label>
                      <input value={address} onChange={e=>setAddress(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Número</label>
                      <input value={number} onChange={e=>setNumber(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Complemento</label>
                      <input value={complement} onChange={e=>setComplement(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-600">Bairro</label>
                      <input value={neighborhood} onChange={e=>setNeighborhood(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Cidade</label>
                      <input value={city} onChange={e=>setCity(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Estado</label>
                      <input value={state} onChange={e=>setState(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sanfona: Informações adicionais (fechada por padrão) */}
            <div className="mt-4 border rounded">
              <button type="button" onClick={()=>setInfoOpen(v=>!v)} className="w-full px-3 py-2 text-left flex items-center justify-between">
                <span className="font-semibold text-sm">Informações adicionais (opcional)</span>
                <span className="text-gray-500">{infoOpen ? '▴' : '▾'}</span>
              </button>
              {infoOpen && (
                <div className="px-3 pt-2 pb-3 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-600">Código</label>
                      <input value={code} onChange={e=>setCode(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Inscrição Estadual</label>
                      <input value={stateRegistration} onChange={e=>setStateRegistration(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Email</label>
                      <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Observações</label>
                    <textarea value={notes} onChange={e=>setNotes(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" rows={3} />
                  </div>
                </div>
              )}
            </div>

            {/* Switch de Cadastro Ativo */}
            <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <label className="flex items-center gap-3 text-sm">
                <span>Cadastro Ativo</span>
                <button type="button" onClick={()=>setActive(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${active ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${active ? 'translate-x-4' : 'translate-x-1'}`}></span>
                </button>
              </label>
              <div className="flex items-center gap-3 md:justify-end">
                <button type="button" onClick={close} className="px-3 py-2 border rounded text-sm">Cancelar</button>
                <button disabled={saving} type="submit" className="px-3 py-2 rounded text-sm bg-green-600 text-white disabled:opacity-60">Salvar</button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
