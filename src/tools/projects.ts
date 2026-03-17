import tracker from '@hcengineering/tracker'
import core from '@hcengineering/core'
import task from '@hcengineering/task'
import { generateId, type Ref } from '@hcengineering/core'
import type { ProjectType } from '@hcengineering/task'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import type { z } from 'zod'
import type { GetProjectSchema, CreateProjectSchema } from '../schemas'

export const listProjects = wrapToolHandler<Record<string, never>>(async () => {
  const client = await getConnection()
  const projects = await client.findAll(tracker.class.Project, {})

  if (projects.length === 0) return 'No projects found in this workspace.'

  const lines = projects.map((p) =>
    `- **${p.identifier}** — ${p.name ?? '(no name)'}${p.description != null && p.description !== '' ? `\n  ${p.description}` : ''}`
  )
  return `## Projects (${projects.length})\n\n${lines.join('\n')}`
})

export const getProject = wrapToolHandler<z.infer<typeof GetProjectSchema>>(async (args) => {
  const client = await getConnection()
  const project = await client.findOne(tracker.class.Project, { identifier: args.identifier })
  if (project == null) throw new Error(`Project '${args.identifier}' not found.`)

  const statuses = await client.findAll(tracker.class.IssueStatus, {})
  const statusList = statuses.map((s) => `  - ${s.name}`).join('\n')

  return [
    `## Project: ${project.identifier}`,
    `**Name:** ${project.name ?? '(no name)'}`,
    project.description != null && project.description !== '' ? `**Description:** ${project.description}` : null,
    `**Issues created:** ${project.sequence}`,
    `\n**Statuses:**\n${statusList}`
  ].filter(Boolean).join('\n')
})

export const createProject = wrapToolHandler<z.infer<typeof CreateProjectSchema>>(async (args) => {
  const client = await getConnection()

  // Check identifier is unique
  const existing = await client.findOne(tracker.class.Project, { identifier: args.identifier })
  if (existing != null) throw new Error(`A project with identifier '${args.identifier}' already exists.`)

  // Find the classic project type (used by Huly Tracker)
  const projectType = await client.findOne(task.class.ProjectType, {
    _id: tracker.ids.ClassingProjectType as unknown as Ref<ProjectType>
  }) ?? await client.findOne(task.class.ProjectType, {})
  if (projectType == null) throw new Error('Could not find a ProjectType. Ensure the Huly Tracker is set up.')

  const projectId = generateId()

  await client.createDoc(
    tracker.class.Project,
    core.space.Space,
    {
      name: args.name,
      description: args.description ?? '',
      identifier: args.identifier,
      sequence: 0,
      defaultAssignee: undefined,
      defaultTimeReportDay: 'CurrentWorkDay' as any,
      defaultIssueStatus: undefined as any,
      type: projectType._id,
      members: [client.user],
      archived: false,
      private: false
    } as any,
    projectId
  )

  return `✅ Project **${args.identifier}** ("${args.name}") created successfully.\nNote: default statuses are set up automatically by the platform.`
})
