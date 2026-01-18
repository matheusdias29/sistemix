import React, { useState, useEffect, useRef } from 'react'

export default function Calculator() {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ x: window.innerWidth - 320, y: window.innerHeight - 450 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  
  const [display, setDisplay] = useState('0')
  const [memory, setMemory] = useState(null)
  const [operator, setOperator] = useState(null)
  const [waitingForOperand, setWaitingForOperand] = useState(false)

  const nodeRef = useRef(null)

  // Initialize position on mount (bottom right)
  useEffect(() => {
    setPosition({
      x: window.innerWidth - 340,
      y: window.innerHeight - 500
    })
  }, [])

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset])

  const handleMouseDown = (e) => {
    // Only allow drag from header
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }

  const inputDigit = (digit) => {
    if (waitingForOperand) {
      setDisplay(String(digit))
      setWaitingForOperand(false)
    } else {
      setDisplay(display === '0' ? String(digit) : display + digit)
    }
  }

  const inputDot = () => {
    if (waitingForOperand) {
      setDisplay('0.')
      setWaitingForOperand(false)
    } else if (display.indexOf('.') === -1) {
      setDisplay(display + '.')
    }
  }

  const clear = () => {
    setDisplay('0')
    setMemory(null)
    setOperator(null)
    setWaitingForOperand(false)
  }

  const toggleSign = () => {
    setDisplay(String(parseFloat(display) * -1))
  }

  const percent = () => {
    setDisplay(String(parseFloat(display) / 100))
  }

  const performOperation = (nextOperator) => {
    const inputValue = parseFloat(display)

    if (memory === null) {
      setMemory(inputValue)
    } else if (operator) {
      const currentValue = memory || 0
      const newValue = calculate(currentValue, inputValue, operator)
      setMemory(newValue)
      setDisplay(String(newValue))
    }

    setWaitingForOperand(true)
    setOperator(nextOperator)
  }

  const calculate = (left, right, op) => {
    switch (op) {
      case '+': return left + right
      case '-': return left - right
      case '*': return left * right
      case '/': return left / right
      default: return right
    }
  }

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      const target = e.target
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }

      const key = e.key

      if (key >= '0' && key <= '9') {
        e.preventDefault()
        inputDigit(Number(key))
        return
      }

      if (key === ',' || key === '.') {
        e.preventDefault()
        inputDot()
        return
      }

      if (key === '+' || key === '-' || key === '*' || key === '/') {
        e.preventDefault()
        performOperation(key)
        return
      }

      if (key === 'Enter' || key === '=') {
        e.preventDefault()
        performOperation('=')
        return
      }

      if (key === 'Backspace') {
        e.preventDefault()
        setDisplay((prev) => {
          const str = String(prev ?? '')
          if (str.length <= 1) {
            setWaitingForOperand(false)
            return '0'
          }
          setWaitingForOperand(false)
          return str.slice(0, -1)
        })
        return
      }

      if (key === 'Escape') {
        e.preventDefault()
        clear()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, inputDigit, inputDot, performOperation, clear])

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 md:right-auto md:left-72 w-14 h-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg flex items-center justify-center z-[100] transition-transform hover:scale-105 active:scale-95"
        title="Calculadora"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2"></rect>
          <line x1="8" y1="6" x2="16" y2="6"></line>
          <line x1="16" y1="14" x2="16" y2="14"></line>
          <line x1="16" y1="18" x2="16" y2="18"></line>
          <line x1="12" y1="14" x2="12" y2="14"></line>
          <line x1="12" y1="18" x2="12" y2="18"></line>
          <line x1="8" y1="14" x2="8" y2="14"></line>
          <line x1="8" y1="18" x2="8" y2="18"></line>
        </svg>
      </button>
    )
  }

  return (
    <div
      ref={nodeRef}
      style={{
        left: position.x,
        top: position.y,
      }}
      className="fixed z-[100] w-72 bg-gray-900 rounded-xl shadow-2xl overflow-hidden border border-gray-700 flex flex-col"
    >
      {/* Header - Draggable Area */}
      <div
        onMouseDown={handleMouseDown}
        className="bg-gray-800 p-3 flex justify-between items-center cursor-move select-none"
      >
        <div className="flex items-center gap-2 text-gray-300">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="2"></rect>
            <line x1="8" y1="6" x2="16" y2="6"></line>
          </svg>
          <span className="text-xs font-bold uppercase tracking-wider">Calculadora</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Display */}
      <div className="bg-gray-900 p-4 text-right">
        <div className="text-white text-3xl font-light tracking-wider truncate">
          {display}
        </div>
      </div>

      {/* Keypad */}
      <div className="bg-gray-800 p-4 grid grid-cols-4 gap-2">
        <button onClick={clear} className="col-span-1 bg-gray-600 hover:bg-gray-500 text-white h-10 rounded text-sm font-medium">AC</button>
        <button onClick={toggleSign} className="bg-gray-600 hover:bg-gray-500 text-white h-10 rounded text-sm font-medium">+/-</button>
        <button onClick={percent} className="bg-gray-600 hover:bg-gray-500 text-white h-10 rounded text-sm font-medium">%</button>
        <button onClick={() => performOperation('/')} className="bg-orange-500 hover:bg-orange-400 text-white h-10 rounded text-xl font-medium">÷</button>

        <button onClick={() => inputDigit(7)} className="bg-gray-700 hover:bg-gray-600 text-white h-10 rounded text-lg font-medium">7</button>
        <button onClick={() => inputDigit(8)} className="bg-gray-700 hover:bg-gray-600 text-white h-10 rounded text-lg font-medium">8</button>
        <button onClick={() => inputDigit(9)} className="bg-gray-700 hover:bg-gray-600 text-white h-10 rounded text-lg font-medium">9</button>
        <button onClick={() => performOperation('*')} className="bg-orange-500 hover:bg-orange-400 text-white h-10 rounded text-xl font-medium">×</button>

        <button onClick={() => inputDigit(4)} className="bg-gray-700 hover:bg-gray-600 text-white h-10 rounded text-lg font-medium">4</button>
        <button onClick={() => inputDigit(5)} className="bg-gray-700 hover:bg-gray-600 text-white h-10 rounded text-lg font-medium">5</button>
        <button onClick={() => inputDigit(6)} className="bg-gray-700 hover:bg-gray-600 text-white h-10 rounded text-lg font-medium">6</button>
        <button onClick={() => performOperation('-')} className="bg-orange-500 hover:bg-orange-400 text-white h-10 rounded text-xl font-medium">-</button>

        <button onClick={() => inputDigit(1)} className="bg-gray-700 hover:bg-gray-600 text-white h-10 rounded text-lg font-medium">1</button>
        <button onClick={() => inputDigit(2)} className="bg-gray-700 hover:bg-gray-600 text-white h-10 rounded text-lg font-medium">2</button>
        <button onClick={() => inputDigit(3)} className="bg-gray-700 hover:bg-gray-600 text-white h-10 rounded text-lg font-medium">3</button>
        <button onClick={() => performOperation('+')} className="bg-orange-500 hover:bg-orange-400 text-white h-10 rounded text-xl font-medium">+</button>

        <button onClick={() => inputDigit(0)} className="col-span-2 bg-gray-700 hover:bg-gray-600 text-white h-10 rounded text-lg font-medium pl-4 text-left">0</button>
        <button onClick={inputDot} className="bg-gray-700 hover:bg-gray-600 text-white h-10 rounded text-xl font-medium">.</button>
        <button onClick={() => performOperation('=')} className="bg-orange-500 hover:bg-orange-400 text-white h-10 rounded text-xl font-medium">=</button>
      </div>
    </div>
  )
}
