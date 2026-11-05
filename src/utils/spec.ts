// Spec → issues: turn a document's structure into planned issues without an LLM round trip.
// Open checklist items become issues; without a checklist, the sections (lowest heading level
// that occurs more than once, else level 2/1) become issues with their text as description.
import { extractText } from './markdown'

export interface SpecTask { title: string, description?: string }
export interface SpecPlan { source: 'checklist' | 'headings' | 'none', tasks: SpecTask[], skippedDone: number }

const CHECK = /^\s*\[( |x|X)\]\s+/

function childrenOf (node: any): any[] {
  return Array.isArray(node?.content) ? node.content : []
}

/** Open checklist items: Huly todo/task nodes, or "[ ] text" list items from Markdown imports. */
function checklist (root: any): { open: SpecTask[], done: number } {
  const open: SpecTask[] = []
  let done = 0
  const walk = (node: any): void => {
    const type = String(node?.type ?? '')
    if (type === 'todoItem' || type === 'taskItem') {
      const [first, ...rest] = childrenOf(node)
      const title = extractText(first ?? node).trim()
      const nested = rest.map(extractText).join('\n').trim()
      if (node.attrs?.checked === true) done++
      else if (title !== '') open.push({ title, description: nested !== '' ? nested : undefined })
      return
    }
    if (type === 'listItem') {
      const [first, ...rest] = childrenOf(node)
      const text = extractText(first ?? node).trim()
      const m = CHECK.exec(text)
      if (m != null) {
        const nested = rest.map(extractText).join('\n').trim()
        if (m[1] !== ' ') done++
        else open.push({ title: text.replace(CHECK, '').trim(), description: nested !== '' ? nested : undefined })
        return
      }
    }
    for (const c of childrenOf(node)) walk(c)
  }
  walk(root)
  return { open, done }
}

function headings (root: any): SpecTask[] {
  const blocks = childrenOf(root)
  const levels = blocks.filter((b) => b?.type === 'heading').map((b) => Number(b.attrs?.level ?? 1))
  if (levels.length === 0) return []
  const count = (l: number): number => levels.filter((x) => x === l).length
  // Sections are the most common heading level among 2/3; a single H1 is usually the title.
  const level = [2, 3, 1].find((l) => count(l) > 1) ?? [2, 3, 1].find((l) => count(l) > 0) ?? levels[0]
  const tasks: SpecTask[] = []
  let current: { title: string, body: string[] } | undefined
  const flush = (): void => {
    if (current == null) return
    const body = current.body.join('\n').trim()
    tasks.push({ title: current.title, description: body !== '' ? body.slice(0, 2000) : undefined })
  }
  for (const b of blocks) {
    if (b?.type === 'heading') {
      const l = Number(b.attrs?.level ?? 1)
      if (l === level) { flush(); current = { title: extractText(b).trim(), body: [] }; continue }
      if (l < level) { flush(); current = undefined; continue }
    }
    if (current != null) current.body.push(extractText(b))
  }
  flush()
  return tasks.filter((t) => t.title !== '')
}

export function planFromMarkup (root: any): SpecPlan {
  const list = checklist(root)
  if (list.open.length > 0 || list.done > 0) return { source: 'checklist', tasks: list.open, skippedDone: list.done }
  const secs = headings(root)
  return { source: secs.length > 0 ? 'headings' : 'none', tasks: secs, skippedDone: 0 }
}
