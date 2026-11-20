import { useEffect, useState, type InputHTMLAttributes } from 'react'

interface NumberFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number
  onChange: (value: number) => void
}

// Lets the field go empty while typing (so clearing "10" to type "7" doesn't
// keep snapping back to "0"), only falling back to min/0 once the field
// loses focus still empty.
export function NumberField({
  value,
  onChange,
  min,
  inputMode = 'decimal',
  onBlur,
  ...rest
}: NumberFieldProps) {
  const [text, setText] = useState(String(value))

  useEffect(() => {
    setText(String(value))
  }, [value])

  return (
    <input
      type="number"
      inputMode={inputMode}
      min={min}
      {...rest}
      value={text}
      onChange={(e) => {
        const next = e.target.value
        setText(next)
        if (next === '') return
        const parsed = Number(next)
        if (!Number.isNaN(parsed)) onChange(parsed)
      }}
      onBlur={(e) => {
        if (e.target.value === '') {
          const fallback = typeof min === 'number' ? min : 0
          setText(String(fallback))
          onChange(fallback)
        }
        onBlur?.(e)
      }}
    />
  )
}
