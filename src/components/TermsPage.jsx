import React, { useState, useEffect } from 'react'
import { jsPDF } from 'jspdf'
import { listenTerms, addTerm, updateTerm, deleteTerm, seedDefaultTerms } from '../services/terms'

const TERM_OPTIONS = [
  { id: 'termo-compra-aparelhos', label: 'TERMO COMPRA DE APARELHOS' },
  { id: 'termo-risco-procedimento', label: 'TERMO RISCO NO PROCEDIMENTO' },
  { id: 'termo-devolucao', label: 'TERMO DE DEVOLUÇÃO' },
  { id: 'termo-aparelho-molhado', label: 'TERMO DE APARELHO MOLHADO' },
  { id: 'pagamento-freelance', label: 'PAGAMENTO FREELANCE' },
  { id: 'termo-responsabilidade-uso-equipamento', label: 'TERMO DE RESPONSABILIDADE E USO DE EQUIPAMENTO' },
  { id: 'recibo-pagamento-comissao-funcionarios', label: 'RECIBO DE PAGAMENTO COMISSAO FUNCIONARIOS' },
  { id: 'advertencia-funcionario', label: 'ADVERTENCIA FUNCIONARIO' },
  { id: 'metodo-venda-pecas', label: 'METODO DE VENDA DE PECAS' },
  { id: 'metodo-vendas-varejo-acessorios', label: 'METODO DE VENDAS VAREJO ACESSORIOS' },
  { id: 'metodo-vendas-manutencao-lojista', label: 'METODO DE VENDAS MANUTENÇÃO LOJISTA' },
  { id: 'metodo-vendas-pecas-atacado', label: 'METODO DE VENDAS DE PECAS ATAACADO' },
  { id: 'metodo-comissao-vendas', label: 'METODO DE COMISSAO DE VENDAS / VENDEDOS' },
  { id: 'metodo-comissao-servicos', label: 'METODO DE COMISSA DE SERVIÇOS / TECNICOS' },
]

const TERMO_COMPRA_TEXTO_PADRAO = `DECLARAÇÃO DE COMPRA DE APARELHO CELULAR
Eu, __________________________________________________________, portador(a) do CPF nº ____________________ e do RG nº _______________, órgão emissor _______, residente à _______________________________________, bairro _________________, CEP _________, na cidade de ____________, telefone de contato: celular (___) _____________ / fixo (___) _____________,
DECLARO, para os devidos fins, que realizo a venda de meu aparelho celular para revenda ou sucata, responsabilizando-me civil e criminalmente por qualquer irregularidade perante a empresa Lokatell Celulares Manutenções LTDA, inscrita no CNPJ nº 55.313.237/0001-14, IE: 214376287115, com sede à Rua Siqueira Campos, nº 535, Centro, Birigui/SP, CEP 16200-056.

CARACTERÍSTICAS DO PRODUTO:
Marca: ______________________________
Modelo e cor: ________________________
IMEI 1: ____________________________
IMEI 2: ____________________________
S/N: ______________________________

VALOR: R$ ___________________________
FORMA DE PAGAMENTO: ( ) PIX ( ) Dinheiro ( ) Troca de Aparelho

Por ser expressão da verdade, afirmo o presente e me responsabilizo civil e criminalmente pelo conteúdo desta declaração.

Testemunhas:
______________________________ / Tel: (___) ____________
______________________________ / Tel: (___) ____________

Assinatura do Declarante:

Local e Data: Birigui, ___ de ________________ de ________`

