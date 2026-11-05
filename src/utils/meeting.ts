// Meeting notes → action items, without an LLM round trip.
// An action item is: an open checkbox, a line starting with "TODO:"/"Action:"/"Aufgabe:", or a list
// item under a heading like "Action items", "Next steps", "To-dos", "Aufgaben", "Nächste Schritte".
// From each item: assignee (@mention or "@Name") and due date (ISO or DD.MM.YYYY) are taken out
// of the title.

export interface MeetingTask { title: string, description?: string, assignee?: string, dueDate?: string }
export interface MeetingPlan { tasks: MeetingTask[], skippedDone: number }

const ACTION_HEADING = /^(action items?|actions?|next steps?|to-?dos?|tasks?|follow-?ups?|aufgaben|nächste schritte|maßnahmen|offene punkte)\b/i
const PREFIX = /^(?:todo|to-do|to do|action(?: item)?|aufgabe|task)\s*[:–-]\s*/i
const CHECK = /^\s*\[( |x|X)\]\s+/
const DUE = /(?:\b(?:due|by|until|bis|fällig(?: am)?|deadline)\s*:?\s*)?\b(\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{4})\b/i
const AT_NAME = /(^|\s)@([\p{L}][\p{L}\p{M}'.\u00a0-]*)/u
const BLOCKS = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'todoList', 'todoItem', 'taskList', 'taskItem', 'codeBlock', 'blockquote'])

const kids = (node: any): any[] => Array.isArray(node?.content) ? node.content : []

/** Text with mentions kept as "@Name" (extractText drops them: they have no text children). */
function textOf (node: any): string {
  if (node == null || typeof node !== 'object') return ''
  if (node.type === 'text') return typeof node.text === 'string' ? node.text : ''
  if (node.type === 'hardBreak') return '\n'
  if (node.type === 'reference' || node.type === 'mention') {
    const label = String(node.attrs?.label ?? '').trim()
    return label !== '' ? `@${label.replace(/\s+/g, ' ')}` : ''
  }
  const cs = kids(node)
  return cs.map(textOf).join(cs.some((c) => BLOCKS.has(c?.type)) ? '\n' : '')
}

function isoDate (raw: string): string | undefined {
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(raw)
  const iso = de != null ? `${de[3]}-${de[2].padStart(2, '0')}-${de[1].padStart(2, '0')}` : raw
  const t = Date.parse(`${iso}T00:00:00Z`)
  return Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== iso ? undefined : iso
}

/** "Action: @Ann send slides bis 10.11.2026" → { title: 'send slides', assignee: 'Ann', dueDate: '2026-11-10' } */
export function parseActionLine (line: string, description?: string): MeetingTask | undefined {
  let title = line.replace(CHECK, '').replace(PREFIX, '')
  let assignee: string | undefined
  const at = AT_NAME.exec(title)
  if (at != null) {
    assignee = at[2].replace(/ /g, ' ').replace(/[.'-]+$/, '')
    title = title.slice(0, at.index) + at[1] + title.slice(at.index + at[0].length)
  }
  let dueDate: string | undefined
  const due = DUE.exec(title)
  if (due != null) {
    dueDate = isoDate(due[1])
    if (dueDate != null) title = title.slice(0, due.index) + title.slice(due.index + due[0].length)
  }
  title = title.replace(/\(\s*\)/g, '').replace(/\s+/g, ' ').replace(/^[\s:;,–—-]+|[\s:;,–—-]+$/g, '').trim()
  if (title === '') return undefined
  return { title, description, assignee, dueDate }
}

export function actionsFromMarkup (root: any): MeetingPlan {
  const tasks: MeetingTask[] = []
  let skippedDone = 0
  const add = (t: MeetingTask | undefined): void => { if (t != null && !tasks.some((x) => x.title.toLowerCase() === t.title.toLowerCase())) tasks.push(t) }
  const nested = (rest: any[]): string | undefined => {
    const s = rest.map(textOf).join('\n').trim()
    return s !== '' ? s : undefined
  }

  const walk = (node: any, inActions: boolean): void => {
    const type = String(node?.type ?? '')
    if (type === 'todoItem' || type === 'taskItem') {
      const [first, ...rest] = kids(node)
      if (node.attrs?.checked === true) skippedDone++
      else add(parseActionLine(textOf(first ?? node), nested(rest)))
      return
    }
    if (type === 'listItem') {
      const [first, ...rest] = kids(node)
      const line = textOf(first ?? node).trim()
      const check = CHECK.exec(line)
      if (check != null) {
        if (check[1] !== ' ') skippedDone++
        else add(parseActionLine(line, nested(rest)))
        return
      }
      if (inActions || PREFIX.test(line)) { add(parseActionLine(line, nested(rest))); return }
    }
    if (type === 'paragraph') {
      const line = textOf(node).trim()
      if (PREFIX.test(line)) add(parseActionLine(line))
      return
    }
    for (const c of kids(node)) walk(c, inActions)
  }

  // Track "Action items" sections on the top level: they end at the next heading of the same or a higher level.
  let actionLevel: number | undefined
  for (const block of kids(root)) {
    if (block?.type === 'heading') {
      const level = Number(block.attrs?.level ?? 1)
      if (actionLevel != null && level <= actionLevel) actionLevel = undefined
      if (ACTION_HEADING.test(textOf(block).replace(/^[^\p{L}]+/u, '').trim())) actionLevel = level
      continue
    }
    walk(block, actionLevel != null)
  }
  return { tasks, skippedDone }
}
