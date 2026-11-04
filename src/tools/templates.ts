// Issue templates (tracker:class:IssueTemplate): reusable issues with sub-issues.
// Like Huly's CreateIssueTemplate dialog; "issue from template" copies the template into
// a new issue plus one sub-issue per child, as Huly's CreateIssue + SubIssues do.
import tracker, { IssuePriority } from '@hcengineering/tracker'
import tags from '@hcengineering/tags'
import { generateId } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { markupToText, priorityLabel, textToMarkup } from '../utils/format'
import { findPerson, peopleNames } from '../utils/people'
import { createIssue, updateIssue } from './issues'
import { addLabel } from './labels'
import { createIssueTree } from './agent'
import type { z } from 'zod'
import type { ListIssueTemplatesSchema, GetIssueTemplateSchema, CreateIssueTemplateSchema, UpdateIssueTemplateSchema, DeleteIssueTemplateSchema, CreateIssueFromTemplateSchema } from '../schemas'

const PRIORITY: Record<string, number> = { NoPriority: IssuePriority.NoPriority, Urgent: IssuePriority.Urgent, High: IssuePriority.High, Medium: IssuePriority.Medium, Low: IssuePriority.Low }
const PRIORITY_NAME: Record<number, 'NoPriority' | 'Urgent' | 'High' | 'Medium' | 'Low'> = Object.fromEntries(Object.entries(PRIORITY).map(([k, v]) => [v, k])) as any

async function findProject (client: any, identifier: string): Promise<any> {
  const project = await client.findOne(tracker.class.Project, { identifier })
  if (project == null) throw new Error(`Project '${identifier}' not found.`)
  return project
}

async function byLabel (client: any, _class: string, project: any, label: string | null | undefined, what: string): Promise<string | null> {
  if (label == null) return null
  const all: any[] = await client.findAll(_class, { space: project._id })
  const hit = all.find((x) => String(x.label).toLowerCase() === label.toLowerCase())
  if (hit == null) throw new Error(`${what} '${label}' not found in ${String(project.identifier)}. Available: ${all.map((x) => x.label).join(', ') || 'none'}.`)
  return hit._id
}

async function labelIds (client: any, names: string[] | undefined): Promise<string[]> {
  const out: string[] = []
  for (const name of names ?? []) {
    const tag = await client.findOne(tags.class.TagElement, { targetClass: tracker.class.Issue, title: name })
    if (tag == null) throw new Error(`Label '${name}' not found (create it first with create_label).`)
    out.push(tag._id)
  }
  return out
}

async function findTemplate (client: any, ref: string, projectIdentifier?: string): Promise<any> {
  const byId = await client.findOne(tracker.class.IssueTemplate, { _id: ref })
  if (byId != null) return byId
  const query: Record<string, unknown> = {}
  if (projectIdentifier != null) query.space = (await findProject(client, projectIdentifier))._id
  const all: any[] = await client.findAll(tracker.class.IssueTemplate, query)
  const hits = all.filter((t) => String(t.title).toLowerCase() === ref.toLowerCase())
  if (hits.length === 1) return hits[0]
  if (hits.length > 1) throw new Error(`Template '${ref}' exists in several projects — pass projectIdentifier.`)
  throw new Error(`Template '${ref}' not found.`)
}

interface TemplateInput { title: string, description?: string, priority?: string, assignee?: string | null, componentLabel?: string | null, milestoneLabel?: string | null, estimation?: number, labels?: string[] }

async function templateData (client: any, project: any, t: TemplateInput): Promise<Record<string, unknown>> {
  return {
    title: t.title.trim(),
    description: textToMarkup(t.description ?? ''),
    priority: PRIORITY[t.priority ?? 'NoPriority'],
    assignee: t.assignee != null ? (await findPerson(client, t.assignee))._id : null,
    component: await byLabel(client, tracker.class.Component, project, t.componentLabel, 'Component'),
    milestone: await byLabel(client, tracker.class.Milestone, project, t.milestoneLabel, 'Milestone'),
    estimation: t.estimation ?? 0,
    labels: await labelIds(client, t.labels)
  }
}

