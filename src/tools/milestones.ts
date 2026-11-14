import { findByLabel } from '../utils/labels'
import tracker, { MilestoneStatus, type Milestone } from '@hcengineering/tracker'
import task from '@hcengineering/task'
import { generateId, type Ref, type DocumentUpdate } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { MILESTONE_STATUS_LABELS, formatDate, markupToText, textToMarkup } from '../utils/format'
import type { z } from 'zod'
import type {
  ListMilestonesSchema,
  CreateMilestoneSchema,
  GetMilestoneSchema,
  UpdateMilestoneSchema,
  DeleteMilestoneSchema
} from '../schemas'

type Client = Awaited<ReturnType<typeof getConnection>>

async function findProject (client: Client, identifier: string): Promise<any> {
  const project = await client.findOne(tracker.class.Project, { identifier })
  if (project == null) throw new Error(`Project '${identifier}' not found.`)
  return project
}

async function findMilestone (client: Client, project: any, label: string): Promise<Milestone> {
  return await findByLabel(client, 'milestone', project._id, label, project.identifier)
}

function parseDate (value: string): number {
  const ts = new Date(value).getTime()
  if (isNaN(ts)) throw new Error(`Invalid date: '${value}'`)
  return ts
}

export const listMilestones = wrapToolHandler<z.infer<typeof ListMilestonesSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const project = await findProject(client, args.projectIdentifier)

  const milestones = await client.findAll(tracker.class.Milestone, { space: project._id })

  if (milestones.length === 0) return `No milestones found in project ${args.projectIdentifier}.`

  const lines = milestones.map((m) => {
    const status = MILESTONE_STATUS_LABELS[m.status as number] ?? 'Unknown'
    const target = formatDate(m.targetDate)
    return `- **${m.label}** [${status}] — Target: ${target}`
  })

  return `## Milestones in ${args.projectIdentifier} (${milestones.length})\n\n${lines.join('\n')}`
})

const MILESTONE_STATUS_MAP: Record<string, MilestoneStatus> = {
  Planned: MilestoneStatus.Planned,
  InProgress: MilestoneStatus.InProgress,
  Completed: MilestoneStatus.Completed,
  Canceled: MilestoneStatus.Canceled
}

export const createMilestone = wrapToolHandler<z.infer<typeof CreateMilestoneSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const project = await findProject(client, args.projectIdentifier)

  const targetDate = parseDate(args.targetDate)
  const status = MILESTONE_STATUS_MAP[args.status] ?? MilestoneStatus.Planned

  await client.createDoc(
    tracker.class.Milestone,
    project._id,
    {
      label: args.label,
      targetDate,
      status,
      comments: 0
    },
    generateId()
  )

  return `Milestone **${args.label}** created in project ${args.projectIdentifier} with target date ${args.targetDate}.`
})

export const getMilestone = wrapToolHandler<z.infer<typeof GetMilestoneSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const project = await findProject(client, args.projectIdentifier)
  const milestone = await findMilestone(client, project, args.label)

  const issues = await client.findAll(tracker.class.Issue, { space: project._id, milestone: milestone._id })
  const statuses = await client.findAll(tracker.class.IssueStatus, {})
  const categoryById = new Map(statuses.map((s) => [s._id as string, (s as any).category as string | undefined]))

  const isDone = (cat: string | undefined): boolean => cat === task.statusCategory.Won
  const isCanceled = (cat: string | undefined): boolean => cat === task.statusCategory.Lost
  const done = issues.filter((i) => isDone(categoryById.get(i.status as string))).length
  const canceled = issues.filter((i) => isCanceled(categoryById.get(i.status as string))).length
  const open = issues.length - done - canceled

  const status = MILESTONE_STATUS_LABELS[milestone.status as number] ?? 'Unknown'
  const description = markupToText(milestone.description)
  const openIssues = issues
    .filter((i) => { const c = categoryById.get(i.status as string); return !isDone(c) && !isCanceled(c) })
    .map((i) => `- ${i.identifier}: ${i.title}`)

  return [
    `## Milestone ${milestone.label} (${args.projectIdentifier})`,
    '',
    `**Status:** ${status}`,
    `**Target date:** ${formatDate(milestone.targetDate)}`,
    `**Progress:** ${done}/${issues.length - canceled} done (${open} open, ${canceled} canceled)`,
    description !== '' ? `\n**Description:**\n${description}` : '',
    openIssues.length > 0 ? `\n**Open issues:**\n${openIssues.join('\n')}` : ''
  ].filter((l) => l !== '').join('\n')
})

export const updateMilestone = wrapToolHandler<z.infer<typeof UpdateMilestoneSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const project = await findProject(client, args.projectIdentifier)
  const milestone = await findMilestone(client, project, args.label)

  const updates: DocumentUpdate<Milestone> = {}
  if (args.newLabel !== undefined && args.newLabel !== milestone.label) {
    const clash = await client.findOne(tracker.class.Milestone, { space: project._id, label: args.newLabel })
    if (clash != null) throw new Error(`A milestone named '${args.newLabel}' already exists in project ${args.projectIdentifier}.`)
    updates.label = args.newLabel
  }
  if (args.targetDate !== undefined) updates.targetDate = parseDate(args.targetDate)
  if (args.status !== undefined) updates.status = MILESTONE_STATUS_MAP[args.status]
  if (args.description !== undefined) updates.description = textToMarkup(args.description)

  if (Object.keys(updates).length === 0) return `Nothing to update for milestone **${milestone.label}**.`

  await client.updateDoc(tracker.class.Milestone, project._id, milestone._id, updates)

  const changed = Object.keys(updates).map((k) => (k === 'label' ? 'name' : k)).join(', ')
  return `✅ Milestone **${updates.label ?? milestone.label}** updated (${changed}).`
})

export const deleteMilestone = wrapToolHandler<z.infer<typeof DeleteMilestoneSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const project = await findProject(client, args.projectIdentifier)
  const milestone = await findMilestone(client, project, args.label)

  let target: Ref<Milestone> | null = null
  if (args.moveIssuesTo !== undefined) {
    const dest = await findMilestone(client, project, args.moveIssuesTo)
    if (dest._id === milestone._id) throw new Error('moveIssuesTo must name a different milestone.')
    target = dest._id
  }

  // Detach issues first, so no issue is left pointing at a deleted milestone.
  const issues = await client.findAll(tracker.class.Issue, { space: project._id, milestone: milestone._id })
  for (const issue of issues) {
    await client.updateDoc(tracker.class.Issue, issue.space, issue._id, { milestone: target })
  }

  await client.removeDoc(tracker.class.Milestone, project._id, milestone._id)

  const effect = issues.length === 0
    ? 'No issues were assigned to it.'
    : target != null
      ? `${issues.length} issue(s) moved to **${args.moveIssuesTo as string}**.`
      : `${issues.length} issue(s) no longer have a milestone.`
  return `🗑️ Milestone **${milestone.label}** deleted from ${args.projectIdentifier}. ${effect}`
})
