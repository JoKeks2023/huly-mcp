import tracker from '@hcengineering/tracker'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { priorityLabel, formatDate } from '../utils/format'
import type { z } from 'zod'
import type { SearchIssuesSchema, SearchAllSchema } from '../schemas'

export const searchIssues = wrapToolHandler<z.infer<typeof SearchIssuesSchema>>(async (args) => {
  const client = await getConnection(args.workspace)

  const result = await client.searchFulltext(
    { query: args.query, classes: [tracker.class.Issue] },
    { limit: args.limit }
  )

  if (result.docs.length === 0) return `No issues found for query: "${args.query}"`

  // Enrich each result with full issue data
  const enriched = await Promise.all(
    result.docs.map(async (r) => {
      const issue = await client.findOne(tracker.class.Issue, { _id: r.id as any })
      if (issue == null) return null
      const status = await client.findOne(tracker.class.IssueStatus, { _id: issue.status })
      return { issue, statusName: status?.name ?? 'Unknown' }
    })
  )

  const lines = enriched
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .map((e) => {
      const due = e.issue.dueDate != null ? ` | Due: ${formatDate(e.issue.dueDate)}` : ''
      return `- **${e.issue.identifier}** [${e.statusName}] [${priorityLabel(e.issue.priority)}]${due}\n  ${e.issue.title}`
    })

  return `## Search results for "${args.query}" (${lines.length})\n\n${lines.join('\n')}`
})

/** Friendly kinds for the workspace-wide search; anything else is passed through as a class id. */
export const SEARCH_KINDS: Record<string, string> = {
  issue: 'tracker:class:Issue',
  document: 'document:class:Document',
  message: 'chunter:class:ChatMessage',
  card: 'card:class:Card',
  file: 'drive:class:File',
  person: 'contact:class:Person',
  organization: 'contact:class:Organization',
  'test-case': 'testManagement:class:TestCase',
  attachment: 'attachment:class:Attachment'
}

const shortClass = (c: string): string => c.split(':').pop() ?? c

export const searchAll = wrapToolHandler<z.infer<typeof SearchAllSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const classes = args.kinds?.map((k) => SEARCH_KINDS[k] ?? k)
  const result = await client.searchFulltext({ query: args.query, ...(classes != null && classes.length > 0 ? { classes } : {}) }, { limit: args.limit })
  const docs: any[] = result.docs ?? []
  if (docs.length === 0) return `Nothing found for "${args.query}". (Needs Huly's fulltext indexer; very new changes may not be indexed yet.)`
  const lines = docs.map((r) => {
    const title = r.shortTitle != null && r.title != null && r.shortTitle !== r.title ? `${r.shortTitle as string}: ${r.title as string}` : (r.title ?? r.shortTitle ?? '(untitled)')
    const where = r.doc?.attachedTo != null ? ` · on \`${r.doc.attachedTo as string}\`` : ''
    const desc = r.description != null && r.description !== '' ? `\n  ${String(r.description).replace(/\s+/g, ' ').slice(0, 160)}` : ''
    return `- [${shortClass(r.doc?._class ?? '')}] **${String(title)}** — \`${String(r.id)}\`${where}${desc}`
  })
  return `## Search "${args.query}" (${docs.length}${result.total != null && result.total > docs.length ? ` of ${result.total as number}` : ''})\n\n${lines.join('\n')}`
})