/** Names for display/creation: assignee, component, milestone and labels of a template (or child). */
async function names (client: any, t: any, people: Map<string, string>): Promise<{ assignee?: string, component?: string, milestone?: string, labels: string[] }> {
  const component = t.component != null ? (await client.findOne(tracker.class.Component, { _id: t.component }))?.label : undefined
  const milestone = t.milestone != null ? (await client.findOne(tracker.class.Milestone, { _id: t.milestone }))?.label : undefined
  const labels: any[] = (t.labels ?? []).length > 0 ? await client.findAll(tags.class.TagElement, { _id: { $in: t.labels } }) : []
  return { assignee: t.assignee != null ? people.get(t.assignee) : undefined, component, milestone, labels: labels.map((l) => l.title) }
}

function describe (t: any, n: { assignee?: string, component?: string, milestone?: string, labels: string[] }): string {
  const bits = [priorityLabel(t.priority)]
  if (n.assignee != null) bits.push(`@${n.assignee}`)
  if (n.component != null) bits.push(`component ${n.component}`)
  if (n.milestone != null) bits.push(`milestone ${n.milestone}`)
  if ((t.estimation ?? 0) > 0) bits.push(`${String(t.estimation)}d`)
  if (n.labels.length > 0) bits.push(`labels ${n.labels.join(', ')}`)
  return bits.join(' · ')
}

export const listIssueTemplates = wrapToolHandler<z.infer<typeof ListIssueTemplatesSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const query: Record<string, unknown> = {}
  if (args.projectIdentifier != null) query.space = (await findProject(client, args.projectIdentifier))._id
  const templates: any[] = await client.findAll(tracker.class.IssueTemplate, query)
  if (templates.length === 0) return 'No issue templates.'
  const projects: any[] = await client.findAll(tracker.class.Project, {})
  const key = new Map(projects.map((p) => [p._id, p.identifier]))
  return `## Issue templates (${templates.length})\n\n${templates.map((t) => `- **${String(t.title)}** [${String(key.get(t.space) ?? '?')}]${(t.children ?? []).length > 0 ? ` · ${String(t.children.length)} sub-issue(s)` : ''} — \`${String(t._id)}\``).join('\n')}`
})

export const getIssueTemplate = wrapToolHandler<z.infer<typeof GetIssueTemplateSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const t = await findTemplate(client, args.template, args.projectIdentifier)
  const people = await peopleNames(client)
  const lines = [`## Template: ${String(t.title)}`, '', describe(t, await names(client, t, people)), `**Id:** \`${String(t._id)}\``]
  const desc = markupToText(t.description)
  if (desc !== '') lines.push('', '### Description', desc)
  if ((t.children ?? []).length > 0) {
    lines.push('', `### Sub-issues (${String(t.children.length)})`)
    for (const c of t.children) lines.push(`- **${String(c.title)}** — ${describe(c, await names(client, c, people))}`)
  }
  return lines.join('\n')
})

export const createIssueTemplate = wrapToolHandler<z.infer<typeof CreateIssueTemplateSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const project = await findProject(client, args.projectIdentifier)
  const existing = await client.findOne(tracker.class.IssueTemplate, { space: project._id, title: args.title.trim() })
  if (existing != null) return `ℹ️ Template **${args.title}** already exists in ${args.projectIdentifier} — \`${String(existing._id)}\`.`
  const data = await templateData(client, project, args)
  const children = []
  for (const c of args.children ?? []) children.push({ id: generateId(), ...(await templateData(client, project, c)) })
  const id = await client.createDoc(tracker.class.IssueTemplate, project._id, { ...data, children, comments: 0, attachments: 0, relations: [] })
  return `✅ Template **${args.title}** created in ${args.projectIdentifier}${children.length > 0 ? ` with ${children.length} sub-issue(s)` : ''} — \`${String(id)}\`.`
})

