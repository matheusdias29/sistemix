import React, { useState } from 'react'
import clsx from 'clsx'

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

export default function SettingsPage({ user, store, onNavigate, onLogout }) {
  const [darkMode, setDarkMode] = useState(false)

  const handleSoon = (name) => () => {
    window.alert(`${name} — em breve`)
  }

  const toggleDark = () => {
    setDarkMode((v) => !v)
    // Aqui apenas guardamos localmente; integração global do tema pode ser feita depois.
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Configurações de empresa */}
      <Section title="Configurações de empresa">
        <Item label="Dados da empresa" onClick={handleSoon('Dados da empresa')} />
        <Item label="Usuários" onClick={() => onNavigate && onNavigate('usuarios')} />
        <Item label="Assistente" onClick={handleSoon('Assistente')} />
      </Section>

      {/* Configurações de venda */}
      <Section title="Configurações de venda">
        <Item label="Formas de pagamento" onClick={handleSoon('Formas de pagamento')} />
        <Item label="Taxas adicionais" onClick={handleSoon('Taxas adicionais')} />
        <Item label="Recibo" onClick={handleSoon('Recibo')} />
        <Item label="Crediário" onClick={handleSoon('Crediário')} />
        <Item label="Comissão" onClick={handleSoon('Comissão')} />
      </Section>

      {/* Configurações fiscais */}
      <Section title="Configurações fiscais">
        <Item label="Configurações fiscais" onClick={handleSoon('Configurações fiscais')} />
        <Item label="Naturezas de operação" onClick={handleSoon('Naturezas de operação')} />
      </Section>

      {/* Configurações adicionais */}
      <Section title="Configurações adicionais">
        <Item label="Cálculos de O.A." onClick={handleSoon('Cálculos de O.A.')} />
        <Item label="Catálogo Online" onClick={handleSoon('Catálogo Online')} />
        <Item label="Configurar O.S" onClick={handleSoon('Configurar O.S')} />
        <Item label="Módulos de mensagens" onClick={handleSoon('Módulos de mensagens')} />
        <Item label="Integrações" onClick={handleSoon('Integrações')} />
      </Section>

      {/* Outras configurações */}
      <Section title="Outras configurações">
        <Item label="Dados do usuário" onClick={handleSoon('Dados do usuário')} />
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
        <Item label="Atualizar App" onClick={handleSoon('Atualizar App')} />
        <Item label="Sair" onClick={() => onLogout && onLogout()} />
      </Section>
    </div>
  )
}