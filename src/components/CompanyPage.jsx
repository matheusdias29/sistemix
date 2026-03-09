import React, { useEffect, useState } from 'react'
import { getStoreById, updateStore } from '../services/stores'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../lib/firebase'

export default function CompanyPage({ storeId, onBack }){
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Banner
  const [bannerUrl, setBannerUrl] = useState('')
  const [bannerFile, setBannerFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  // Campos
  const [razaoSocial, setRazaoSocial] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [cnpj, setCnpj] = useState('')

  const [emailEmpresarial, setEmailEmpresarial] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [telefone, setTelefone] = useState('')

  const [cep, setCep] = useState('')
  const [endereco, setEndereco] = useState('')
  const [numero, setNumero] = useState('')
  const [complemento, setComplemento] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')

  const [inscricaoEstadual, setInscricaoEstadual] = useState('')
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState('')
  const [cnae, setCnae] = useState('')
  const [regimeTributario, setRegimeTributario] = useState('')

  useEffect(() => {
    async function load(){
      try{
        setLoading(true)
        const store = await getStoreById(storeId)
        if(store){
          setRazaoSocial(store.razaoSocial || '')
          setNomeFantasia(store.fantasyName || store.nomeFantasia || store.name || '')
          setCnpj(store.cnpj || '')
          setEmailEmpresarial(store.emailEmpresarial || store.email || '')
          setWhatsapp(store.whatsapp || '')
          setTelefone(store.telefone || '')
          setCep(store.cep || '')
          setEndereco(store.endereco || store.address || '')
          setNumero(store.numero || store.addressNumber || '')
          setComplemento(store.complemento || store.addressComplement || '')
          setBairro(store.bairro || '')
          setCidade(store.cidade || store.city || '')
          setEstado(store.estado || store.state || '')
          setInscricaoEstadual(store.ie || store.inscricaoEstadual || '')
          setInscricaoMunicipal(store.im || store.inscricaoMunicipal || '')
          setCnae(store.cnae || '')
          setRegimeTributario(store.regimeTributario || '')
          setBannerUrl(store.bannerUrl || '')
        }
        setError('')
      } catch(e){
        setError('Falha ao carregar dados da empresa.')
      } finally {
        setLoading(false)
      }
    }
    if(storeId) load()
  }, [storeId])

  async function handleSave(e){
    e?.preventDefault?.()
    try{
      setSaving(true)
      setSuccess('')
      setError('')

      let finalBannerUrl = bannerUrl
      if (bannerFile) {
        setUploading(true)
        try {
          const storageRef = ref(storage, `stores/${storeId}/banner_${Date.now()}_${bannerFile.name}`)
          const snapshot = await uploadBytes(storageRef, bannerFile)
          finalBannerUrl = await getDownloadURL(snapshot.ref)
        } catch (err) {
          console.error("Erro ao fazer upload do banner", err)
          setError('Erro ao fazer upload do banner.')
          setUploading(false)
          setSaving(false)
          return
        } finally {
          setUploading(false)
        }
      }

      const data = {
        name: nomeFantasia || razaoSocial || '',
        bannerUrl: finalBannerUrl,
        razaoSocial,
        fantasyName: nomeFantasia,
        cnpj,
        emailEmpresarial,
        whatsapp,
        telefone,
        cep,
        endereco,
        numero,
        complemento,
        bairro,
        cidade,
        estado,
        ie: inscricaoEstadual,
        im: inscricaoMunicipal,
        cnae,
        regimeTributario,
      }
      await updateStore(storeId, data)
      setSuccess('Dados salvos com sucesso.')
    } catch(e){
      setError('Falha ao salvar dados. Verifique as informações e tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Dados da empresa</h2>
        <div className="flex items-center gap-2">
          {onBack && (
            <button type="button" onClick={onBack} className="px-3 py-2 border rounded text-sm">Voltar</button>
          )}
          <button disabled={saving} onClick={handleSave} className="px-3 py-2 rounded text-sm bg-green-600 text-white disabled:opacity-60">Salvar</button>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-gray-600">Carregando...</div>
      ) : (
        <form className="mt-4 space-y-6" onSubmit={handleSave}>
          {/* Banner da Loja */}
          <div>
            <div className="font-semibold text-sm mb-2">Banner da Loja</div>
            <div className="flex flex-col gap-2">
              {(bannerUrl || bannerFile) ? (
                <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden border group">
                  <img 
                    src={bannerFile ? URL.createObjectURL(bannerFile) : bannerUrl} 
                    alt="Banner da loja" 
                    className="w-full h-full object-cover"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      setBannerFile(null)
                      setBannerUrl('')
                    }}
                    className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    title="Remover banner"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              ) : (
                <div className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 bg-gray-50">
                   <span className="text-sm">Nenhum banner selecionado</span>
                </div>
              )}
              
              <div className="flex items-center gap-2 mt-2">
                <label className={`cursor-pointer px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                  <span>{bannerUrl || bannerFile ? 'Alterar imagem' : 'Escolher imagem'}</span>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={e => {
                      if(e.target.files?.[0]) {
                        setBannerFile(e.target.files[0])
                      }
                    }}
                    disabled={uploading}
                  />
                </label>
                <span className="text-xs text-gray-500">Recomendado: 1200x400px (JPG, PNG)</span>
              </div>
              {uploading && <div className="text-xs text-blue-600">Enviando imagem...</div>}
            </div>
          </div>

          {/* Dados da empresa */}
          <div>
            <div className="font-semibold text-sm mb-2">Dados da empresa</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-600">Razão Social</label>
                <input value={razaoSocial} onChange={e=>setRazaoSocial(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Nome Fantasia</label>
                <input value={nomeFantasia} onChange={e=>setNomeFantasia(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-gray-600">CNPJ</label>
                <input value={cnpj} onChange={e=>setCnpj(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" placeholder="00.000.000/0000-00" />
              </div>
            </div>
          </div>

          {/* Dados de contato */}
          <div>
            <div className="font-semibold text-sm mb-2">Dados de contato</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-600">WhatsApp principal</label>
                <input value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" placeholder="(00) 00000-0000" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Telefone</label>
                <input value={telefone} onChange={e=>setTelefone(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-600">E-mail empresarial</label>
                <input type="email" value={emailEmpresarial} onChange={e=>setEmailEmpresarial(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" placeholder="email@empresa.com" />
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div>
            <div className="font-semibold text-sm mb-2">Endereço</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-600">CEP</label>
                <input value={cep} onChange={e=>setCep(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-gray-600">Endereço (Rua)</label>
                <input value={endereco} onChange={e=>setEndereco(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Número</label>
                <input value={numero} onChange={e=>setNumero(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Complemento</label>
                <input value={complemento} onChange={e=>setComplemento(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Bairro</label>
                <input value={bairro} onChange={e=>setBairro(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Cidade</label>
                <input value={cidade} onChange={e=>setCidade(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Estado</label>
                <input value={estado} onChange={e=>setEstado(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" placeholder="UF" />
              </div>
            </div>
          </div>

          {/* Dados fiscais */}
          <div>
            <div className="font-semibold text-sm mb-2">Dados fiscais</div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-gray-600">Inscrição Estadual</label>
                <input value={inscricaoEstadual} onChange={e=>setInscricaoEstadual(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Inscrição Municipal</label>
                <input value={inscricaoMunicipal} onChange={e=>setInscricaoMunicipal(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-600">CNAE</label>
                <input value={cnae} onChange={e=>setCnae(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-600">Regime Tributário</label>
                <input value={regimeTributario} onChange={e=>setRegimeTributario(e.target.value)} className="mt-1 w-full border rounded px-3 py-2 text-sm" placeholder="Ex.: Simples Nacional" />
              </div>
            </div>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
          {success && <div className="text-sm text-green-600">{success}</div>}

          <div className="flex items-center justify-end gap-2">
            <button type="button" className="px-3 py-2 border rounded text-sm" onClick={onBack}>Cancelar</button>
            <button disabled={saving} type="submit" className="px-3 py-2 rounded text-sm bg-green-600 text-white disabled:opacity-60">Salvar</button>
          </div>
        </form>
      )}
    </div>
  )
}
