import React, { useState, useEffect, useRef } from 'react'
import { updateStore } from '../services/stores'

const DEFAULT_STATUSES_LIST = [
  'Iniciado',
  'Finalizado',
  'Os Faturada Cliente Final',
  'Os Faturada Cliente lojista',
  'Cancelado',
  'Serviço Aprovado Em Procedimento Com Tecnico',
  'Serviço Realizado Pronto Na Gaveta',
  'Serviço Não Aprovado P/cliente Devoluçao Na Gaveta',
  'Garantia De Peça E Serviço Cliente lojista',
  'Devolução Cliente Lojista Já Na Gaveta',
  'Peça Para Troca E Devolução Ao Fornecedor',
  'Serviço Aguardando Peça Na Gaveta',
  'Devolução Cliente Final Já Na Gaveta',
  'Garantia De Peça E Serviço Cliente Final',
  'Serviço Não Realizado Devolução Na Gaveta',
  'Serviço Em Orçamento Com Tecnico',
  'Os Já Devolvida Ao Lojista - Sem Conserto',
  'Os Já Devolvido Ao Cliente Final - Sem Conserto',
  'Devolução Já Entregue Ao Cliente',
  'APARELHO LIBERADO AGUARDANDO PAGAMENTO'
]

const LOCKED_STATUSES = ['Iniciado', 'Finalizado', 'Os Faturada Cliente Final', 'Os Faturada Cliente lojista', 'Cancelado']

const STATUS_COLORS = [
  { label: 'Verde', value: '#22c55e', bg: 'bg-green-500' },
  { label: 'Vermelho', value: '#ef4444', bg: 'bg-red-500' },
  { label: 'Azul', value: '#3b82f6', bg: 'bg-blue-500' },
  { label: 'Laranja', value: '#f97316', bg: 'bg-orange-500' },
  { label: 'Cinza', value: '#6b7280', bg: 'bg-gray-500' },
  { label: 'Preto', value: '#000000', bg: 'bg-black' }
]

