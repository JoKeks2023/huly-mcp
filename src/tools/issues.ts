import tracker, { IssuePriority, type Issue, type Project } from '@hcengineering/tracker'
import tags from '@hcengineering/tags'
import task from '@hcengineering/task'
import core, { SortingOrder, generateId, type Ref, type Doc, type DocumentUpdate, type TxOperations } from '@hcengineering/core'
import type { Person } from '@hcengineering/contact'
import { makeRank } from '@hcengineering/rank'
import { getConnection, getWorkspaceInfo } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { priorityLabel, formatDate } from '../utils/format'
import { markdownToProseMirror, extractText } from '../utils/markdown'
import { uploadMarkupBlob } from '../utils/storage'
import { findPerson, peopleNames } from '../utils/people'
import type { z } from 'zod'
import type {
  ListIssuesSchema,
  GetIssueSchema,
  CreateIssueSchema,
  UpdateIssueSchema,
  DeleteIssueSchema,
  BulkUpdateIssuesSchema,
  MoveIssueSchema,
  ListSubIssuesSchema
} from '../schemas'

async function findMemberId (client: TxOperations, name: string): Promise<Ref<Person>> {
  return (await findPerson(client, name))._id
}

export const listIssues = wrapToolHandler<z.infer<typeof ListIssuesSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const project = await client.findOne(tracker.class.Project, { identifier: args.projectIdentifier })
  if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`)

  const query: Record<string, unknown> = { space: project._id }

  // Statuses are workspace-wide; resolve them once (filter and output).
  const statuses = await client.findAll(tracker.class.IssueStatus, {})
  const statusMap = new Map(statuses.map((s) => [s._id, s.name]))
  // Default: open issues only — in a mature project most issues are done, and listing them costs tokens.
  const scope = args.status ?? 'open'
  if (scope === 'open') {
    query.status = { $in: statuses.filter((s) => s.category !== task.statusCategory.Won && s.category !== task.statusCategory.Lost).map((s) => s._id) }
  } else if (scope !== 'all') {
    const status = statuses.find((s) => s.name.toLowerCase() === scope.toLowerCase())
    if (status == null) throw new Error(`Status '${scope}' not found. Use a status name, "open" or "all".`)
    query.status = status._id
  }

  if (args.priority != null) {
    query.priority = IssuePriority[args.priority as keyof typeof IssuePriority]
  }

  if (args.milestoneLabel !== undefined) {
    if (args.milestoneLabel === null) query.milestone = null
    else {
      const m = await client.findOne(tracker.class.Milestone, { space: project._id, label: args.milestoneLabel })
      if (m == null) throw new Error(`Milestone '${args.milestoneLabel}' not found in project ${args.projectIdentifier}.`)
      query.milestone = m._id
    }
  }

  if (args.componentLabel !== undefined) {
    if (args.componentLabel === null) query.component = null
    else {
      const c = await client.findOne(tracker.class.Component, { space: project._id, label: args.componentLabel })
      if (c == null) throw new Error(`Component '${args.componentLabel}' not found in project ${args.projectIdentifier}.`)
      query.component = c._id
    }
  }

  if (args.assignee !== undefined) {
    query.assignee = args.assignee === null ? null : await findMemberId(client, args.assignee)
  }

  if (args.parentIdentifier !== undefined) {
    if (args.parentIdentifier === null) query.attachedTo = tracker.ids.NoParent
    else {
      const parent = await client.findOne(tracker.class.Issue, { identifier: args.parentIdentifier })
      if (parent == null) throw new Error(`Issue '${args.parentIdentifier}' not found.`)
      query.attachedTo = parent._id
    }
  }

  if (args.labelName != null) {
    const label = await client.findOne(tags.class.TagElement, { targetClass: tracker.class.Issue, title: args.labelName })
    if (label == null) throw new Error(`Label '${args.labelName}' not found.`)
    const refs = await client.findAll(tags.class.TagReference, { tag: label._id })
    query._id = { $in: refs.map((r) => r.attachedTo) }
  }

  const offset = args.offset ?? 0
  const found = await client.findAll(
    tracker.class.Issue,
    query as any,
    { limit: args.limit + offset, sort: { modifiedOn: SortingOrder.Descending }, total: true }
  )
  const total: number = (found as any).total ?? found.length
  const issues = found.slice(offset)
  const what = scope === 'open' ? 'open issues' : scope === 'all' ? 'issues' : `issues in status ${scope}`
  if (issues.length === 0) return `No ${what} in project ${args.projectIdentifier}${offset > 0 ? ` after offset ${offset}` : ''}.${scope === 'open' ? ' (status: "all" includes done ones.)' : ''}`

  const lines = issues.map((issue) => {
    const statusName = statusMap.get(issue.status) ?? 'Unknown'
    // One line per issue; "No priority" is left out (list_issues is called often, every token counts).
    const prio = issue.priority !== IssuePriority.NoPriority ? ` · ${priorityLabel(issue.priority)}` : ''
    const due = issue.dueDate != null ? ` · due ${formatDate(issue.dueDate)}` : ''
    return `- **${issue.identifier}** ${issue.title} — ${statusName}${prio}${due}`
  })

  const shown = total > issues.length ? `${offset + 1}–${offset + issues.length} of ${total}` : String(total)
  const more = offset + issues.length < total ? `\n\n_More: offset ${offset + issues.length}._` : ''
  return `## ${what[0].toUpperCase()}${what.slice(1)} in ${args.projectIdentifier} (${shown})\n\n${lines.join('\n')}${more}`
})

