import tracker, { type IssueStatus } from '@hcengineering/tracker'
import task from '@hcengineering/task'
import core, { generateId } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import type { z } from 'zod'
import type { ListIssueStatusesSchema, CreateIssueStatusSchema } from '../schemas'

// Issue statuses are workspace-wide documents; which ones an issue may have is decided per
// project type and task type (see utils/statuses.ts). task:statusCategory:* are the phases.
const CATEGORY_MAP: Record<string, { ref: any, label: string }> = {
  Backlog: { ref: task.statusCategory.UnStarted, label: 'Backlog' },
  Todo: { ref: task.statusCategory.ToDo, label: 'Todo' },
  InProgress: { ref: task.statusCategory.Active, label: 'In Progress' },
  Done: { ref: task.statusCategory.Won, label: 'Done' },
  Cancelled: { ref: task.statusCategory.Lost, label: 'Cancelled' }
}

export const listIssueStatuses = wrapToolHandler<z.infer<typeof ListIssueStatusesSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
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
  const client: any = await getConnection(args.workspace)

  // A status is only usable for issues when the project type lists it for its Issue task type
  // (Huly's settings write both TaskType.statuses and ProjectType.statuses). A status of the same
  // name that exists for another task type (e.g. "Merged" for pull requests) is reused.
  let types: any[]
  if (args.projectIdentifier != null) {
    const project = await client.findOne(tracker.class.Project, { identifier: args.projectIdentifier })
    if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`)
    types = await client.findAll(task.class.ProjectType, { _id: project.type })
  } else {
    types = (await client.findAll(task.class.ProjectType, {})).filter((t: any) => String(t.descriptor ?? '').startsWith('tracker:') || String(t._id).startsWith('tracker:') || (t.statuses ?? []).some((s: any) => String(s._id).startsWith('tracker:status:')))
  }
  if (types.length === 0) throw new Error('No tracker project type found.')

  const mapped = CATEGORY_MAP[args.category]
  if (mapped == null) throw new Error(`Unknown category '${args.category}'.`)
  let status: any = (await client.findAll(tracker.class.IssueStatus, {})).find((s: any) => String(s.name).toLowerCase() === args.name.trim().toLowerCase())
  const created = status == null
  if (status == null) {
    const statusId = generateId<IssueStatus>()
    await client.createDoc(tracker.class.IssueStatus, core.space.Model, {
      ofAttribute: tracker.attribute.IssueStatus,
      category: mapped.ref,
      name: args.name.trim(),
      color: args.color != null ? parseInt(args.color.replace('#', ''), 16) : undefined
    } as any, statusId)
    status = { _id: statusId, name: args.name.trim() }
  }

  const added: string[] = []
  for (const type of types) {
    const issueTypes: any[] = (await client.findAll(task.class.TaskType, { parent: type._id })).filter((t: any) => t.ofClass === tracker.class.Issue)
    for (const tt of issueTypes) {
      if ((tt.statuses ?? []).includes(status._id)) continue
      await client.updateDoc(task.class.TaskType, tt.space, tt._id, { $push: { statuses: status._id } } as any)
      if (!(type.statuses ?? []).some((e: any) => e._id === status._id && e.taskType === tt._id)) {
        await client.updateDoc(task.class.ProjectType, type.space, type._id, { $push: { statuses: { _id: status._id, taskType: tt._id } } } as any)
      }
      added.push(String(type.name ?? type._id))
    }
  }
  const what = created ? `created in the **${mapped.label}** phase` : 'already existed'
  return added.length > 0
    ? `✅ Status **"${String(status.name)}"** ${what}; now usable for issues in: ${[...new Set(added)].join(', ')}.`
    : `ℹ️ Status **"${String(status.name)}"** ${what} and is already usable for issues there.`
})
