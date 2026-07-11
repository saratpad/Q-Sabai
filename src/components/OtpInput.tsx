import { useRef, useEffect } from 'react'
import './OtpInput.css'

interface OtpInputProps {
  length?: number
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  autoFocus?: boolean
}

export default function OtpInput({
  length = 6,
  value,
  onChange,
  disabled = false,
  autoFocus = true,
}: OtpInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (autoFocus) {
      inputs.current[0]?.focus()
    }
  }, [autoFocus])

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '')
    
    // Handle paste of multiple digits
    if (raw.length > 1) {
      const newVal = (value.slice(0, index) + raw).slice(0, length)
      onChange(newVal)
      const nextIdx = Math.min(index + raw.length, length - 1)
      inputs.current[nextIdx]?.focus()
      return
    }

    const char = raw.slice(-1)
    
    // Pad the string to the expected length with spaces so index assignment works
    const padded = value.padEnd(length, ' ').split('')
    padded[index] = char || ' '
    const joined = padded.join('').trimEnd()
    
    onChange(joined)
    
    if (char && index < length - 1) {
      inputs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      const padded = value.padEnd(length, ' ').split('')
      if (padded[index] !== ' ') {
        padded[index] = ' '
        onChange(padded.join('').trimEnd())
      } else if (index > 0) {
        inputs.current[index - 1]?.focus()
        padded[index - 1] = ' '
        onChange(padded.join('').trimEnd())
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    onChange(pasted)
    const nextIdx = Math.min(pasted.length, length - 1)
    inputs.current[nextIdx]?.focus()
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select()
  }

  return (
    <div className="otp-input-container">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={el => { inputs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] === ' ' ? '' : (value[i] || '')}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={handleFocus}
          disabled={disabled}
          className={`otp-cell ${value[i] && value[i] !== ' ' ? 'filled' : ''} ${disabled ? 'disabled' : ''}`}
          aria-label={`OTP digit ${i + 1}`}
        />
      ))}
    </div>
  )
}
