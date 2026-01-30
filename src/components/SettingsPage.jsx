import React, { useState } from 'react'
import clsx from 'clsx'
import ServiceOrderSettingsModal from './ServiceOrderSettingsModal'
import CommissionsSettingsModal from './CommissionsSettingsModal'

function Section({ title, children }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base">{title}</h3>
      </div>
      <div className="mt-2 divide-y">
        {children}
      </div>
    </div>
  )
}

function Item({ label, onClick, rightSlot }) {
  return (
    <div
      className="py-3 px-2 flex items-center justify-between cursor-pointer hover:bg-gray-50"
      onClick={onClick}
      role="button"
    >
      <span className="text-sm text-gray-800">{label}</span>
      {rightSlot ?? <span className="text-gray-400">›</span>}
    </div>
  )
}

export default function SettingsPage({ user, store, onNavigate, onLogout, darkMode=false, onToggleDark }) {
  const [osSettingsOpen, setOsSettingsOpen] = useState(false)
  const [commissionsOpen, setCommissionsOpen] = useState(false)

  const handleSoon = (name) => () => {
    window.alert(`${name} — em breve`)
  }

  const toggleDark = () => { onToggleDark && onToggleDark() }

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Configurações de empresa */}
      <Section title="Configurações de empresa">
        <Item label="Dados da empresa" onClick={() => onNavigate && onNavigate('dadosEmpresa')} />
        <Item label="Usuários" onClick={() => onNavigate && onNavigate('usuarios')} />
        <Item label="Assinatura" onClick={handleSoon('Assinatura')} />
      </Section>

      {/* Configurações de venda */}
      <Section title="Configurações de venda">
        <Item label="Formas de pagamento" onClick={() => onNavigate && onNavigate('formasPagamento')} />
        <Item label="Taxas adicionais" onClick={() => onNavigate && onNavigate('taxas')} />
        <Item label="Recibo" onClick={handleSoon('Recibo')} />
        <Item label="Crediário" onClick={handleSoon('Crediário')} />
        <Item label="Comissão" onClick={() => setCommissionsOpen(true)} />
      </Section>

      {/* Configurações fiscais */}
      <Section title="Configurações fiscais">
        <Item label="Configurações fiscais" onClick={handleSoon('Configurações fiscais')} />
        <Item label="Naturezas de operação" onClick={handleSoon('Naturezas de operação')} />
      </Section>

      {/* Configurações adicionais */}
      <Section title="Configurações adicionais">
        <Item label="Configurar O.S" onClick={() => setOsSettingsOpen(true)} />
      </Section>

      {/* Outras configurações */}
      <Section title="Outras configurações">
        <Item label="Dados do usuário" onClick={() => onNavigate && onNavigate('dadosUsuario')} />
        <Item
          label="Modo escuro"
          onClick={toggleDark}
          rightSlot={
            <button
              type="button"
              className={clsx(
                'w-12 h-6 rounded-full relative transition-all',
                darkMode ? 'bg-green-600' : 'bg-gray-300'
              )}
            >
              <span
                className={clsx(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                  darkMode ? 'right-0.5' : 'left-0.5'
                )}
              />
            </button>
          }
        />
        <Item label="Sair" onClick={() => onLogout && onLogout()} />
      </Section>
      
      {osSettingsOpen && (
        <ServiceOrderSettingsModal store={store} onClose={() => setOsSettingsOpen(false)} />
      )}
      
      {commissionsOpen && (
        <CommissionsSettingsModal store={store} onClose={() => setCommissionsOpen(false)} />
      )}
    </div>
  )
}