const TERMO_APARELHO_MOLHADO_TEXTO_PADRAO = `🔴 TERMO DE RESPONSABILIDADE – VERSÃO JURÍDICA RIGOROSA
(APARELHO COM CONTATO COM ÁGUA – ORDEM DE SERVIÇO)

O.S. nº: ___________________________

Eu, ____________________________________________, CPF nº ____________________________, declaro, para todos os fins legais, que o aparelho descrito nesta ORDEM DE SERVIÇO (O.S.), REDMI 13C – cor preta, entrou em contato com água, apresentando falhas de funcionamento, incluindo liga/desliga intermitente ou ausência total de funcionamento, decorrentes de oxidação e possível curto-circuito interno.

Declaro estar plenamente ciente de que:
a) Aparelhos que entram em contato com líquidos possuem alto risco de falha irreversível;
b) A abertura do aparelho é indispensável para tentativa de desoxidação, testes e diagnóstico;
c) Durante ou após o procedimento, o aparelho pode parar parcial ou totalmente, de forma definitiva;
d) Componentes e periféricos podem deixar de funcionar, inclusive placa-mãe, tela, câmeras, sensores, conectores e demais circuitos;
e) Não há garantia de recuperação, êxito ou manutenção das funções originais.

Declaro que autorizo expressamente a abertura e o manuseio técnico do aparelho, assumindo integralmente todos os riscos, inclusive perda total do funcionamento, ainda que decorrente do procedimento técnico necessário.

Estou ciente de que somente mediante a substituição de peças será possível eventual reparo, sendo todos os custos de minha exclusiva responsabilidade, mediante orçamento e autorização prévia.

Dessa forma, isento, de forma irrevogável e irretratável, a empresa LOKATELL CELULARES E MANUTENÇÕES LTDA de qualquer responsabilidade técnica, civil, material, moral ou jurídica, renunciando desde já a qualquer reclamação, indenização ou ação judicial, presente ou futura, relacionada ao estado do aparelho descrito nesta O.S.

Procedimento autorizado para realização na data de hoje.

Birigui – SP, ____ de __________________ de ________.


Assinatura do Cliente


Assinatura da Empresa / Carimbo`

const PAGAMENTO_FREELANCE_TEXTO_PADRAO = `RECIBO DE PAGAMENTO FREELANCE

Empresa: LOKATELL CELULARES MANUTENÇÕES LTDA
CNPJ: 14.313.237/0001-14
Endereço: (inserir endereço completo da empresa, se desejar)

Eu, CRISTIANE TORRES ROSSETTO, portadora do CPF nº 278.635.378-51, declaro, para os devidos fins, que recebi da empresa Lokatell Celulares Manutenções LTDA a quantia de R$ 137,00 (cento e trinta e sete reais), referente aos dias trabalhados, conforme detalhamento abaixo:

29/09/2025 – Segunda-feira: 08:45 às 17:00
30/09/2025 – Terça-feira: 08:45 às 17:00

Declaro, ainda, que o valor acima foi recebido integralmente, nada mais tendo a reclamar a este título.

Birigui, 30 de setembro de 2025

Assinatura do Funcionário:

CRISTIANE TORRES ROSSETTO
CPF: 278.635.378-51

Assinatura e Carimbo da Empresa:

Lokatell Celulares Manutenções LTDA`

