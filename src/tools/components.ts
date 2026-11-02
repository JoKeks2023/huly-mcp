import tracker from '@hcengineering/tracker'
import contact from '@hcengineering/contact'
import { generateId, type Ref, type DocumentUpdate } from '@hcengineering/core'
import type { Employee } from '@hcengineering/contact'
import type { Component } from '@hcengineering/tracker'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { markupToText, textToMarkup } from '../utils/format'
import type { z } from 'zod'
import type { ListComponentsSchema, CreateComponentSchema, UpdateComponentSchema, DeleteComponentSchema } from '../schemas'

type Client = Awaited<ReturnType<typeof getConnection>>

async function findProject (client: Client, identifier: string): Promise<any> {
  const project = await client.findOne(tracker.class.Project, { identifier })
  if (project == null) throw new Error(`Project '${identifier}' not found.`)
  return project
}

async function findComponent (client: Client, project: any, label: string): Promise<Component> {
  const matches = await client.findAll(tracker.class.Component, { space: project._id, label })
  if (matches.length === 0) throw new Error(`Component '${label}' not found in project ${project.identifier as string}.`)
  if (matches.length > 1) throw new Error(`Component name '${label}' is ambiguous in project ${project.identifier as string} (${matches.length} matches).`)
  return matches[0]
}

async function findMemberRef (client: Client, name: string): Promise<Ref<Employee>> {
  const employees = await client.findAll(contact.class.Member, {})
  const match = employees.find((e) => ((e as any).name ?? '').toLowerCase().includes(name.toLowerCase()))
  if (match == null) throw new Error(`Member '${name}' not found.`)
  return match._id as unknown as Ref<Employee>
}

export const listComponents = wrapToolHandler<z.infer<typeof ListComponentsSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const project = await client.findOne(tracker.class.Project, { identifier: args.projectIdentifier })
  if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`)

  const components = await client.findAll(tracker.class.Component, { space: project._id })

  if (components.length === 0) return `No components found in project ${args.projectIdentifier}.`

  // Resolve lead names
  const leadIds = components.map((c) => c.lead).filter((id): id is Ref<Employee> => id != null)
  const leads = leadIds.length > 0
    ? await client.findAll(contact.class.Member, { _id: { $in: leadIds as any[] } as any })
    : []
  const leadMap = new Map(leads.map((l) => [l._id, (l as any).name ?? l._id]))

  const lines = components.map((c) => {
    const lead = c.lead != null ? ` — Lead: ${leadMap.get(c.lead as unknown as any) ?? c.lead}` : ''
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

  let leadRef: Ref<Employee> | null = null
  if (args.lead != null) {
    const employees = await client.findAll(contact.class.Member, {})
    const match = employees.find((e) => {
      const name: string = (e as any).name ?? ''
      return name.toLowerCase().includes(args.lead!.toLowerCase())
    })
    if (match == null) throw new Error(`Member '${args.lead}' not found.`)
    leadRef = match._id as unknown as Ref<Employee>
  }

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
