import { useState, type ReactNode } from 'react'
import { Card } from './Card'
import './ui.css'

interface CollapsibleProps {
  title: ReactNode
  defaultOpen?: boolean
  className?: string
  children: ReactNode
}

export function Collapsible({ title, defaultOpen = true, className, children }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card className={className}>
      <button
        type="button"
        className="ui-collapsible__header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <h2 className="ui-collapsible__title">{title}</h2>
        <span className="ui-collapsible__chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && <div className="ui-collapsible__body">{children}</div>}
    </Card>
  )
}
