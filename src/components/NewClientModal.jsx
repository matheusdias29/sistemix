import React, { useEffect, useState } from 'react'
import { addClient, updateClient } from '../services/clients'

export default function NewClientModal({ open, onClose, isEdit=false, client=null }){
  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [phone, setPhone] = useState('')
  const [cpf, setCpf] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [allowCredit, setAllowCredit] = useState(false)
  const [isCompany, setIsCompany] = useState(false)

  // Sanfonas
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

  // Informações adicionais
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [code, setCode] = useState('')

  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && isEdit && client){
      setName(client.name || '')
      setWhatsapp(client.whatsapp || '')
      setPhone(client.phone || '')
      setCpf(client.cpf || '')
      setCnpj(client.cnpj || '')
      setAllowCredit(!!client.allowCredit)
      setIsCompany(!!client.isCompany)
      setCep(client.cep || '')
      setAddress(client.address || '')
      setNumber(client.number || '')
      setComplement(client.complement || '')
      setNeighborhood(client.neighborhood || '')
      setCity(client.city || '')
      setState(client.state || '')
      setEmail(client.email || '')
      setNotes(client.notes || '')
      setCode(client.code || '')
      setActive(client.active !== false)
      setError('')
    }
  }, [open, isEdit, client])

  if(!open) return null

  const reset = () => {
    setName('')
    setWhatsapp('')
    setPhone('')
    setCpf('')
    setCnpj('')
    setAllowCredit(false)
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
    setEmail('')
    setNotes('')
    setCode('')
    setActive(true)
    setError('')
  }

  const close = () => {
    if(saving) return
    onClose && onClose()
    reset()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if(!name.trim()){
      setError('Informe o nome do cliente.')
      return
    }
    setSaving(true)
    try{
      const payload = {
        name: name.trim(),
        whatsapp: whatsapp.trim(),
        phone: phone.trim(),
        cpf: cpf.trim(),
        cnpj: cnpj.trim(),
        allowCredit,
        isCompany,
        // Endereço
        cep: cep.trim(),
        address: address.trim(),
        number: number.trim(),
        complement: complement.trim(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        state: state.trim(),
        // Info adicional
        email: email.trim(),
        notes: notes.trim(),
        code: code.trim(),
        // Status
        active,
      }
      if(isEdit && client?.id){
        await updateClient(client.id, payload)
      } else {
        await addClient(payload)
      }
      close()
    } catch(err){
      console.error(err)
      setError('Não foi possível salvar. Verifique sua conexão e regras do Firestore.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[70]">
      <div className="bg-white rounded-lg shadow-lg w-[840px] max-w-[98vw]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">{isEdit ? 'Editar Cliente' : 'Novo Cliente'}</h3>
          <button onClick={close} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-4">
            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="grid grid-cols-3 gap-4">
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

            <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-3 items-end">
              <div>
                <label className="text-xs text-gray-600">{isCompany ? 'CNPJ' : 'CPF'}</label>
                <div className="mt-1 flex items-center gap-2">
                  <input value={isCompany ? cnpj : cpf} onChange={e=> (isCompany ? setCnpj(e.target.value) : setCpf(e.target.value))} className="flex-1 border rounded px-3 py-2 text-sm" />
                  <button type="button" className="px-3 py-2 border rounded text-sm">🔎</button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <span>Permitir crediário</span>
                <button type="button" onClick={()=>setAllowCredit(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${allowCredit ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${allowCredit ? 'translate-x-4' : 'translate-x-1'}`}></span>
                </button>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span>É empresa</span>
                <button type="button" onClick={()=>setIsCompany(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${isCompany ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${isCompany ? 'translate-x-4' : 'translate-x-1'}`}></span>
                </button>
              </label>
            </div>

            {/* Endereço */}
            <div className="mt-4 border rounded">
              <button type="button" onClick={()=>setAddrOpen(v=>!v)} className="w-full px-3 py-2 text-left flex items-center justify-between">
                <span className="font-semibold text-sm">Endereço (opcional)</span>
                <span className="text-gray-500">{addrOpen ? '▴' : '▾'}</span>
              </button>
              {addrOpen && (
                <div className="px-3 pt-2 pb-3 space-y-3">
                  <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                    <div>
                      <label className="text-xs text-gray-600">CEP</label>
                      <div className="mt-1 flex items-center gap-2">
                        <input value={cep} onChange={e=>setCep(e.target.value)} className="flex-1 border rounded px-3 py-2 text-sm" />
                        <button type="button" className="px-3 py-2 border rounded text-sm">🔎</button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
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
                  <div className="grid grid-cols-3 gap-3">
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

            {/* Informações adicionais */}
            <div className="mt-4 border rounded">
              <button type="button" onClick={()=>setInfoOpen(v=>!v)} className="w-full px-3 py-2 text-left flex items-center justify-between">
                <span className="font-semibold text-sm">Informações adicionais (opcional)</span>
                <span className="text-gray-500">{infoOpen ? '▴' : '▾'}</span>
              </button>
              {infoOpen && (
                <div className="px-3 pt-2 pb-3 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-600">Código</label>
                      <input value={code} onChange={e=>setCode(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Email</label>
                      <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Observações</label>
                      <textarea value={notes} onChange={e=>setNotes(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" rows={3} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Cadastro ativo + ações */}
            <div className="mt-4 flex items-center justify-between">
              <label className="flex items-center gap-3 text-sm">
                <span>Cadastro Ativo</span>
                <button type="button" onClick={()=>setActive(v=>!v)} className={`relative inline-flex h-5 w-9 items-center rounded-full ${active ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${active ? 'translate-x-4' : 'translate-x-1'}`}></span>
                </button>
              </label>
              <div className="flex items-center gap-3">
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