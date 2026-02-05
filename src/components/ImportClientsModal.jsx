
import React, { useState } from 'react'
import { read, utils } from 'xlsx'
import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

export default function ImportClientsModal({ open, onClose, storeId, onSuccess }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState('')

  if (!open) return null

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setError('')
    
    try {
      const data = await selectedFile.arrayBuffer()
      const workbook = read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const json = utils.sheet_to_json(worksheet)
      setPreview(json.slice(0, 5)) // Preview first 5 rows
    } catch (err) {
      console.error(err)
      setError('Erro ao ler arquivo. Certifique-se que é um arquivo Excel válido.')
    }
  }

  const mapClient = (row) => {
    // Helper to clean strings
    const str = (val) => val ? String(val).trim() : ''
    
    // Helper for booleans
    const bool = (val) => {
        if (!val) return false
        const s = String(val).toLowerCase()
        return s === 'sim' || s === 's' || s === 'true' || s === 'yes'
    }

    // Heuristic for City/Neighborhood based on user's specific file issue
    let city = str(row['CIDADE'])
    let neighborhood = str(row['BAIRRO'])
    
    // If city is empty and neighborhood looks like a city (common in some exports)
    // We will just populate both if city is missing, or leave it to the user to fix?
    // Given the specific request for "lokatell birigui", we can default City to 'Birigui' if missing?
    // Better: If city is empty, use neighborhood as city (as observed in the file).
    if (!city && neighborhood) {
        // List of known cities from the file sample
        const knownCities = ['BIRIGUI', 'ARAÇATUBA', 'CLEMENTINA', 'GABRIEL MONTEIRO', 'BILAC', 'COROADOS']
        if (knownCities.includes(neighborhood.toUpperCase())) {
            city = neighborhood
            // If we moved it to city, should we clear neighborhood? Maybe keep it to be safe.
        }
    }

    return {
        storeId,
        code: str(row['CÓDIGO']),
        name: str(row['NOME']) || 'Cliente Importado',
        isCompany: str(row['TIPO']).toLowerCase() === 'jurídica',
        phone: str(row['TELEFONE']),
        whatsapp: str(row['WHATSAPP']),
        allowCredit: bool(row['CRÉDITO HABILITADO']),
        creditLimit: parseFloat(row['LIMITE DE CRÉDITO']) || 0, // Extra field
        active: row['CADASTRO ATIVO'] ? bool(row['CADASTRO ATIVO']) : true,
        
        // Address
        cep: str(row['CEP']),
        state: str(row['ESTADO']),
        city: city,
        address: str(row['ENDEREÇO']),
        number: str(row['NÚMERO']),
        complement: str(row['COMPLEMENTO']),
        neighborhood: neighborhood,
        
        // Docs
        cpf: str(row['CPF']),
        cnpj: str(row['CNPJ']), // In case it exists

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    }
  }

  const handleImport = async () => {
    if (!file) return
    
    setImporting(true)
    setProgress({ current: 0, total: 0 })
    setError('')

    try {
        const data = await file.arrayBuffer()
        const workbook = read(data)
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const json = utils.sheet_to_json(worksheet)

        const total = json.length
        setProgress({ current: 0, total })

        // Process in chunks of 400 (Firestore batch limit is 500)
        const chunkSize = 400
        const chunks = []
        
        for (let i = 0; i < total; i += chunkSize) {
            chunks.push(json.slice(i, i + chunkSize))
        }

        let processed = 0

        for (const chunk of chunks) {
            const batch = writeBatch(db)
            
            chunk.forEach(row => {
                const clientData = mapClient(row)
                const ref = doc(collection(db, 'clients'))
                batch.set(ref, clientData)
            })

            await batch.commit()
            processed += chunk.length
            setProgress({ current: processed, total })
        }

        alert('Importação concluída com sucesso!')
        if (onSuccess) onSuccess()
        onClose()

    } catch (err) {
        console.error(err)
        setError('Erro ao importar clientes: ' + err.message)
    } finally {
        setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b dark:border-gray-700 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Importar Clientes</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">✕</button>
        </div>
        
        <div className="p-6">
            {!importing ? (
                <>
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Selecione o arquivo Excel (.xlsx)
                        </label>
                        <input 
                            type="file" 
                            accept=".xlsx, .xls"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-gray-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-sm file:font-semibold
                                file:bg-green-50 file:text-green-700
                                hover:file:bg-green-100"
                        />
                        <p className="mt-2 text-xs text-gray-500">
                            Certifique-se que o arquivo possui as colunas: NOME, TELEFONE, etc.
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
                            {error}
                        </div>
                    )}

                    {preview.length > 0 && (
                        <div className="mb-4">
                            <h4 className="text-sm font-medium mb-2">Pré-visualização (5 primeiros):</h4>
                            <div className="bg-gray-50 dark:bg-gray-900 rounded p-2 text-xs overflow-x-auto">
                                <pre>{JSON.stringify(preview, null, 2)}</pre>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                    <p className="text-lg font-medium">Importando...</p>
                    <p className="text-gray-500">{progress.current} de {progress.total} clientes processados</p>
                </div>
            )}
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 flex justify-end gap-3">
            {!importing && (
                <>
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleImport}
                        disabled={!file}
                        className={`px-4 py-2 rounded-md text-white font-medium ${!file ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                    >
                        Importar
                    </button>
                </>
            )}
        </div>
      </div>
    </div>
  )
}
