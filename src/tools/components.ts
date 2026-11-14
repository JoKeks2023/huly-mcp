import { findByLabel } from '../utils/labels'
import tracker from '@hcengineering/tracker'
import { generateId, type Ref, type DocumentUpdate } from '@hcengineering/core'
import type { Employee } from '@hcengineering/contact'
import type { Component } from '@hcengineering/tracker'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { markupToText, textToMarkup } from '../utils/format'
import { findPerson, peopleNames } from '../utils/people'
import type { z } from 'zod'
import type { ListComponentsSchema, CreateComponentSchema, UpdateComponentSchema, DeleteComponentSchema } from '../schemas'

type Client = Awaited<ReturnType<typeof getConnection>>

async function findProject (client: Client, identifier: string): Promise<any> {
  const project = await client.findOne(tracker.class.Project, { identifier })
  if (project == null) throw new Error(`Project '${identifier}' not found.`)
  return project
}

async function findComponent (client: Client, project: any, label: string): Promise<Component> {
  return await findByLabel(client, 'component', project._id, label, project.identifier)
}

async function findMemberRef (client: Client, name: string): Promise<Ref<Employee>> {
  return (await findPerson(client, name))._id as unknown as Ref<Employee>
}

export const listComponents = wrapToolHandler<z.infer<typeof ListComponentsSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const project = await client.findOne(tracker.class.Project, { identifier: args.projectIdentifier })
  if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`)

  const components = await client.findAll(tracker.class.Component, { space: project._id })

  if (components.length === 0) return `No components found in project ${args.projectIdentifier}.`

  // Resolve lead names
  const leadMap = await peopleNames(client)

  const lines = components.map((c) => {
    const lead = c.lead != null ? ` — Lead: ${leadMap.get(c.lead as unknown as string) ?? c.lead}` : ''
    const text = markupToText(c.description)
    const desc = text !== '' ? `\n  ${text}` : ''
    return `- **${c.label}** (id: \`${c._id}\`)${lead}${desc}`
  })

  return `## Components in ${args.projectIdentifier} (${components.length})\n\n${lines.join('\n')}`
})

export const createComponent = wrapToolHandler<z.infer<typeof CreateComponentSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const project = await client.findOne(tracker.class.Project, { identifier: args.projectIdentifier })
  if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`)

  const leadRef: Ref<Employee> | null = args.lead != null ? await findMemberRef(client, args.lead) : null

  await client.createDoc(
    tracker.class.Component,
    project._id,
    {
      label: args.label,
      description: args.description,
      lead: leadRef,
      comments: 0
    },
    generateId()
  )

  return `Component **${args.label}** created in project ${args.projectIdentifier}.`
})

export const updateComponent = wrapToolHandler<z.infer<typeof UpdateComponentSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const project = await findProject(client, args.projectIdentifier)
  const component = await findComponent(client, project, args.label)

  const updates: DocumentUpdate<Component> = {}
  if (args.newLabel !== undefined && args.newLabel !== component.label) {
    const clash = await client.findOne(tracker.class.Component, { space: project._id, label: args.newLabel })
    if (clash != null) throw new Error(`A component named '${args.newLabel}' already exists in project ${args.projectIdentifier}.`)
    updates.label = args.newLabel
  }
  if (args.description !== undefined) updates.description = textToMarkup(args.description)
  if (args.lead !== undefined) updates.lead = args.lead === null ? null : await findMemberRef(client, args.lead)

  if (Object.keys(updates).length === 0) return `Nothing to update for component **${component.label}**.`

  await client.updateDoc(tracker.class.Component, project._id, component._id, updates)

  const changed = Object.keys(updates).map((k) => (k === 'label' ? 'name' : k)).join(', ')
  return `✅ Component **${updates.label ?? component.label}** updated (${changed}).`
})

export const deleteComponent = wrapToolHandler<z.infer<typeof DeleteComponentSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const project = await findProject(client, args.projectIdentifier)
  const component = await findComponent(client, project, args.label)

  let target: Ref<Component> | null = null
  if (args.moveIssuesTo !== undefined) {
    const dest = await findComponent(client, project, args.moveIssuesTo)
    if (dest._id === component._id) throw new Error('moveIssuesTo must name a different component.')
    target = dest._id
  }

  // Detach issues first, so no issue is left pointing at a deleted component.
  const issues = await client.findAll(tracker.class.Issue, { space: project._id, component: component._id })
  for (const issue of issues) {
    await client.updateDoc(tracker.class.Issue, issue.space, issue._id, { component: target })
  }

  await client.removeDoc(tracker.class.Component, project._id, component._id)

  const effect = issues.length === 0
    ? 'No issues were assigned to it.'
    : target != null
      ? `${issues.length} issue(s) moved to **${args.moveIssuesTo as string}**.`
      : `${issues.length} issue(s) no longer have a component.`
  return `🗑️ Component **${component.label}** deleted from ${args.projectIdentifier}. ${effect}`
})