export const getIssue = wrapToolHandler<z.infer<typeof GetIssueSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const issue = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`)

  const status = await client.findOne(tracker.class.IssueStatus, { _id: issue.status })
  const milestone = issue.milestone != null ? await client.findOne(tracker.class.Milestone, { _id: issue.milestone }) : undefined
  const component = issue.component != null ? await client.findOne(tracker.class.Component, { _id: issue.component }) : undefined
  const assignee = issue.assignee != null ? (await peopleNames(client)).get(issue.assignee as string) ?? String(issue.assignee) : 'Unassigned'
  const labelRefs = await client.findAll(tags.class.TagReference, { attachedTo: issue._id })
  const refIds = async (list: Array<{ _id: Ref<Doc>, _class?: string }> | undefined): Promise<string> => {
    if (list == null || list.length === 0) return 'None'
    const names: string[] = []
    for (const r of list) {
      if (r._class != null && r._class !== tracker.class.Issue) {
        // Related non-issue docs (e.g. a test case): "Test case "name" `id`".
        const doc: any = await client.findOne(r._class as any, { _id: r._id })
        const kind = String(r._class).split(':').pop()?.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase() ?? 'doc'
        names.push(`${kind} "${String(doc?.name ?? doc?.title ?? '?')}" \`${String(r._id)}\``)
        continue
      }
      const other = await client.findOne(tracker.class.Issue, { _id: r._id as Ref<Issue> })
      names.push(other?.identifier ?? String(r._id))
    }
    return names.join(', ')
  }

  const lines = [
    `## ${issue.identifier}: ${issue.title}`,
    `**Status:** ${status?.name ?? 'Unknown'}`,
    `**Priority:** ${priorityLabel(issue.priority)}`,
    `**Assignee:** ${assignee}`,
    `**Milestone:** ${milestone?.label ?? 'None'}`,
    `**Component:** ${component?.label ?? 'None'}`,
    `**Labels:** ${labelRefs.length > 0 ? labelRefs.map((l) => l.title).join(', ') : 'None'}`,
    `**Parent:** ${issue.parents?.[0] != null ? `${issue.parents[0].identifier} — ${issue.parents[0].parentTitle}` : 'None'}`,
    `**Blocked by:** ${await refIds(issue.blockedBy)}`,
    `**Related:** ${await refIds(issue.relations)}`,
    `**Due date:** ${formatDate(issue.dueDate)}`,
    `**Comments:** ${issue.comments ?? 0}`,
    `**Sub-issues:** ${issue.subIssues ?? 0}`,
    `**Estimation:** ${issue.estimation > 0 ? `${issue.estimation}h` : 'None'}`,
    `**Reported time:** ${issue.reportedTime > 0 ? `${issue.reportedTime}h` : 'None'}`
  ]

  if (issue.description != null) {
    const frontUrl = process.env.HULY_FRONT_URL
    if (frontUrl != null && frontUrl !== '') {
      const { wsToken, workspaceUuid } = await getWorkspaceInfo(args.workspace)
      // Token goes in the Authorization header only — never in the URL (see get_document).
      const blobUrl = `${frontUrl}/files?file=${encodeURIComponent(issue.description)}&workspace=${workspaceUuid}`
      try {
        const res = await fetch(blobUrl, { headers: { Authorization: `Bearer ${wsToken}` } })
        if (res.ok) {
          const text = await res.text()
          try {
            const extracted = extractText(JSON.parse(text))
            if (extracted.length > 0) lines.push(`\n**Description:**\n${extracted}`)
          } catch {
            lines.push(`\n**Description (raw):**\n${text.substring(0, 2000)}`)
          }
        }
      } catch {
        lines.push(`\n**Description:** _(fetch failed — blob ref \`${issue.description}\`)_`)
      }
    } else {
      lines.push(`\n**Description blob ref:** \`${issue.description}\``)
      lines.push('_(Set HULY_FRONT_URL env var to fetch description content)_')
    }
  }

  return lines.join('\n')
})

