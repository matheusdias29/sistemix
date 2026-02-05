import React from 'react'

export default function Switch({ checked=false, onChange, label, disabled=false, className='' }){
  const toggle = () => {
    if (disabled) return
    onChange && onChange(!checked)
  }

  const onKeyDown = (e) => {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggle()
    }
  }

  return (
    <div className={`flex items-center justify-between ${className}`}>
      {label ? <span className={`text-sm ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>{label}</span> : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled}
        onClick={toggle}
        onKeyDown={onKeyDown}
        className={`relative inline-flex h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${disabled ? 'bg-gray-300 cursor-not-allowed' : (checked ? 'bg-green-500' : 'bg-gray-300')} ${checked ? 'focus:ring-green-500' : 'focus:ring-gray-400'}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
    </div>
  )
}