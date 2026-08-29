// Minimal Markdown → Huly ProseMirror JSON converter.
// Extracted from tools/documents.ts so it can be shared with tools/issues.ts
// (issue descriptions use the exact same MarkupBlobRef storage mechanism as
// document content).

export interface PMNode {
  type: string
  attrs?: Record<string, any>
  content?: PMNode[]
  marks?: Array<{ type: string, attrs?: Record<string, any> }>
  text?: string
}

export function markdownToProseMirror (md: string): PMNode {
  const lines = md.split('\n')
  const nodes: PMNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      // Use Huly's native 'mermaid' node type so diagrams render properly
      const nodeType = lang === 'mermaid' ? 'mermaid' : 'codeBlock'
      nodes.push({
        type: nodeType,
        attrs: { language: lang !== '' ? lang : null },
        content: [{ type: 'text', text: codeLines.join('\n') }]
      })
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch != null) {
      nodes.push({
        type: 'heading',
        attrs: { level: headingMatch[1].length },
        content: parseInline(headingMatch[2])
      })
      i++
      continue
    }

    // Table (Markdown pipe table)
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableRows: string[][] = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
        const row = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
        // Skip separator rows like |---|---|
        if (!row.every((c) => /^[-:]+$/.test(c))) {
          tableRows.push(row)
        }
        i++
      }
      if (tableRows.length > 0) {
        nodes.push(buildTable(tableRows))
      }
      continue
    }

    // Bullet list
    if (/^(\s*[-*+])\s/.test(line)) {
      const items: PMNode[] = []
      while (i < lines.length && /^(\s*[-*+])\s/.test(lines[i])) {
        const text = lines[i].replace(/^\s*[-*+]\s/, '')
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: parseInline(text) }]
        })
        i++
      }
      nodes.push({ type: 'bulletList', content: items })
      continue
    }

    // Blank line → skip
    if (line.trim() === '') {
      i++
      continue
    }

    // Default paragraph
    nodes.push({ type: 'paragraph', content: parseInline(line) })
    i++
  }

  if (nodes.length === 0) {
    nodes.push({ type: 'paragraph', content: [] })
  }

  return { type: 'doc', content: nodes }
}

export function parseInline (text: string): PMNode[] {
  const nodes: PMNode[] = []
  // Handle **bold**, `code`, plain text
  const re = /\*\*(.+?)\*\*|`(.+?)`|([^`*]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m[1] != null) {
      nodes.push({ type: 'text', text: m[1], marks: [{ type: 'bold' }] })
    } else if (m[2] != null) {
      nodes.push({ type: 'text', text: m[2], marks: [{ type: 'code' }] })
    } else if (m[3] != null && m[3].length > 0) {
      nodes.push({ type: 'text', text: m[3] })
    }
  }
  return nodes.length > 0 ? nodes : [{ type: 'text', text }]
}

export function buildTable (rows: string[][]): PMNode {
  const [headerRow, ...bodyRows] = rows
  const tableRows: PMNode[] = []

  if (headerRow != null) {
    tableRows.push({
      type: 'tableRow',
      content: headerRow.map((cell) => ({
        type: 'tableHeader',
        content: [{ type: 'paragraph', content: parseInline(cell) }]
      }))
    })
  }

  for (const row of bodyRows) {
    tableRows.push({
      type: 'tableRow',
      content: row.map((cell) => ({
        type: 'tableCell',
        content: [{ type: 'paragraph', content: parseInline(cell) }]
      }))
    })
  }

  return { type: 'table', content: tableRows }
}

// Extract plain text from Huly's ProseMirror JSON markup (inverse-ish of
// markdownToProseMirror, used for get_document / get_issue content reads).
export function extractText (node: any): string {
  if (typeof node === 'string') return node
  if (node == null || typeof node !== 'object') return ''
  if (node.type === 'text' && typeof node.text === 'string') return node.text
  const children: any[] = node.content ?? node.children ?? []
  return children.map(extractText).join(node.type === 'paragraph' || node.type === 'heading' ? '\n' : '')
}
