import tracker, { IssuePriority, type Issue } from '@hcengineering/tracker'
import task from '@hcengineering/task'
import contact from '@hcengineering/contact'
import { SortingOrder, generateId, type Ref, type DocumentUpdate } from '@hcengineering/core'
import type { Person } from '@hcengineering/contact'
import { makeRank } from '@hcengineering/rank'
import { getConnection, getWorkspaceInfo } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { priorityLabel, formatDate } from '../utils/format'
import { markdownToProseMirror, extractText } from '../utils/markdown'
import { uploadMarkupBlob } from '../utils/storage'
import type { z } from 'zod'
import type {
  ListIssuesSchema,
  GetIssueSchema,
  CreateIssueSchema,
  UpdateIssueSchema,
  DeleteIssueSchema
} from '../schemas'

export const listIssues = wrapToolHandler<z.infer<typeof ListIssuesSchema>>(async (args) => {
  const client = await getConnection()
  const project = await client.findOne(tracker.class.Project, { identifier: args.projectIdentifier })
  if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`)

  const query: Record<string, unknown> = { space: project._id }

  if (args.status != null) {
    const status = await client.findOne(tracker.class.IssueStatus, { name: args.status })
    if (status == null) throw new Error(`Status '${args.status}' not found in project '${args.projectIdentifier}'.`)
    query.status = status._id
  }

  if (args.priority != null) {
    query.priority = IssuePriority[args.priority as keyof typeof IssuePriority]
  }

  const issues = await client.findAll(
    tracker.class.Issue,
    query as any,
    { limit: args.limit, sort: { modifiedOn: SortingOrder.Descending } }
  )

  if (issues.length === 0) return `No issues found in project ${args.projectIdentifier}.`

  // Resolve all statuses in one call
  const statuses = await client.findAll(tracker.class.IssueStatus, {})
  const statusMap = new Map(statuses.map((s) => [s._id, s.name]))

  const lines = issues.map((issue) => {
    const statusName = statusMap.get(issue.status) ?? 'Unknown'
    const due = issue.dueDate != null ? ` | Due: ${formatDate(issue.dueDate)}` : ''
    return `- **${issue.identifier}** [${statusName}] [${priorityLabel(issue.priority)}]${due}\n  ${issue.title}`
  })

  return `## Issues in ${args.projectIdentifier} (${issues.length})\n\n${lines.join('\n')}`
})

export const getIssue = wrapToolHandler<z.infer<typeof GetIssueSchema>>(async (args) => {
  const client = await getConnection()
  const issue = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`)

  const status = await client.findOne(tracker.class.IssueStatus, { _id: issue.status })

  const lines = [
    `## ${issue.identifier}: ${issue.title}`,
    `**Status:** ${status?.name ?? 'Unknown'}`,
    `**Priority:** ${priorityLabel(issue.priority)}`,
    `**Due date:** ${formatDate(issue.dueDate)}`,
    `**Comments:** ${issue.comments ?? 0}`,
    `**Sub-issues:** ${issue.subIssues ?? 0}`,
    `**Estimation:** ${issue.estimation > 0 ? `${issue.estimation}h` : 'None'}`,
    `**Reported time:** ${issue.reportedTime > 0 ? `${issue.reportedTime}h` : 'None'}`
  ]

  if (issue.description != null) {
    const frontUrl = process.env.HULY_FRONT_URL
    if (frontUrl != null && frontUrl !== '') {
      const { wsToken, workspaceUuid } = await getWorkspaceInfo()
      const blobUrl = `${frontUrl}/files?file=${encodeURIComponent(issue.description)}&workspace=${workspaceUuid}&token=${wsToken}`
      try {
        const res = await fetch(blobUrl)
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
  const client = await getConnection()

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
    const { wsToken, workspaceUuid } = await getWorkspaceInfo()
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
  const client = await getConnection()
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

export const updateIssue = wrapToolHandler<z.infer<typeof UpdateIssueSchema>>(async (args) => {
  const client = await getConnection()
  const issue = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`)

  const updates: DocumentUpdate<Issue> = {}

  if (args.title != null) updates.title = args.title

  if (args.description != null && args.description !== '') {
    const { wsToken, workspaceUuid } = await getWorkspaceInfo()
    const prosemirror = markdownToProseMirror(args.description)
    const descriptionBlobId = await uploadMarkupBlob(
      wsToken,
      workspaceUuid,
      `${issue._id}-description-${Date.now()}`,
      JSON.stringify(prosemirror)
    )
    updates.description = descriptionBlobId as any
  }

  if (args.statusName != null) {
    const status = await client.findOne(tracker.class.IssueStatus, { name: args.statusName })
    if (status == null) throw new Error(`Status '${args.statusName}' not found.`)
    updates.status = status._id
  }

  if (args.priority != null) {
    updates.priority = IssuePriority[args.priority as keyof typeof IssuePriority]
  }

  if (args.dueDate !== undefined) {
    updates.dueDate = args.dueDate != null ? new Date(args.dueDate).getTime() : null
  }

  if (args.assignee !== undefined) {
    if (args.assignee === null) {
      updates.assignee = null
    } else {
      const employees = await client.findAll(contact.class.Member, {})
      const match = employees.find((e) => {
        const name: string = (e as any).name ?? ''
        return name.toLowerCase().includes(args.assignee!.toLowerCase())
      })
      if (match == null) throw new Error(`Member '${args.assignee}' not found.`)
      updates.assignee = match._id as unknown as Ref<Person>
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

  if (Object.keys(updates).length === 0) return `No changes made to ${args.identifier}.`

  await client.updateDoc(tracker.class.Issue, issue.space, issue._id, updates)

  const changed = Object.keys(updates).join(', ')
  return `✅ Updated **${args.identifier}** — changed: ${changed}`
})
