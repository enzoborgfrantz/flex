import type { ButtonHTMLAttributes } from 'react'
import './ui.css'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ivory'
type ButtonSize = 'md' | 'sm'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({ variant = 'primary', size = 'md', className, type = 'button', children, ...rest }: ButtonProps) {
  const classes = ['ui-button', `ui-button--${variant}`, size === 'sm' && 'ui-button--sm', className]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} {...rest}>
      {variant === 'secondary' ? <span className="ui-button__label">{children}</span> : children}
    </button>
  )
}
