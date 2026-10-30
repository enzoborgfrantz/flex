import { useId, type SelectHTMLAttributes } from 'react'
import './ui.css'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: SelectOption[]
}

export function Select({ label, id, options, className, ...rest }: SelectProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <div className={['ui-field', className].filter(Boolean).join(' ')}>
      <label htmlFor={fieldId}>{label}</label>
      <select id={fieldId} {...rest}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