export const createIssue = wrapToolHandler<z.infer<typeof CreateIssueSchema>>(async (args) => {
  const client = await getConnection(args.workspace)

  // 1. Find project
  const project = await client.findOne(tracker.class.Project, { identifier: args.projectIdentifier })
  if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`)

  // 2. Increment sequence counter
  const incResult = await client.updateDoc(
    tracker.class.Project,
    project.space,
    project._id,
    { $inc: { sequence: 1 } } as any,
    true
  )
  const issueNumber: number = (incResult as any)?.object?.sequence ?? project.sequence + 1
  const identifier = `${project.identifier}-${issueNumber}`

  // 3. Resolve status
  const statuses = await client.findAll(tracker.class.IssueStatus, {})
  const status = args.statusName != null
    ? (statuses.find((s) => s.name === args.statusName) ?? statuses[0])
    : (project.defaultIssueStatus != null
        ? (statuses.find((s) => s._id === project.defaultIssueStatus) ?? statuses[0])
        : statuses[0])
  if (status == null) throw new Error(`No statuses found in project '${args.projectIdentifier}'.`)

  // 4. Find TaskType (kind field — required)
  const kind = await client.findOne(task.class.TaskType, project.type != null ? { parent: project.type } : {})
  if (kind == null) throw new Error('Could not find a TaskType for this project.')

  // 5. Compute rank (append after last issue)
  const lastIssue = await client.findOne(
    tracker.class.Issue,
    { space: project._id },
    { sort: { rank: SortingOrder.Descending } }
  )
  const rank = makeRank(lastIssue?.rank, undefined)

  // 6. Create via addCollection (issues are AttachedDoc)
  const issueId = generateId<Issue>()

  // Issue description is a MarkupBlobRef, same storage mechanism as document
  // content — upload it the same way if provided.
  let descriptionBlobId: string | null = null
  if (args.description != null && args.description !== '') {
    const { wsToken, workspaceUuid } = await getWorkspaceInfo(args.workspace)
    const prosemirror = markdownToProseMirror(args.description)
    descriptionBlobId = await uploadMarkupBlob(
      wsToken,
      workspaceUuid,
      `${issueId}-description-${Date.now()}`,
      JSON.stringify(prosemirror)
    )
  }

  await client.addCollection(
    tracker.class.Issue,
    project._id,
    tracker.ids.NoParent,
    tracker.class.Issue,
    'subIssues',
    {
      title: args.title,
      description: descriptionBlobId as any,
      status: status._id,
      priority: IssuePriority[args.priority as keyof typeof IssuePriority],
      number: issueNumber,
      identifier,
      rank,
      kind: kind._id,
      comments: 0,
      subIssues: 0,
      dueDate: args.dueDate != null ? new Date(args.dueDate).getTime() : null,
      assignee: null,
      component: null,
      milestone: null,
      parents: [],
      remainingTime: 0,
      estimation: 0,
      reportedTime: 0,
      reports: 0,
      childInfo: [],
      relations: []
    },
    issueId
  )

  return `✅ Created **${identifier}**: ${args.title}\nStatus: ${status.name} | Priority: ${priorityLabel(IssuePriority[args.priority as keyof typeof IssuePriority])}`
})

export const deleteIssue = wrapToolHandler<z.infer<typeof DeleteIssueSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const issue = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`)

  await client.removeCollection(
    tracker.class.Issue,
    issue.space,
    issue._id,
    issue.attachedTo,
    issue.attachedToClass,
    issue.collection
  )

  return `✅ Deleted **${args.identifier}**: ${issue.title}`
})


type FieldArgs = Pick<z.infer<typeof UpdateIssueSchema>, 'statusName' | 'priority' | 'dueDate' | 'assignee' | 'componentLabel' | 'milestoneLabel'>