const TERMO_RESPONSABILIDADE_USO_EQUIPAMENTO_TEXTO_PADRAO = `TERMO DE RESPONSABILIDADE E USO DE EQUIPAMENTO 
ASSISTÊNCIA TÉCNICA – EMPRÉSTIMO DE APARELHO 

Pelo presente instrumento particular, de um lado LOKATELL CELULARES E MANUTENÇÕES LTDA, inscrita no CNPJ nº 55.313.237/0001-14, doravante denominada EMPRESA, e de outro lado o cliente identificado abaixo, doravante denominado CLIENTE, têm entre si justo e acordado o seguinte: 

1. IDENTIFICAÇÃO DO CLIENTE 
Nome: ______________________________________________________________________ 
CPF: _______________________________  RG: ______________________________ 
Endereço: ____________________________________________________________________ 
Telefone: _____________________________ 

2. IDENTIFICAÇÃO DO EQUIPAMENTO EMPRESTADO 
Tipo do Equipamento: _________________________________________________________ 
Marca / Modelo: ______________________________________________________________ 
IMEI 1: _______________________________  IMEI 2: __________________________ 
Data de Retirada: //________ 
Data Prevista para Devolução: //________ 
Finalidade do Empréstimo: 
(  ) Uso temporário enquanto o aparelho do cliente encontra-se em reparo 
(  ) Testes técnicos 
(  ) Outro: _______________________________________________________ 
Local de Uso (cidade/estado/país): ____________________________________________ 
Grau de Fragilidade do Equipamento: 
(  ) Alto  (  ) Médio  (  ) Baixo 

3. CONDIÇÕES DO EQUIPAMENTO NO ATO DA ENTREGA 
O CLIENTE declara que recebeu o equipamento: 
(  ) Em perfeitas condições de uso e conservação 
(  ) Com os seguintes danos ou observações pré-existentes: 



4. OBRIGAÇÕES DO CLIENTE 
O CLIENTE compromete-se a: 
a) Utilizar o equipamento exclusivamente para fins lícitos e compatíveis com sua finalidade; 
b) Não emprestar, ceder, vender, sublocar ou transferir o equipamento a terceiros; 
c) Manter o equipamento sob sua posse e guarda direta; 
d) Devolver o equipamento na data acordada, no mesmo estado em que o recebeu, ressalvado o desgaste natural pelo uso regular; 
e) Comunicar imediatamente à EMPRESA qualquer defeito, dano, perda, roubo ou furto. 

5. CLÁUSULA DE MULTA E RESPONSABILIDADE FINANCEIRA 
5.1. Em caso de dano parcial, o CLIENTE arcará com 100% do valor do reparo, conforme orçamento técnico da EMPRESA. 
5.2. Em caso de dano irreparável, perda, extravio, roubo ou furto, o CLIENTE obriga-se a pagar à EMPRESA o valor integral do equipamento, fixado desde já em: 
Valor do Equipamento: R$ ______________________________ 
5.3. O não cumprimento da data de devolução acarretará multa diária de R$ __________, até a efetiva devolução do equipamento. 
5.4. O inadimplemento autoriza a EMPRESA a adotar as medidas administrativas e judiciais cabíveis, inclusive cobrança extrajudicial. 

6. DISPOSIÇÕES GERAIS 
6.1. Este termo possui validade legal, servindo como título comprobatório de responsabilidade. 
6.2. O CLIENTE declara ter lido, compreendido e concordado com todas as cláusulas. 
6.3. Fica eleito o foro da Comarca de Birigui – SP, com renúncia de qualquer outro, por mais privilegiado que seja. 

Birigui, _____ de __________________ de __________. 


Assinatura do Cliente 


Assinatura do Representante da Empresa 
Nome: ____________________________________ 
Cargo: ___________________________________ 
Carimbo da Empresa`

const RECIBO_PAGAMENTO_COMISSAO_TEXTO_PADRAO = `RECIBO DE PAGAMENTO DE COMISSÃO 

Eu, GEOVANA BEATRIZ LOURENÇO, portadora do CPF nº 468.967.478-70, declaro, para os devidos fins, que recebi da empresa Lokatell Celulares Manutenções LTDA, inscrita no CNPJ sob nº 55.313.237/0001-14, com sede à Rua Siqueira Campos, nº 535, Birigui/SP, a quantia de R$ 350,00 (trezentos e cinquenta reais), referente ao pagamento de comissão pelas vendas realizadas no mês de novembro de 2025. 

Declaro, ainda, que o valor acima foi recebido integralmente, nada mais tendo a reclamar a este título. 

Birigui, 03 de dezembro de 2025 

Assinatura do Funcionário: 

GEOVANA BEATRIZ LOURENÇO 

Assinatura e Carimbo da Empresa: 

Lokatell Celulares Manutenções LTDA`

const TERM_TEXTS = {
  'termo-compra-aparelhos': TERMO_COMPRA_TEXTO_PADRAO,
  'termo-aparelho-molhado': TERMO_APARELHO_MOLHADO_TEXTO_PADRAO,
  'pagamento-freelance': PAGAMENTO_FREELANCE_TEXTO_PADRAO,
  'termo-responsabilidade-uso-equipamento': TERMO_RESPONSABILIDADE_USO_EQUIPAMENTO_TEXTO_PADRAO,
  'recibo-pagamento-comissao-funcionarios': RECIBO_PAGAMENTO_COMISSAO_TEXTO_PADRAO,
}

const TERM_FILENAMES = {
  'termo-compra-aparelhos': 'DECLARACAO_DE_COMPRA_DE_APARELHO.pdf',
  'termo-aparelho-molhado': 'TERMO_APARELHO_MOLHADO.pdf',
  'pagamento-freelance': 'RECIBO_PAGAMENTO_FREELANCE.pdf',
  'termo-responsabilidade-uso-equipamento': 'TERMO_RESPONSABILIDADE_USO_EQUIPAMENTO.pdf',
  'recibo-pagamento-comissao-funcionarios': 'RECIBO_PAGAMENTO_COMISSAO_FUNCIONARIOS.pdf',
}

