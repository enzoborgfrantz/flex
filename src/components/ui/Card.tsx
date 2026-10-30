import type { HTMLAttributes } from 'react'
import './ui.css'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
}

export function Card({ interactive, className, ...rest }: CardProps) {
  const classes = ['ui-card', interactive && 'ui-card--interactive', className].filter(Boolean).join(' ')
  return <div className={classes} {...rest} />
}