/** Shared by update_issue and bulk_update_issues: turns name-based arguments into issue field updates. */
async function resolveFieldUpdates (client: TxOperations, issue: Issue, args: FieldArgs): Promise<DocumentUpdate<Issue>> {
  const updates: DocumentUpdate<Issue> = {}

  if (args.statusName != null) {
    const status = await client.findOne(tracker.class.IssueStatus, { name: args.statusName })
    if (status == null) throw new Error(`Status '${args.statusName}' not found.`)
    updates.status = status._id
  }

  if (args.priority != null) {
    updates.priority = IssuePriority[args.priority as keyof typeof IssuePriority]
  }

  if (args.dueDate !== undefined) {
    if (args.dueDate != null && isNaN(new Date(args.dueDate).getTime())) throw new Error(`Invalid date: '${args.dueDate}'`)
    updates.dueDate = args.dueDate != null ? new Date(args.dueDate).getTime() : null
  }

  if (args.assignee !== undefined) {
    if (args.assignee === null) {
      updates.assignee = null
    } else {
      updates.assignee = await findMemberId(client, args.assignee)
    }
  }

  if (args.componentLabel !== undefined) {
    if (args.componentLabel === null) {
      updates.component = null
    } else {
      const component = await client.findOne(tracker.class.Component, { space: issue.space, label: args.componentLabel })
      if (component == null) throw new Error(`Component '${args.componentLabel}' not found in this project.`)
      updates.component = component._id
    }
  }

  if (args.milestoneLabel !== undefined) {
    if (args.milestoneLabel === null) {
      updates.milestone = null
    } else {
      const milestone = await client.findOne(tracker.class.Milestone, { space: issue.space, label: args.milestoneLabel })
      if (milestone == null) throw new Error(`Milestone '${args.milestoneLabel}' not found in this project.`)
      updates.milestone = milestone._id
    }
  }

  return updates
}

export const updateIssue = wrapToolHandler<z.infer<typeof UpdateIssueSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const issue = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`)

  const updates: DocumentUpdate<Issue> = {}

  if (args.title != null) updates.title = args.title

  if (args.description != null && args.description !== '') {
    const { wsToken, workspaceUuid } = await getWorkspaceInfo(args.workspace)
    const prosemirror = markdownToProseMirror(args.description)
    const descriptionBlobId = await uploadMarkupBlob(
      wsToken,
      workspaceUuid,
      `${issue._id}-description-${Date.now()}`,
      JSON.stringify(prosemirror)
    )
    updates.description = descriptionBlobId as any
  }

  Object.assign(updates, await resolveFieldUpdates(client, issue, args))

  if (Object.keys(updates).length === 0) return `No changes made to ${args.identifier}.`

  await client.updateDoc(tracker.class.Issue, issue.space, issue._id, updates)

  const changed = Object.keys(updates).join(', ')
  return `✅ Updated **${args.identifier}** — changed: ${changed}`
})

export const bulkUpdateIssues = wrapToolHandler<z.infer<typeof BulkUpdateIssuesSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const identifiers = [...new Set(args.identifiers)]

  // Resolve every issue and every update first — nothing is written unless all inputs are valid.
  const planned: Array<{ issue: Issue, updates: DocumentUpdate<Issue> }> = []
  for (const identifier of identifiers) {
    const issue = await client.findOne(tracker.class.Issue, { identifier })
    if (issue == null) throw new Error(`Issue '${identifier}' not found. Nothing was changed.`)
    planned.push({ issue, updates: await resolveFieldUpdates(client, issue, args) })
  }
  if (planned.every((p) => Object.keys(p.updates).length === 0)) return 'No changes requested.'

  for (const { issue, updates } of planned) {
    await client.updateDoc(tracker.class.Issue, issue.space, issue._id, updates)
  }

  const changed = Object.keys(planned[0].updates).join(', ')
  return `✅ Updated ${planned.length} issue(s) — changed: ${changed}\n${planned.map((p) => `- ${p.issue.identifier}`).join('\n')}`
})

export const listSubIssues = wrapToolHandler<z.infer<typeof ListSubIssuesSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const root = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (root == null) throw new Error(`Issue '${args.identifier}' not found.`)

  const statuses = await client.findAll(tracker.class.IssueStatus, {})
  const statusById = new Map(statuses.map((s) => [s._id as string, s]))
  const isDone = (i: Issue): boolean => statusById.get(i.status as string)?.category === task.statusCategory.Won
  const isCanceled = (i: Issue): boolean => statusById.get(i.status as string)?.category === task.statusCategory.Lost

  // Children are found via attachedTo (how Huly links sub-issues) and, for issues linked by
  // older versions of set_parent, via the parents list.
  const projectIssues = await client.findAll(tracker.class.Issue, { space: root.space })
  const childrenOf = (id: string): Issue[] => projectIssues.filter((i) =>
    i._id !== id && ((i.attachedTo as string) === id || (i.parents?.[0]?.parentId as string | undefined) === id))

  let total = 0; let done = 0; let canceled = 0
  const lines: string[] = []
  const walk = (id: string, level: number): void => {
    for (const child of childrenOf(id)) {
      total++
      if (isDone(child)) done++
      if (isCanceled(child)) canceled++
      const statusName = statusById.get(child.status as string)?.name ?? 'Unknown'
      const mark = isDone(child) ? 'x' : (isCanceled(child) ? '-' : ' ')
      lines.push(`${'  '.repeat(level)}- [${mark}] **${child.identifier}** [${statusName}] ${child.title}`)
      if (level + 1 < args.depth) walk(child._id, level + 1)
    }
  }
  walk(root._id, 0)

  if (total === 0) return `**${root.identifier}** has no sub-issues.`
  return `## Sub-issues of ${root.identifier}: ${root.title}\n**Progress:** ${done}/${total - canceled} done${canceled > 0 ? ` (${canceled} canceled)` : ''}\n\n${lines.join('\n')}`
})