export const updateIssueTemplate = wrapToolHandler<z.infer<typeof UpdateIssueTemplateSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const t = await findTemplate(client, args.template, args.projectIdentifier)
  const project = await client.findOne(tracker.class.Project, { _id: t.space })
  const update: Record<string, unknown> = {}
  if (args.title != null) update.title = args.title.trim()
  if (args.description != null) update.description = textToMarkup(args.description)
  if (args.priority != null) update.priority = PRIORITY[args.priority]
  if (args.assignee !== undefined) update.assignee = args.assignee != null ? (await findPerson(client, args.assignee))._id : null
  if (args.componentLabel !== undefined) update.component = await byLabel(client, tracker.class.Component, project, args.componentLabel, 'Component')
  if (args.milestoneLabel !== undefined) update.milestone = await byLabel(client, tracker.class.Milestone, project, args.milestoneLabel, 'Milestone')
  if (args.estimation != null) update.estimation = args.estimation
  if (args.labels != null) update.labels = await labelIds(client, args.labels)
  if (args.children != null) {
    const children = []
    for (const c of args.children) children.push({ id: generateId(), ...(await templateData(client, project, c)) })
    update.children = children
  }
  if (Object.keys(update).length === 0) throw new Error('Nothing to change.')
  await client.updateDoc(tracker.class.IssueTemplate, t.space, t._id, update)
  return `✅ Template **${String(update.title ?? t.title)}** updated: ${Object.keys(update).join(', ')}.`
})

export const deleteIssueTemplate = wrapToolHandler<z.infer<typeof DeleteIssueTemplateSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const t = await findTemplate(client, args.template, args.projectIdentifier)
  await client.removeDoc(tracker.class.IssueTemplate, t.space, t._id)
  return `✅ Template **${String(t.title)}** deleted.`
})

const text = (r: { content: Array<{ text: string }> }): string => r.content[0].text

export const createIssueFromTemplate = wrapToolHandler<z.infer<typeof CreateIssueFromTemplateSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const t = await findTemplate(client, args.template, args.projectIdentifier)
  const project = await client.findOne(tracker.class.Project, { _id: t.space })
  const people = await peopleNames(client)
  const top = await names(client, t, people)
  const title = args.title ?? String(t.title)
  const description = markupToText(t.description)
  const ws = args.workspace
  let id: string
  let childIds: string[] = []
  if ((t.children ?? []).length > 0) {
    const kids = []
    for (const c of t.children) {
      const n = await names(client, c, people)
      kids.push({ title: String(c.title), description: markupToText(c.description) || undefined, priority: PRIORITY_NAME[c.priority], assignee: n.assignee, componentLabel: n.component, milestoneLabel: n.milestone, labels: n.labels })
    }
    const out = text(await createIssueTree({ workspace: ws, projectIdentifier: project.identifier, epic: { title, description: description || undefined, priority: PRIORITY_NAME[t.priority], labels: top.labels }, children: kids, skipDuplicates: false, dryRun: false } as any))
    const m = /under \*\*([A-Z][A-Z0-9]*-\d+)\*\*/.exec(out)
    if (m == null) throw new Error(`Unexpected result while creating the issue tree: ${out}`)
    id = m[1]
    childIds = [...out.matchAll(/^- ([A-Z][A-Z0-9]*-\d+):/gm)].map((x) => x[1])
  } else {
    const out = text(await createIssue({ workspace: ws, projectIdentifier: project.identifier, title, description: description || undefined, priority: PRIORITY_NAME[t.priority] ?? 'NoPriority' } as any))
    const m = /\*\*([A-Z][A-Z0-9]*-\d+)\*\*/.exec(out)
    if (m == null) throw new Error(`Unexpected result while creating the issue: ${out}`)
    id = m[1]
    for (const l of top.labels) await addLabel({ workspace: ws, identifier: id, labelName: l })
  }
  const fields: Record<string, unknown> = {}
  if (top.assignee != null) fields.assignee = top.assignee
  if (top.component != null) fields.componentLabel = top.component
  if (top.milestone != null) fields.milestoneLabel = top.milestone
  if (Object.keys(fields).length > 0) await updateIssue({ workspace: ws, identifier: id, ...fields } as any)
  // Estimation (man-days in templates, hours on issues in Huly 0.7 — both store the same number).
  const estimates: Array<[string, number]> = [[id, t.estimation ?? 0], ...childIds.map((cid, i): [string, number] => [cid, t.children[i]?.estimation ?? 0])]
  for (const [iid, est] of estimates) {
    if (est <= 0) continue
    const issue = await client.findOne(tracker.class.Issue, { identifier: iid })
    if (issue != null) await client.updateDoc(tracker.class.Issue, issue.space, issue._id, { estimation: est })
  }
  return `✅ Created **${id}** "${title}" from template "${String(t.title)}"${(t.children ?? []).length > 0 ? ` with ${String(t.children.length)} sub-issue(s)` : ''}.`
})
