
export async function searchCep(cep) {
  if (!cep) return null
  const cleanCep = cep.replace(/\D/g, '')
  if (cleanCep.length !== 8) return null

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
    const data = await res.json()
    if (data.erro) return null
    
    return {
      address: data.logradouro,
      neighborhood: data.bairro,
      city: data.localidade,
      state: data.uf,
      complement: data.complemento || ''
    }
  } catch (err) {
    console.error('Erro ao buscar CEP', err)
    return null
  }
}
