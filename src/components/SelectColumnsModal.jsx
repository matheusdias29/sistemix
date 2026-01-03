import React, { useState, useEffect } from 'react'

export default function SelectColumnsModal({ open, onClose, columns, onSave, onReset }) {
  const [localColumns, setLocalColumns] = useState([])

  const [draggedItemIndex, setDraggedItemIndex] = useState(null)

  useEffect(() => {
    if (open) {
      setLocalColumns([...columns])
    }
  }, [open, columns])

  if (!open) return null

  const toggleColumn = (id) => {
    setLocalColumns(prev => prev.map(c => 
      c.id === id ? { ...c, visible: !c.visible } : c
    ))
  }

  const onDragStart = (e, index) => {
    setDraggedItemIndex(index)
    e.dataTransfer.effectAllowed = "move"
    // Set a transparent drag image or similar if needed, but default is usually fine
  }

  const onDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    
    if (draggedItemIndex === null || draggedItemIndex === index) return

    const newCols = [...localColumns]
    const draggedItem = newCols[draggedItemIndex]
    
    // Remove the dragged item
    newCols.splice(draggedItemIndex, 1)
    // Insert it at the new position
    newCols.splice(index, 0, draggedItem)
    
    setLocalColumns(newCols)
    setDraggedItemIndex(index)
  }

  const onDragEnd = () => {
    setDraggedItemIndex(null)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg w-full max-w-md p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Selecione as colunas</h3>
        
        <div className="space-y-2 max-h-[60vh] overflow-y-auto mb-6">
          {localColumns.map((col, index) => (
            <div 
              key={col.id} 
              draggable
              onDragStart={(e) => onDragStart(e, index)}
              onDragOver={(e) => onDragOver(e, index)}
              onDragEnd={onDragEnd}
              className={`flex items-center justify-between p-2 rounded border transition-colors ${draggedItemIndex === index ? 'bg-gray-100 border-gray-200 opacity-50' : 'hover:bg-gray-50 border-transparent hover:border-gray-100'}`}
            >
              <label className="flex items-center gap-3 cursor-pointer flex-1">
                <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${col.visible ? 'bg-green-600 border-green-600' : 'border-gray-300 bg-white'}`}>
                  {col.visible && (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={col.visible} 
                  onChange={() => toggleColumn(col.id)}
                />
                <span className="text-sm text-gray-700 font-medium">{col.label}</span>
              </label>
              
              <div className="flex items-center gap-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <button 
            onClick={() => {
              if (onReset) {
                onReset()
                onClose()
              }
            }}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-2 py-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Resetar
          </button>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium px-4 py-2"
            >
              Voltar
            </button>
            <button 
              onClick={() => onSave(localColumns)}
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-md shadow-sm transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
