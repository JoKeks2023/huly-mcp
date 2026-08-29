import tracker, { type IssueStatus } from '@hcengineering/tracker'
import task from '@hcengineering/task'
import core, { generateId } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import type { z } from 'zod'
import type { ListIssueStatusesSchema, CreateIssueStatusSchema } from '../schemas'

// Issue statuses are stored globally (not per-project) — a status created
// here immediately becomes selectable in every tracker project. See
// tracker:attribute:IssueStatus and task:statusCategory:* for the model.
const CATEGORY_MAP: Record<string, { ref: any, label: string }> = {
  Backlog: { ref: task.statusCategory.UnStarted, label: 'Backlog' },
  Todo: { ref: task.statusCategory.ToDo, label: 'Todo' },
  InProgress: { ref: task.statusCategory.Active, label: 'In Progress' },
  Done: { ref: task.statusCategory.Won, label: 'Done' },
  Cancelled: { ref: task.statusCategory.Lost, label: 'Cancelled' }
}

export const listIssueStatuses = wrapToolHandler<z.infer<typeof ListIssueStatusesSchema>>(async () => {
  const client = await getConnection()
  const statuses = await client.findAll(tracker.class.IssueStatus, {})
  if (statuses.length === 0) return 'No issue statuses found.'

  const byCategory = new Map<string, typeof statuses>()
  for (const s of statuses) {
    const key = String(s.category ?? 'Unknown')
    if (!byCategory.has(key)) byCategory.set(key, [] as any)
    byCategory.get(key)!.push(s)
  }

  const lines: string[] = []
  for (const [category, group] of byCategory) {
    const shortCategory = category.split(':').pop() ?? category
    lines.push(`**${shortCategory}:**`)
    for (const s of group) lines.push(`  - ${s.name} (id: \`${s._id}\`)`)
  }

  return `## Issue Statuses (${statuses.length})\n\n${lines.join('\n')}`
})

export const createIssueStatus = wrapToolHandler<z.infer<typeof CreateIssueStatusSchema>>(async (args) => {
  const client = await getConnection()

  const existing = await client.findOne(tracker.class.IssueStatus, { name: args.name })
  if (existing != null) return `ℹ️ Status **"${args.name}"** already exists (id: \`${existing._id}\`).`

  const mapped = CATEGORY_MAP[args.category]
  if (mapped == null) throw new Error(`Unknown category '${args.category}'.`)

  const statusId = generateId<IssueStatus>()
  await client.createDoc(
    tracker.class.IssueStatus,
    core.space.Model,
    {
      ofAttribute: tracker.attribute.IssueStatus,
      category: mapped.ref,
      name: args.name,
      color: args.color != null ? parseInt(args.color.replace('#', ''), 16) : undefined
    } as any,
    statusId
  )

  return `✅ Status **"${args.name}"** created in the **${mapped.label}** phase (id: \`${statusId}\`) — available in every project immediately.`
})