/**
 * Moves an issue (with its sub-issues, comments, attachments, labels and time reports) to
 * another project. Mirrors Huly's own moveIssueToSpace: every attached doc gets the new space,
 * every moved issue gets a new number in the target project. Component and milestone belong
 * to the old project and are cleared.
 */
export const moveIssue = wrapToolHandler<z.infer<typeof MoveIssueSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const issue = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`)
  const target = await client.findOne(tracker.class.Project, { identifier: args.targetProjectIdentifier })
  if (target == null) throw new Error(`Project '${args.targetProjectIdentifier}' not found.`)
  if (target._id === issue.space) throw new Error(`${args.identifier} is already in project ${args.targetProjectIdentifier}.`)

  let statusUpdate: DocumentUpdate<Issue> = {}
  if (args.statusName != null) {
    const status = await client.findOne(tracker.class.IssueStatus, { name: args.statusName })
    if (status == null) throw new Error(`Status '${args.statusName}' not found.`)
    statusUpdate = { status: status._id }
  }

  const hierarchy = client.getHierarchy()
  const renamed: string[] = []
  const lastRank = async (): Promise<string | undefined> =>
    (await client.findOne(tracker.class.Issue, { space: target._id }, { sort: { rank: SortingOrder.Descending } }))?.rank

  const nextNumber = async (): Promise<number> => {
    const inc = await client.updateDoc(tracker.class.Project, core.space.Space, target._id, { $inc: { sequence: 1 } } as any, true)
    return (inc as any)?.object?.sequence ?? (target as Project).sequence + 1
  }

  const moveDoc = async (doc: Doc, extra: DocumentUpdate<any>): Promise<void> => {
    for (const attribute of hierarchy.getAllAttributes(doc._class).values()) {
      if (!hierarchy.isDerived(attribute.type._class, core.class.Collection)) continue
      const of = (attribute.type as any).of
      const attached = await client.findAll(of, { attachedTo: doc._id })
      for (const child of attached) {
        if (hierarchy.isDerived(of, tracker.class.Issue)) {
          const number = await nextNumber()
          renamed.push(`${(child as any).identifier as string} → ${target.identifier}-${number}`)
          await moveDoc(child, { number, identifier: `${target.identifier}-${number}`, rank: makeRank(await lastRank(), undefined), component: null, milestone: null })
        } else {
          await moveDoc(child, {})
        }
      }
    }
    await client.update(doc, { space: target._id, ...extra })
  }

  const number = await nextNumber()
  const newIdentifier = `${target.identifier}-${number}`
  renamed.unshift(`${issue.identifier} → ${newIdentifier}`)
  await moveDoc(issue, { ...statusUpdate, number, identifier: newIdentifier, rank: makeRank(await lastRank(), undefined), component: null, milestone: null })

  return `✅ Moved to project **${target.identifier}** (component and milestone cleared):\n${renamed.map((r) => `- ${r}`).join('\n')}`
})
