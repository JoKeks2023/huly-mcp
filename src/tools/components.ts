import tracker from '@hcengineering/tracker'
import contact from '@hcengineering/contact'
import { generateId, type Ref } from '@hcengineering/core'
import type { Employee } from '@hcengineering/contact'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import type { z } from 'zod'
import type { ListComponentsSchema, CreateComponentSchema } from '../schemas'

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
    const desc = c.description != null && c.description !== '' ? `\n  ${c.description}` : ''
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