export default function ServiceOrderSettingsModal({ store, onClose }) {
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('status')
  
  const [settings, setSettings] = useState({
    warrantyText: '',
    headerText: '',
    footerText: '',
    linkText: ''
  })
  
  const [statuses, setStatuses] = useState([])
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [currentStatus, setCurrentStatus] = useState(null)

  const [checklists, setChecklists] = useState([])
  const [checklistModalOpen, setChecklistModalOpen] = useState(false)
  const [currentChecklist, setCurrentChecklist] = useState(null)

  const dragItem = useRef(null)
  const dragOverItem = useRef(null)

  useEffect(() => {
    const defaultWarranty = `Garantia de produtos e serviços. 
90 dias para defeito de fabricação. 
Não cobre aparelho ou produto com sinais de humidade. 
Não cobre produto quebrado . 
Não cobre riscos na tela. 
Não cobre trincos na tela. 
Não cobre manchas ,listras trincos internos 
Ou externos na peça . 
Não cobre selo ou lacre rompido. 
Fica ciente que cliente em caso de defetio 
deve Retornar A empresa,No prazo estabelecido. 
Em caso de insatisfação cliente tem 7 dias 
Para pedir estorno... E a empresa não tem responsabilidade 
de colocar a peça velha no lugar, pois sao descartadas diariamente. 
Visando e focanda na qualidade! 
todos os produto são testados na loja antes da saída para o cliente da loja e testado junto ao cliente. 
Sendo assim cliente ciente e de acordo 
Com todos os termos acima, citado.`

    const defaultHeader = 'TERMO DE GARANTIA'
    
    const defaultFooter = `Obrigado pela preferência
Volte sempre!`

    const saved = store?.serviceOrderSettings || {}
    
    setSettings({
      warrantyText: saved.warrantyText || defaultWarranty,
      headerText: saved.headerText || defaultHeader,
      footerText: saved.footerText || defaultFooter,
      linkText: saved.linkText || ''
    })

    // Statuses
    if (saved.statuses && Array.isArray(saved.statuses) && saved.statuses.length > 0) {
      setStatuses(saved.statuses)
    } else {
      const init = DEFAULT_STATUSES_LIST.map((name, i) => {
        let color = '#f97316' // Orange default
        if (name === 'Iniciado') color = '#000000'
        if (name.includes('Finalizado') || name.includes('Faturada')) color = '#22c55e'
        if (name === 'Cancelado') color = '#ef4444'
        
        return {
          id: `st-${Date.now()}-${i}`,
          name,
          locked: LOCKED_STATUSES.includes(name),
          color,
          active: true,
          countInGoal: false
        }
      })
      setStatuses(init)
    }

    // Checklists
    if (saved.checklists && Array.isArray(saved.checklists)) {
      setChecklists(saved.checklists)
    } else {
      setChecklists([
        { 
          id: 'cl-1', 
          name: 'Checklist de Entrada do Aparelho', 
          active: true, 
          questions: [
            { id: 'q-1-1', text: '' },
            { id: 'q-1-2', text: '' },
            { id: 'q-1-3', text: '' }
          ] 
        },
        { 
          id: 'cl-2', 
          name: 'APARELHO EM ORÇAMENTO', 
          active: true, 
          questions: [
            { id: 'q-2-1', text: '' },
            { id: 'q-2-2', text: '' },
            { id: 'q-2-3', text: '' }
          ] 
        }
      ])
    }
  }, [store])

  const handleSave = async () => {
    try {
      setLoading(true)
      await updateStore(store.id, {
        serviceOrderSettings: {
          ...settings,
          statuses,
          checklists
        }
      })
      onClose()
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Erro ao salvar configurações')
    } finally {
      setLoading(false)
    }
  }

  // Drag functions
  const onDragStart = (e, index) => {
    dragItem.current = index
  }
  const onDragEnter = (e, index) => {
    dragOverItem.current = index
  }
  const onDragEnd = () => {
    const _statuses = [...statuses]
    const draggedItemContent = _statuses[dragItem.current]
    _statuses.splice(dragItem.current, 1)
    _statuses.splice(dragOverItem.current, 0, draggedItemContent)
    dragItem.current = null
    dragOverItem.current = null
    setStatuses(_statuses)
  }

  // Status Actions
  const handleEditStatus = (status) => {
    setCurrentStatus({ ...status })
    setStatusModalOpen(true)
  }

  const handleAddStatus = () => {
    setCurrentStatus({
      id: `st-${Date.now()}`,
      name: '',
      color: '#f97316',
      locked: false,
      active: true,
      countInGoal: false
    })
    setStatusModalOpen(true)
  }

  const saveStatus = () => {
    if (!currentStatus.name.trim()) return alert('Nome é obrigatório')
    
    setStatuses(prev => {
      const idx = prev.findIndex(s => s.id === currentStatus.id)
      if (idx >= 0) {
        const newArr = [...prev]
        newArr[idx] = currentStatus
        return newArr
      } else {
        return [...prev, currentStatus]
      }
    })
    setStatusModalOpen(false)
  }

  const handleDeleteStatus = (id) => {
     if(!confirm('Deseja excluir este status?')) return
     setStatuses(prev => prev.filter(s => s.id !== id))
  }
  
  // Checklist Actions
  const handleAddChecklist = () => {
    setCurrentChecklist({
      id: `cl-${Date.now()}`,
      name: '',
      active: true,
      questions: [
        { id: `q-${Date.now()}-1`, text: '' },
        { id: `q-${Date.now()}-2`, text: '' },
        { id: `q-${Date.now()}-3`, text: '' }
      ]
    })
    setChecklistModalOpen(true)
  }

  const handleEditChecklist = (checklist) => {
    // Ensure questions structure
    const questions = (checklist.questions || []).map(q => 
      typeof q === 'string' ? { id: Math.random().toString(), text: q } : q
    )
    setCurrentChecklist({ ...checklist, questions })
    setChecklistModalOpen(true)
  }

  const saveChecklist = () => {
    if (!currentChecklist.name.trim()) return alert('Nome é obrigatório')
    
    setChecklists(prev => {
      const idx = prev.findIndex(c => c.id === currentChecklist.id)
      if (idx >= 0) {
        const newArr = [...prev]
        newArr[idx] = currentChecklist
        return newArr
      } else {
        return [...prev, currentChecklist]
      }
    })
    setChecklistModalOpen(false)
  }

  const addQuestion = () => {
    setCurrentChecklist(prev => ({
      ...prev,
      questions: [...prev.questions, { id: `q-${Date.now()}`, text: '' }]
    }))
  }

  const removeQuestion = (qId) => {
    setCurrentChecklist(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== qId)
    }))
  }

  const updateQuestion = (qId, text) => {
    setCurrentChecklist(prev => ({
      ...prev,
      questions: prev.questions.map(q => q.id === qId ? { ...q, text } : q)
    }))
  }

  // Render Helpers
  const renderStatusModal = () => {
    if(!statusModalOpen || !currentStatus) return null
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white w-full max-w-md rounded-lg shadow-xl p-6">
          <h3 className="text-lg font-bold mb-4">{currentStatus.locked ? 'Visualizar Status' : 'Editar Status'}</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome</label>
              <input 
                type="text" 
                value={currentStatus.name} 
                onChange={e => !currentStatus.locked && setCurrentStatus({...currentStatus, name: e.target.value})}
                disabled={currentStatus.locked}
                className="mt-1 block w-full border rounded p-2 bg-gray-50 disabled:bg-gray-100 disabled:text-gray-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cor</label>
              <div className="flex gap-2">
                {STATUS_COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setCurrentStatus({...currentStatus, color: c.value})}
                    className={`w-8 h-8 rounded-full ${c.bg} ${currentStatus.color === c.value ? 'ring-2 ring-offset-2 ring-black' : ''}`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
               <input 
                 type="checkbox" 
                 checked={currentStatus.countInGoal} 
                 onChange={e => setCurrentStatus({...currentStatus, countInGoal: e.target.checked})}
                 id="goal"
               />
               <label htmlFor="goal" className="text-sm text-gray-700">Contabilizar na meta</label>
            </div>
            
            <div className="flex items-center gap-2">
               <input 
                 type="checkbox" 
                 checked={currentStatus.active} 
                 onChange={e => setCurrentStatus({...currentStatus, active: e.target.checked})}
                 id="active"
               />
               <label htmlFor="active" className="text-sm text-gray-700">Cadastro Ativo</label>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setStatusModalOpen(false)} className="px-4 py-2 text-gray-600">Cancelar</button>
            <button onClick={saveStatus} className="px-4 py-2 bg-green-600 text-white rounded">Confirmar</button>
          </div>
        </div>
      </div>
    )
  }

  const renderChecklistModal = () => {
    if (!checklistModalOpen || !currentChecklist) return null
    return (
       <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-lg rounded-lg shadow-xl p-6 max-h-[90vh] flex flex-col">
             <h3 className="text-lg font-bold mb-4">Checklist</h3>
             
             <div className="space-y-4 flex-1 overflow-y-auto pr-2">
                <div>
                   <label className="block text-sm font-medium text-gray-700">Nome</label>
                   <input 
                      type="text" 
                      value={currentChecklist.name}
                      onChange={e => setCurrentChecklist({...currentChecklist, name: e.target.value})}
                      className="mt-1 block w-full border rounded p-2 bg-gray-50"
                      placeholder="Nome do checklist"
                   />
                </div>
                
                <div className="flex items-center gap-2">
                   <button 
                      onClick={() => setCurrentChecklist(prev => ({ ...prev, active: !prev.active }))}
                      className={`w-10 h-5 rounded-full relative transition-colors ${currentChecklist.active ? 'bg-green-500' : 'bg-gray-300'}`}
                   >
                      <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${currentChecklist.active ? 'left-6' : 'left-1'}`} />
                   </button>
                   <span className="text-sm text-gray-700">Ativo</span>
                </div>

                <div>
                   <label className="block text-sm font-bold text-gray-700 mb-2">Perguntas</label>
                   <div className="space-y-2">
                      {currentChecklist.questions.map((q, idx) => (
                         <div key={q.id} className="flex gap-2 items-center">
                            <input 
                               value={q.text}
                               onChange={e => updateQuestion(q.id, e.target.value)}
                               className="flex-1 border rounded p-2 bg-gray-50"
                               placeholder="Digite uma pergunta..."
                            />
                            <button onClick={() => removeQuestion(q.id)} className="text-gray-400 hover:text-red-500">
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                               </svg>
                            </button>
                         </div>
                      ))}
                   </div>
                   <button onClick={addQuestion} className="mt-3 px-3 py-1.5 border border-green-500 text-green-600 rounded text-sm font-medium hover:bg-green-50">
                      Adicionar Pergunta
                   </button>
                </div>
             </div>

             <div className="mt-6 flex justify-end gap-2 pt-4 border-t">
                <button onClick={() => setChecklistModalOpen(false)} className="px-4 py-2 text-gray-600">Cancelar</button>
                <button onClick={saveChecklist} className="px-4 py-2 bg-green-600 text-white rounded">Confirmar</button>
             </div>
          </div>
       </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white w-full max-w-5xl h-[90vh] flex flex-col rounded-lg shadow-xl overflow-hidden">
         {/* Header */}
         <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
            <h2 className="text-xl font-semibold text-gray-800">Configurar Ordem de Serviço</h2>
            <div className="flex items-center gap-3">
               <button onClick={handleSave} disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                 {loading ? 'Salvando...' : 'Salvar Alterações'}
               </button>
               <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
            </div>
         </div>
         
         {/* Tabs */}
         <div className="flex border-b px-6">
            <button 
              onClick={() => setActiveTab('general')}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === 'general' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Geral (Textos)
            </button>
            <button 
              onClick={() => setActiveTab('status')}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === 'status' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Status da O.S.
            </button>
            <button 
              onClick={() => setActiveTab('checklists')}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === 'checklists' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Checklists
            </button>
         </div>

         {/* Content */}
         <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            {activeTab === 'general' && (
               <div className="space-y-6 max-w-3xl mx-auto">
                  {/* Warranty Text */}
                  <div>
                    <h3 className="text-base font-bold text-gray-900 mb-1">Texto padrão de garantia</h3>
                    <textarea
                      value={settings.warrantyText}
                      onChange={e => setSettings(prev => ({ ...prev, warrantyText: e.target.value }))}
                      className="w-full border rounded-md p-3 text-sm h-32"
                    />
                  </div>
                  {/* Header Text */}
                  <div>
                    <h3 className="text-base font-bold text-gray-900 mb-1">Texto padrão da impressão</h3>
                    <input
                      value={settings.headerText}
                      onChange={e => setSettings(prev => ({ ...prev, headerText: e.target.value }))}
                      className="w-full border rounded-md p-3 text-sm"
                    />
                  </div>
                  {/* Footer Text */}
                  <div>
                    <h3 className="text-base font-bold text-gray-900 mb-1">Texto do rodapé</h3>
                    <textarea
                      value={settings.footerText}
                      onChange={e => setSettings(prev => ({ ...prev, footerText: e.target.value }))}
                      className="w-full border rounded-md p-3 text-sm h-24"
                    />
                  </div>
                   {/* Link Text */}
                  <div>
                    <h3 className="text-base font-bold text-gray-900 mb-1">Texto padrão de envio do link da ordem de serviço</h3>
                    <input
                      value={settings.linkText}
                      onChange={e => setSettings(prev => ({ ...prev, linkText: e.target.value }))}
                      className="w-full border rounded-md p-3 text-sm"
                      placeholder="Ex: Olá, segue link da sua OS..."
                    />
                  </div>
               </div>
            )}
            
            {activeTab === 'status' && (
               <div className="max-w-4xl mx-auto">
                  <div className="flex justify-between items-center mb-6">
                     <div>
                        <h3 className="text-lg font-bold text-gray-900">Status da ordem de serviço</h3>
                        <p className="text-sm text-gray-500">Configure os status e a ordem de exibição.</p>
                     </div>
                     <button onClick={handleAddStatus} className="px-3 py-2 bg-green-600 text-white rounded text-sm flex items-center gap-2">
                        + Adicionar
                     </button>
                  </div>
                  
                  <div className="bg-white rounded shadow divide-y">
                     {statuses.map((status, index) => (
                        <div 
                          key={status.id}
                          draggable
                          onDragStart={(e) => onDragStart(e, index)}
                          onDragEnter={(e) => onDragEnter(e, index)}
                          onDragEnd={onDragEnd}
                          onDragOver={(e) => e.preventDefault()}
                          className="flex items-center p-3 hover:bg-gray-50 cursor-move group"
                        >
                           {/* Drag Handle */}
                           <div className="text-gray-400 mr-3 cursor-move">
                              ⋮⋮
                           </div>
                           
                           {/* Color Dot */}
                           <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: status.color }}></div>
                           
                           {/* Name */}
                           <div className="flex-1 font-medium text-gray-800 text-sm">
                              {status.name}
                           </div>
                           
                           {/* Badges */}
                           <div className="flex items-center gap-2 mr-4">
                              {status.locked && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded flex items-center gap-1">🔒 Bloqueado</span>}
                              {!status.active && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">Inativo</span>}
                              {status.countInGoal && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">Meta</span>}
                           </div>
                           
                           {/* Actions */}
                           <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEditStatus(status)} className="p-1 text-gray-500 hover:text-blue-600">
                                 ✎
                              </button>
                              {!status.locked && (
                                <button onClick={() => handleDeleteStatus(status.id)} className="p-1 text-gray-500 hover:text-red-600">
                                   🗑
                                </button>
                              )}
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            )}

            {activeTab === 'checklists' && (
               <div className="max-w-4xl mx-auto">
                  <div className="flex justify-between items-center mb-6">
                     <div>
                        <h3 className="text-lg font-bold text-gray-900">Checklists</h3>
                        <p className="text-sm text-gray-500">Configure os checklists para facilitar a criação de ordens de serviço.</p>
                     </div>
                     <button onClick={handleAddChecklist} className="px-3 py-2 bg-green-600 text-white rounded text-sm flex items-center gap-2">
                        + Adicionar Checklist
                     </button>
                  </div>

                  <div className="bg-white rounded shadow overflow-hidden">
                     {/* Header */}
                     <div className="flex items-center p-3 bg-gray-50 border-b text-sm font-medium text-gray-600">
                        <div className="flex-1">Nome</div>
                        <div className="w-20 text-center">Ativo</div>
                     </div>
                     {/* List */}
                     <div className="divide-y">
                        {checklists.map((cl) => (
                           <div 
                              key={cl.id} 
                              onClick={() => handleEditChecklist(cl)}
                              className="flex items-center p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                           >
                              <div className="flex-1 font-medium text-gray-800 text-sm">
                                 {cl.name}
                              </div>
                              <div className="w-20 flex justify-center">
                                 <span className={`px-2 py-0.5 rounded text-xs font-medium ${cl.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {cl.active ? 'Ativo' : 'Inativo'}
                                 </span>
                              </div>
                           </div>
                        ))}
                        {checklists.length === 0 && (
                           <div className="p-8 text-center text-gray-500 text-sm">
                              Nenhum checklist cadastrado.
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            )}
         </div>
         {renderStatusModal()}
         {renderChecklistModal()}
      </div>
    </div>
  )
}
