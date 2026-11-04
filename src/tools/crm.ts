// CRM (lead plugin): funnels (spaces), customers (Customer mixin on a person or organization)
// and leads (tasks LEAD-n attached to the customer, living in a funnel).
import { generateId, SortingOrder } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { formatDate } from '../utils/format'
import { findPerson, peopleNames } from '../utils/people'
import { nextNumber, workflowOf, pickStatus, statusName, findContact, findNamed, contactName } from '../utils/tasks'
import type { z } from 'zod'
import type * as S from '../schemas'

export const L = {
  Funnel: 'lead:class:Funnel',
  Lead: 'lead:class:Lead',
  Customer: 'lead:mixin:Customer',
  DefaultFunnel: 'lead:space:DefaultFunnel',
  Contacts: 'contact:space:Contacts'
} as const

async function findFunnel (client: any, ref?: string): Promise<any> {
  if (ref != null) return await findNamed(client, L.Funnel, ref, 'Funnel')
  const funnels: any[] = await client.findAll(L.Funnel, { archived: false })
  if (funnels.length === 0) throw new Error('No funnel in this workspace — is the CRM module enabled?')
  return funnels.find((f) => f._id === L.DefaultFunnel) ?? funnels[0]
}

async function findLead (client: any, identifier: string): Promise<any> {
  const lead = await client.findOne(L.Lead, { identifier: identifier.trim().toUpperCase() })
  if (lead == null) throw new Error(`Lead '${identifier}' not found (ids look like LEAD-12).`)
  return lead
}

export const listLeads = wrapToolHandler<z.infer<typeof S.ListLeadsSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const funnels: any[] = args.funnel != null ? [await findFunnel(client, args.funnel)] : await client.findAll(L.Funnel, {})
  const leads: any[] = await client.findAll(L.Lead, { space: { $in: funnels.map((f) => f._id) } }, { sort: { modifiedOn: SortingOrder.Descending }, limit: args.limit ?? 50 })
  const head = `## Leads (${leads.length}) — funnel(s): ${funnels.map((f) => f.name).join(', ') || 'none'}`
  if (leads.length === 0) return `${head}\n\nNo leads.`
  const names = await peopleNames(client)
  const customers: any[] = await client.findAll('contact:class:Contact', { _id: { $in: [...new Set(leads.map((l) => l.attachedTo))] } })
  const wfs = new Map<string, any>()
  for (const f of funnels) wfs.set(f._id, await workflowOf(client, f).catch(() => undefined))
  const rows = leads.map((l) => ({ l, status: wfs.get(l.space) != null ? statusName(wfs.get(l.space), l.status) : '?' }))
    .filter((r) => args.status == null || r.status.toLowerCase() === args.status.toLowerCase())
  const lines = rows.map(({ l, status }) => `- **${String(l.identifier)}** ${String(l.title)} — ${contactName(customers.find((c) => c._id === l.attachedTo))} [${status}]${l.assignee != null ? ` · ${names.get(l.assignee) ?? '?'}` : ''} · ${formatDate(l.modifiedOn)}`)
  return `${head}\n\n${lines.join('\n') || '_(none with that status)_'}`
})

export const listCustomers = wrapToolHandler<z.infer<typeof S.ListCustomersSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const customers: any[] = await client.findAll(L.Customer, {})
  if (customers.length === 0) return 'No customers.'
  const lines = customers.map((c) => `- **${contactName(c)}** (${c._class === 'contact:class:Organization' ? 'organization' : 'person'}) · ${Number(c[L.Customer]?.leads ?? 0)} lead(s) — \`${String(c._id)}\``)
  return `## Customers (${customers.length})\n\n${lines.join('\n')}`
})

export const createLead = wrapToolHandler<z.infer<typeof S.CreateLeadSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const funnel = await findFunnel(client, args.funnel)
  const wf = await workflowOf(client, funnel)
  const status = pickStatus(wf, args.status)
  const assignee = args.assignee != null ? (await findPerson(client, args.assignee))._id : null
  let customer: any
  let created = ''
  if (args.newCustomer != null) {
    const cls = args.newCustomer === 'organization' ? 'contact:class:Organization' : 'contact:class:Person'
    const name = args.newCustomer === 'organization' ? args.customer.trim() : (() => { const [first, ...rest] = args.customer.trim().split(/\s+/); return `${rest.join(' ')},${first}` })()
    const dup: any[] = await client.findAll(cls, { name })
    if (dup.length > 0) throw new Error(`'${args.customer}' already exists — leave out newCustomer to use it.`)
    const id = generateId()
    await client.createDoc(cls, L.Contacts, { name, city: '', avatarType: 'color', ...(cls === 'contact:class:Organization' ? { description: null } : {}) }, id)
    customer = { _id: id, _class: cls, space: L.Contacts, name }
    created = ` (new ${args.newCustomer})`
  } else customer = await findContact(client, args.customer)
  if (customer[L.Customer] == null) await client.createMixin(customer._id, customer._class, customer.space, L.Customer, { customerDescription: null })
  const number = await nextNumber(client, L.Lead)
  const identifier = `LEAD-${number}`
  await client.addCollection(L.Lead, funnel._id, customer._id, L.Customer, 'leads', {
    status, number, identifier, title: args.title.trim(), kind: wf.kind, rank: '', assignee, startDate: null, dueDate: null
  })
  return `✅ **${identifier}** ${args.title} — ${contactName(customer)}${created} [${statusName(wf, status)}] in ${String(funnel.name)}`
})

export const updateLead = wrapToolHandler<z.infer<typeof S.UpdateLeadSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const lead = await findLead(client, args.identifier)
  const update: Record<string, unknown> = {}
  const done: string[] = []
  if (args.title != null) { update.title = args.title.trim(); done.push('title') }
  if (args.status != null) {
    const wf = await workflowOf(client, await client.findOne(L.Funnel, { _id: lead.space }))
    update.status = pickStatus(wf, args.status)
    done.push(`status → ${statusName(wf, update.status as string)}`)
  }
  if (args.assignee !== undefined) {
    update.assignee = args.assignee != null ? (await findPerson(client, args.assignee))._id : null
    done.push(args.assignee != null ? `assignee → ${args.assignee}` : 'unassigned')
  }
  if (Object.keys(update).length === 0) throw new Error('Nothing to change.')
  await client.updateDoc(L.Lead, lead.space, lead._id, update)
  return `✅ **${String(lead.identifier)}**: ${done.join(', ')}.`
})

export const deleteLead = wrapToolHandler<z.infer<typeof S.DeleteLeadSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const lead = await findLead(client, args.identifier)
  await client.removeCollection(L.Lead, lead.space, lead._id, lead.attachedTo, lead.attachedToClass, lead.collection ?? 'leads')
  return `🗑️ Lead **${String(lead.identifier)}** deleted.`
})
