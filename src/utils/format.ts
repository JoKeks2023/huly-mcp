import { markdownToProseMirror } from './markdown'
import { IssuePriority } from '@hcengineering/tracker'

export const PRIORITY_LABELS: Record<number, string> = {
  [IssuePriority.NoPriority]: 'No Priority',
  [IssuePriority.Urgent]: 'Urgent',
  [IssuePriority.High]: 'High',
  [IssuePriority.Medium]: 'Medium',
  [IssuePriority.Low]: 'Low'
}

export const MILESTONE_STATUS_LABELS: Record<number, string> = {
  0: 'Planned',
  1: 'In Progress',
  2: 'Completed',
  3: 'Canceled'
}

export function formatDate (ts: number | null | undefined): string {
  if (ts == null) return 'None'
  return new Date(ts).toISOString().split('T')[0]
}

export function priorityLabel (priority: number): string {
  return PRIORITY_LABELS[priority] ?? 'Unknown'
}

// Inline Markup fields (milestone/component description) hold ProseMirror JSON as a
// string. Older data or create_component may have stored plain text — accept both.
export function markupToText (markup: string | null | undefined): string {
  if (markup == null || markup === '') return ''
  if (!markup.trimStart().startsWith('{')) return markup
  try {
    return blockText(JSON.parse(markup)).trim()
  } catch {
    return markup
  }
}

export function textToMarkup (text: string | null): string {
  if (text == null || text === '') return ''
  return JSON.stringify(markdownToProseMirror(text))
}

// Inline nodes (text, marks) are concatenated; block nodes are separated by newlines.
const BLOCK_TYPES = new Set(['doc', 'paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'codeBlock', 'blockquote', 'table', 'tableRow', 'tableCell', 'tableHeader'])

function blockText (node: any): string {
  if (node == null || typeof node !== 'object') return ''
  if (node.type === 'text') return typeof node.text === 'string' ? node.text : ''
  if (node.type === 'hardBreak') return '\n'
  const children: any[] = Array.isArray(node.content) ? node.content : []
  const hasBlocks = children.some((c) => BLOCK_TYPES.has(c?.type))
  return children.map(blockText).join(hasBlocks ? '\n' : '')
}
