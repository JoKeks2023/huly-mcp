import tracker, { MilestoneStatus } from '@hcengineering/tracker'
import { generateId } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { MILESTONE_STATUS_LABELS, formatDate } from '../utils/format'
import type { z } from 'zod'
import type { ListMilestonesSchema, CreateMilestoneSchema } from '../schemas'

export const listMilestones = wrapToolHandler<z.infer<typeof ListMilestonesSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const project = await client.findOne(tracker.class.Project, { identifier: args.projectIdentifier })
  if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`)

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
  const project = await client.findOne(tracker.class.Project, { identifier: args.projectIdentifier })
  if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`)

  const targetDate = new Date(args.targetDate).getTime()
  if (isNaN(targetDate)) throw new Error(`Invalid date: '${args.targetDate}'`)

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
