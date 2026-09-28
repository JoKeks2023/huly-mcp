import tracker from '@hcengineering/tracker'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { priorityLabel, formatDate } from '../utils/format'
import type { z } from 'zod'
import type { SearchIssuesSchema } from '../schemas'

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
