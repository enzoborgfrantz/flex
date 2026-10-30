import type { HTMLAttributes } from 'react'
import './ui.css'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'accent' | 'neutral'
}

export function Badge({ tone = 'accent', className, ...rest }: BadgeProps) {
  const classes = ['ui-badge', tone === 'neutral' && 'ui-badge--neutral', className].filter(Boolean).join(' ')
  return <span className={classes} {...rest} />
}