export default function TermsPage({ storeId, user }) {
  const [terms, setTerms] = useState([])
  const [loading, setLoading] = useState(true)

  const canEdit = user?.role === 'owner' || user?.permissions?.terms?.edit
  const canView = user?.role === 'owner' || user?.permissions?.terms?.view || canEdit

  const [selectedTermId, setSelectedTermId] = useState('')
  const [editorText, setEditorText] = useState('')
  
  // Modo de edição
  const [isEditingMode, setIsEditingMode] = useState(false)
  const [newTermName, setNewTermName] = useState('')
  const [editingLabelId, setEditingLabelId] = useState(null)
  const [editingLabelValue, setEditingLabelValue] = useState('')

  useEffect(() => {
    if (!storeId) {
      setLoading(false)
      return
    }

    const unsub = listenTerms((items) => {
      if (items.length === 0) {
        // Se não tiver termos no banco, inicializa com os padrões
        const defaultTerms = TERM_OPTIONS.map(opt => ({
          label: opt.label,
          text: TERM_TEXTS[opt.id] || '',
          filename: TERM_FILENAMES[opt.id] || `${opt.label.replace(/[^a-z0-9]/gi, '_').toUpperCase()}.pdf`
        }))
        seedDefaultTerms(storeId, defaultTerms)
      } else {
        setTerms(items)
        setLoading(false)
        // Se tiver um selecionado que não existe mais, limpa
        // Ou se não tiver nada selecionado, seleciona o primeiro
        if (items.length > 0 && !selectedTermId) {
          // Opcional: auto selecionar o primeiro
          // setSelectedTermId(items[0].id)
          // setEditorText(items[0].text || '')
        }
      }
    }, storeId)

    return () => unsub()
  }, [storeId])

  // Atualiza o texto do editor quando muda o termo selecionado
  // MAS CUIDADO: se o usuário estiver digitando e receber update do banco, pode sobrescrever?
  // Sim, mas aqui estamos assumindo que o editor é local até salvar.
  // Quando troca de termo selecionado, carrega o texto.
  const handleSelectTerm = (id) => {
    setSelectedTermId(id)
    const term = terms.find(t => t.id === id)
    setEditorText(term ? term.text : '')
  }

  const handleSaveDefault = async () => {
    if (!selectedTermId) return
    try {
      await updateTerm(selectedTermId, { text: editorText })
      alert('Texto padrão atualizado e salvo para todos os usuários!')
    } catch (error) {
      console.error(error)
      alert('Erro ao salvar texto.')
    }
  }

  const handleDeleteTerm = async (id, e) => {
    e.stopPropagation()
    if (window.confirm('Tem certeza que deseja excluir este termo para todos os usuários?')) {
      try {
        await deleteTerm(id)
        if (selectedTermId === id) {
          setSelectedTermId('')
          setEditorText('')
        }
      } catch (error) {
        console.error(error)
        alert('Erro ao excluir termo.')
      }
    }
  }

  const handleAddTerm = async () => {
    if (!newTermName.trim()) return
    
    try {
      const label = newTermName.toUpperCase()
      // Verifica duplicidade de nome localmente antes de enviar (opcional)
      const exists = terms.find(t => t.label === label)
      if (exists) {
        alert('Já existe um termo com este nome.')
        return
      }

      const newId = await addTerm({
        label: label,
        text: '',
        filename: `${newTermName.trim().replace(/\s+/g, '_').toUpperCase()}.pdf`
      }, storeId)
      
      setNewTermName('')
      setSelectedTermId(newId)
      setEditorText('')
    } catch (error) {
      console.error(error)
      alert('Erro ao adicionar termo.')
    }
  }

  const handleRenameLabelConfirm = async (term) => {
    if (!term || !editingLabelId) return
    const raw = editingLabelValue.trim()
    const next = raw ? raw.toUpperCase() : term.label
    setEditingLabelValue(next)
    setEditingLabelId(null)
    if (!raw || next === term.label) return
    const exists = terms.some(t => t.id !== term.id && (t.label || '').toUpperCase() === next)
    if (exists) {
      alert('Já existe um termo com este nome.')
      return
    }
    try {
      await updateTerm(term.id, { label: next })
    } catch (error) {
      console.error(error)
      alert('Erro ao renomear termo.')
    }
  }

  const createPdf = () => {
    const doc = new jsPDF()
    const text = editorText || ''
    const lines = doc.splitTextToSize(text, 180)
    let y = 20
    const lineHeight = 7
    lines.forEach(line => {
      if (y > 280) {
        doc.addPage()
        y = 20
      }
      doc.text(line, 15, y)
      y += lineHeight
    })
    return doc
  }

  const handleDownload = () => {
    const doc = createPdf()
    const term = terms.find(t => t.id === selectedTermId)
    const filename = term?.filename || 'documento.pdf'
    doc.save(filename)
  }

  const handlePrint = () => {
    const doc = createPdf()
    doc.autoPrint()
    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    if (!win) return
  }

  if (loading) {
    return <div className="p-6">Carregando termos...</div>
  }

  if (!canView) {
    return <div className="p-6 text-red-600">Você não tem permissão para visualizar esta página.</div>
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold">Termos e Condições</h2>
          <p className="text-sm text-gray-500">
            {isEditingMode 
              ? 'Gerencie seus termos: adicione novos, apague existentes ou edite o texto padrão.' 
              : 'Selecione um termo, edite o texto e depois imprima ou baixe o documento.'}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setIsEditingMode(!isEditingMode)}
            className={`px-3 py-1 text-sm rounded border transition-colors ${
              isEditingMode 
                ? 'bg-blue-100 border-blue-500 text-blue-700' 
                : 'bg-green-600 border-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isEditingMode ? 'Sair da Edição' : 'Editar Termos'}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2 flex justify-between items-center">
            <span>Selecionar termo</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {terms.map(option => {
              const isReady = !!option.text
              let buttonClass = ''
              if (selectedTermId === option.id) {
                buttonClass = 'bg-green-50 border-green-500 text-green-700'
              } else if (!isReady) {
                buttonClass = 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100'
              } else {
                buttonClass = 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }

              return (
                <div key={option.id} className="relative group">
                  <button
                    type="button"
                    onClick={() => handleSelectTerm(option.id)}
                    className={`w-full px-3 py-2 text-xs rounded border text-left transition-colors ${buttonClass} ${isEditingMode ? 'pr-8' : ''}`}
                  >
                    {editingLabelId === option.id && isEditingMode ? (
                      <input
                        type="text"
                        value={editingLabelValue}
                        onChange={e => setEditingLabelValue(e.target.value)}
                        autoFocus
                        onBlur={() => handleRenameLabelConfirm(option)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleRenameLabelConfirm(option)
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault()
                            setEditingLabelId(null)
                            setEditingLabelValue('')
                          }
                        }}
                        className="w-full bg-transparent outline-none border-none text-xs"
                      />
                    ) : (
                      <span
                        onClick={e => {
                          if (!isEditingMode) return
                          e.stopPropagation()
                          setEditingLabelId(option.id)
                          setEditingLabelValue(option.label || '')
                        }}
                      >
                        {option.label}
                      </span>
                    )}
                  </button>
                  {isEditingMode && (
                    <button
                      onClick={(e) => handleDeleteTerm(option.id, e)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-red-500 hover:bg-red-50 rounded"
                      title="Excluir termo"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}
            
            {isEditingMode && (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newTermName}
                  onChange={(e) => setNewTermName(e.target.value)}
                  placeholder="Nome do novo termo..."
                  className="flex-1 px-3 py-2 text-xs border rounded focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleAddTerm}
                  disabled={!newTermName.trim()}
                  className="px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Adicionar
                </button>
              </div>
            )}
          </div>
        </div>

        {selectedTermId && (
          <div className="mt-4 space-y-3">
            <textarea
              className="w-full border rounded p-3 h-80 text-sm focus:ring-green-500 focus:border-green-500"
              value={editorText}
              onChange={e => setEditorText(e.target.value)}
            />
            <div className="flex flex-wrap gap-3 justify-end">
              {isEditingMode && (
                <button
                  type="button"
                  onClick={handleSaveDefault}
                  className="mr-auto px-4 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
                >
                  Salvar como Texto Padrão
                </button>
              )}
              
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 rounded bg-white border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
              >
                Imprimir
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2 rounded bg-green-600 text-white text-sm hover:bg-green-700"
              >
                Baixar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
