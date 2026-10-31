import { useId, type InputHTMLAttributes } from 'react'
import './ui.css'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function TextField({ label, id, className, ...rest }: TextFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId

  return (
    <div className={['ui-field', className].filter(Boolean).join(' ')}>
      {label && <label htmlFor={fieldId}>{label}</label>}
      <input id={fieldId} {...rest} />
    </div>
  )
}
