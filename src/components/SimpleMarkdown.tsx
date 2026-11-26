import type { ReactNode } from 'react'

// Renders only the subset of markdown the AI coach prompt is instructed to produce: "#"/"##"
// headings, "**bold**", "-" bullet lists, and plain paragraphs. Anything else (tables, links,
// code blocks) renders as plain text rather than pulling in a full markdown dependency for it.
function renderInline(text: string): ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return parts.map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : part))
}

export function SimpleMarkdown({ content }: { content: string }) {
  const blocks: ReactNode[] = []
  let listItems: string[] = []
  let key = 0

  const flushList = () => {
    if (listItems.length === 0) return
    blocks.push(
      <ul key={key++}>
        {listItems.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ul>,
    )
    listItems = []
  }

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (line === '') {
      flushList()
      continue
    }
    if (line.startsWith('## ')) {
      flushList()
      blocks.push(<h3 key={key++}>{renderInline(line.slice(3))}</h3>)
      continue
    }
    if (line.startsWith('# ')) {
      flushList()
      blocks.push(<h2 key={key++}>{renderInline(line.slice(2))}</h2>)
      continue
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push(line.slice(2))
      continue
    }
    flushList()
    blocks.push(<p key={key++}>{renderInline(line)}</p>)
  }
  flushList()

  return <div className="simple-markdown">{blocks}</div>
}
