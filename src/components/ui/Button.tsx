import type { ButtonHTMLAttributes } from 'react'
import './ui.css'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ivory' | 'metal'
type ButtonSize = 'md' | 'sm'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({ variant = 'metal', size = 'md', className, type = 'button', children, ...rest }: ButtonProps) {
  const classes = ['ui-button', `ui-button--${variant}`, size === 'sm' && 'ui-button--sm', className]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  )
}
