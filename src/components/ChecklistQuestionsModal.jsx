import React, { useState, useEffect } from 'react'

export default function ChecklistQuestionsModal({ open, onClose, checklist, initialAnswers, onConfirm }) {
  const [answers, setAnswers] = useState({})

  useEffect(() => {
    if (open) {
      setAnswers(initialAnswers || {})
    }
  }, [open, initialAnswers])

  if (!open || !checklist) return null

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[500px] max-w-[95vw]">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-lg">Checklist</h3>
        </div>
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-3">
            {(checklist.questions || []).map(q => (
              <label key={q.id} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input 
                  type="checkbox" 
                  checked={!!answers[q.id]}
                  onChange={() => setAnswers(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                  className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-gray-700">{q.text}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="p-4 border-t flex items-center justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            ✕ Cancelar
          </button>
          <button 
            type="button" 
            onClick={() => onConfirm(answers)} 
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2"
          >
            <span>✓</span> Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}
