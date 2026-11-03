// Agent workflow: one call per step of "pick up → work → hand back" instead of five to ten
// single-purpose calls. Built on the single tools, so their rules (ranks, parent bookkeeping,
// status lookup) apply unchanged.
import tracker, { type Issue } from '@hcengineering/tracker'
import { SortingOrder } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { formatDate, priorityLabel } from '../utils/format'
import { currentPerson, peopleNames, socialIdNames } from '../utils/people'
import { readMarkup } from '../utils/content'
import { C, IDS } from '../utils/classes'
import { createIssue, updateIssue, listSubIssues } from './issues'
import { addComment, listComments } from './comments'
import { setParent, addBlockedBy } from './relations'
import { addLabel, removeLabel } from './labels'
import type { z } from 'zod'
import type { GetIssueContextSchema, StartWorkSchema, FinishWorkSchema, CreateIssueTreeSchema, ChangesSinceSchema, ClaimIssueSchema, ReleaseIssueSchema } from '../schemas'

const text = (r: { content: Array<{ text: string }> }): string => r.content[0]?.text ?? ''
const PR_STATE = ['open', 'closed', 'merged']
export const CLAIM_LABEL = 'agent:working'
const CLAIM_RE = /\[huly-(claim|release) agent=(\S+?)(?: until=(\S+?))?\]/

async function findIssue (client: any, identifier: string): Promise<Issue> {
  const issue = await client.findOne(tracker.class.Issue, { identifier })
  if (issue == null) throw new Error(`Issue '${identifier}' not found.`)
  return issue
}

async function findStatus (client: any, name: string): Promise<any> {
  const statuses: any[] = await client.findAll(tracker.class.IssueStatus, {})
  const status = statuses.find((s) => s.name.toLowerCase() === name.toLowerCase())
  if (status == null) throw new Error(`Status '${name}' not found. Available: ${[...new Set(statuses.map((s) => s.name))].join(', ')}.`)
  return status
}

export function branchName (identifier: string, title: string): string {
  const slug = title.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').split('-').slice(0, 6).join('-')
  return `${identifier.toLowerCase()}${slug !== '' ? '-' + slug : ''}`
}

/** Full working context of an issue as one Markdown block. */
export async function issueContext (workspace: string | undefined, identifier: string, commentLimit = 20): Promise<string> {
  const client: any = await getConnection(workspace)
  const issue: any = await findIssue(client, identifier)
  const [status, milestone, component, labels, names] = await Promise.all([
    client.findOne(tracker.class.IssueStatus, { _id: issue.status }),
    issue.milestone != null ? client.findOne(tracker.class.Milestone, { _id: issue.milestone }) : undefined,
    issue.component != null ? client.findOne(tracker.class.Component, { _id: issue.component }) : undefined,
    client.findAll('tags:class:TagReference', { attachedTo: issue._id }),
    peopleNames(client)
  ])
  const refs = async (list: any[] | undefined): Promise<string[]> => {
    const out: string[] = []
    for (const r of list ?? []) {
      const other: any = await client.findOne(r._class ?? tracker.class.Issue, { _id: r._id })
      if (other == null) continue
      out.push(other.identifier != null ? `${other.identifier as string}: ${other.title as string}` : `${String(other.title ?? other.name ?? r._id)} (${String(r._class).split(':').pop() ?? ''} \`${String(r._id)}\`)`)
    }
    return out
  }
  const blockedBy = await refs(issue.blockedBy)
  const related = await refs(issue.relations)
  // Reverse lookup ("which issues does this one block?"); the server cannot query inside blockedBy[].
  const sameProject: any[] = await client.findAll(tracker.class.Issue, { space: issue.space }, { projection: { identifier: 1, title: 1, blockedBy: 1 } })
  const blocking = sameProject.filter((i) => (i.blockedBy ?? []).some((b: any) => b._id === issue._id))

  const lines = [
    `## ${issue.identifier as string}: ${issue.title as string}`,
    `**Status:** ${status?.name ?? '?'} · **Priority:** ${priorityLabel(issue.priority)} · **Assignee:** ${issue.assignee != null ? names.get(issue.assignee) ?? 'unknown' : 'unassigned'}`,
    `**Component:** ${component?.label ?? '—'} · **Milestone:** ${milestone?.label ?? '—'} · **Due:** ${formatDate(issue.dueDate)}`,
    `**Labels:** ${labels.length > 0 ? labels.map((l: any) => l.title).join(', ') : '—'}`,
    `**Parent chain:** ${(issue.parents ?? []).length > 0 ? [...issue.parents].reverse().map((p: any) => `${p.identifier as string} ${p.parentTitle as string}`).join(' › ') : '—'}`,
    `**Suggested branch:** \`${branchName(issue.identifier, issue.title)}\``
  ]
  if (blockedBy.length > 0) lines.push(`**Blocked by:** ${blockedBy.join('; ')}`)
  if (blocking.length > 0) lines.push(`**Blocks:** ${blocking.map((b) => `${b.identifier as string}: ${b.title as string}`).join('; ')}`)
  if (related.length > 0) lines.push(`**Related:** ${related.join('; ')}`)

  const description = await readMarkup(workspace, issue.description)
  lines.push('', '### Description', description !== '' ? description : '_(none)_')

  if ((issue.subIssues ?? 0) > 0) {
    lines.push('', '### Sub-issues', text(await listSubIssues({ workspace, identifier, depth: 2 } as any)).split('\n').slice(1).join('\n').trim())
  }

  const prs: any[] = await client.findAll(C.PullRequest, { attachedTo: issue._id }, { sort: { modifiedOn: SortingOrder.Descending } })
  if (prs.length > 0) {
    lines.push('', '### Pull requests')
    for (const pr of prs) {
      const gh = pr[IDS.GithubIssueMixin] ?? {}
      lines.push(`- ${pr.identifier as string} [${PR_STATE[pr.state] ?? pr.state}] ${pr.title as string} — #${gh.githubNumber as number ?? '?'} ${gh.url as string ?? ''}`)
    }
  }

  if ((issue.comments ?? 0) > 0) {
    const comments = text(await listComments({ workspace, identifier, limit: commentLimit } as any))
    lines.push('', '### Comments', comments.split('\n').slice(2).join('\n').trim())
  }
  return lines.join('\n')
}

export const getIssueContext = wrapToolHandler<z.infer<typeof GetIssueContextSchema>>(async (args) => {
  return await issueContext(args.workspace, args.identifier, args.commentLimit)
})

export const startWork = wrapToolHandler<z.infer<typeof StartWorkSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const issue: any = await findIssue(client, args.identifier)
  const status = await findStatus(client, args.statusName)
  const update: Record<string, unknown> = {}
  if (issue.status !== status._id) update.status = status._id
  let me: string | undefined
  if (args.assignToMe) {
    const person = await currentPerson(client)
    me = person.name
    if (issue.assignee !== person._id) update.assignee = person._id
  }
  if (Object.keys(update).length > 0) await client.update(issue, update)
  let claim = ''
  if (args.claimAs != null) claim = '\n' + text(await claimIssue({ workspace: args.workspace, identifier: args.identifier, agent: args.claimAs, minutes: 120, force: false } as any))
  const head = `▶️ Started **${args.identifier}** — status ${status.name as string}${me != null ? `, assigned to ${me}` : ''}.${claim}`
  return `${head}\n\n${await issueContext(args.workspace, args.identifier)}`
})

/** Finds a synced GitHub PR by "#12", "12", a GitHub URL or its Huly identifier. */
export async function findPullRequest (client: any, project: string, ref: string): Promise<any> {
  if (/^[A-Z][A-Z0-9]*-\d+$/.test(ref)) {
    const pr = await client.findOne(C.PullRequest, { identifier: ref })
    if (pr == null) throw new Error(`Pull request '${ref}' not found.`)
    return pr
  }
  const url = /^https?:\/\//.test(ref) ? ref.replace(/\/$/, '') : undefined
  const number = url == null ? Number(ref.replace(/^#/, '')) : Number(/\/pull\/(\d+)/.exec(url)?.[1])
  const prs: any[] = await client.findAll(C.PullRequest, { space: project })
  const hits = prs.filter((pr) => {
    const gh = pr[IDS.GithubIssueMixin] ?? {}
    return url != null ? String(gh.url ?? '').replace(/\/$/, '') === url : gh.githubNumber === number
  })
  if (hits.length === 0) throw new Error(`Pull request '${ref}' not synced to this project yet (GitHub sync can take a minute).`)
  if (hits.length > 1) throw new Error(`Pull request '${ref}' is ambiguous here — pass its URL or Huly id.`)
  return hits[0]
}

export const finishWork = wrapToolHandler<z.infer<typeof FinishWorkSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const issue: any = await findIssue(client, args.identifier)
  const done: string[] = []
  const notes: string[] = []

  // Resolve everything that can fail before changing anything.
  const pr = args.pullRequest != null ? await findPullRequest(client, issue.space, args.pullRequest) : undefined
  await addComment({ workspace: args.workspace, identifier: args.identifier, message: `🤖 **Work summary**\n\n${args.summary}` } as any)
  done.push('summary comment added')

  if (pr != null) {
    if (pr.attachedTo === issue._id) {
      done.push(`${pr.identifier as string} already under ${args.identifier}`)
    } else {
      await setParent({ workspace: args.workspace, identifier: pr.identifier, parentIdentifier: args.identifier } as any)
      done.push(`${pr.identifier as string} linked as sub-issue`)
    }
  }

  if (args.statusName != null) {
    try {
      const status = await findStatus(client, args.statusName)
      if (issue.status !== status._id) await client.update(issue, { status: status._id })
      done.push(`status → ${status.name as string}`)
    } catch (e) { notes.push((e as Error).message) }
  }

  const labels: any[] = await client.findAll('tags:class:TagReference', { attachedTo: issue._id })
  if (labels.some((l) => l.title === CLAIM_LABEL)) {
    const agent = claimState(await claimComments(client, issue))?.agent ?? 'agent'
    await releaseIssue({ workspace: args.workspace, identifier: args.identifier, agent } as any)
    done.push('claim released')
  }
  return `✅ Finished **${args.identifier}**: ${done.join(', ')}.${notes.length > 0 ? `\n⚠️ ${notes.join(' ')}` : ''}`
})

// ── Issue trees from a plan ───────────────────────────────────────────────────

const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ')

export const createIssueTree = wrapToolHandler<z.infer<typeof CreateIssueTreeSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const project = await client.findOne(tracker.class.Project, { identifier: args.projectIdentifier })
  if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`)
  if (args.epic == null && args.epicIdentifier == null) throw new Error('Pass epic (new) or epicIdentifier (existing).')
  if (args.epic != null && args.epicIdentifier != null) throw new Error('Pass either epic or epicIdentifier, not both.')

  const existing: any[] = await client.findAll(tracker.class.Issue, { space: project._id })
  const byTitle = new Map(existing.map((i) => [norm(i.title), i.identifier as string]))
  const epicExisting = args.epicIdentifier != null ? (await findIssue(client, args.epicIdentifier)).identifier : undefined
  const epicDup = args.epic != null ? byTitle.get(norm(args.epic.title)) : undefined

  // Children may reference each other as "#1" (1-based position) in blockedBy.
  for (const [i, child] of args.children.entries()) {
    for (const ref of child.blockedBy ?? []) {
      const m = /^#(\d+)$/.exec(ref)
      if (m != null && (Number(m[1]) < 1 || Number(m[1]) > args.children.length || Number(m[1]) === i + 1)) throw new Error(`children[${i}].blockedBy '${ref}' must point to another child (#1–#${args.children.length}).`)
    }
  }

  const plan: string[] = []
  plan.push(epicExisting != null
    ? `Epic: existing **${epicExisting}**`
    : epicDup != null && args.skipDuplicates ? `Epic: "${args.epic!.title}" → reuse existing **${epicDup}** (same title)` : `Epic: create "${args.epic!.title}"`)
  args.children.forEach((c, i) => {
    const dup = byTitle.get(norm(c.title))
    const extras = [c.componentLabel ?? args.componentLabel, c.milestoneLabel ?? args.milestoneLabel, c.assignee, ...(c.labels ?? [])].filter((x) => x != null)
    const blockers = (c.blockedBy ?? []).length > 0 ? ` · blocked by ${(c.blockedBy ?? []).join(', ')}` : ''
    plan.push(`#${i + 1} ${dup != null && args.skipDuplicates ? `"${c.title}" → reuse existing **${dup}**` : `create "${c.title}"`}${extras.length > 0 ? ` · ${extras.join(', ')}` : ''}${blockers}`)
  })
  if (args.dryRun) return `🔍 Dry run in ${args.projectIdentifier}:\n${plan.map((p) => `- ${p}`).join('\n')}\nRun again with dryRun=false to create.`

  const ws = args.workspace
  const create = async (title: string, description: string | undefined, priority: string | undefined): Promise<string> => {
    const out = text(await createIssue({ workspace: ws, projectIdentifier: args.projectIdentifier, title, description, priority: priority ?? 'NoPriority' } as any))
    const id = /\*\*([A-Z][A-Z0-9]*-\d+)\*\*/.exec(out)?.[1]
    if (id == null) throw new Error(`Could not read new issue id from: ${out}`)
    return id
  }
  const decorate = async (id: string, c: { componentLabel?: string, milestoneLabel?: string, assignee?: string, labels?: string[] }): Promise<void> => {
    const component = c.componentLabel ?? args.componentLabel
    const milestone = c.milestoneLabel ?? args.milestoneLabel
    if (component != null || milestone != null || c.assignee != null) {
      await updateIssue({ workspace: ws, identifier: id, componentLabel: component, milestoneLabel: milestone, assignee: c.assignee } as any)
    }
    for (const label of c.labels ?? []) await addLabel({ workspace: ws, identifier: id, labelName: label } as any)
  }

  const created: string[] = []
  let epicId = epicExisting
  if (epicId == null) {
    if (epicDup != null && args.skipDuplicates) epicId = epicDup
    else {
      epicId = await create(args.epic!.title, args.epic!.description, args.epic!.priority)
      await decorate(epicId, { labels: args.epic!.labels })
      created.push(`${epicId} (epic)`)
    }
  }

  const ids: string[] = []
  for (const c of args.children) {
    const dup = byTitle.get(norm(c.title))
    if (dup != null && args.skipDuplicates) { ids.push(dup); continue }
    const id = await create(c.title, c.description, c.priority)
    await decorate(id, c)
    await setParent({ workspace: ws, identifier: id, parentIdentifier: epicId } as any)
    created.push(id)
    ids.push(id)
  }
  for (const [i, c] of args.children.entries()) {
    for (const ref of c.blockedBy ?? []) {
      const m = /^#(\d+)$/.exec(ref)
      await addBlockedBy({ workspace: ws, identifier: ids[i], blockedBy: m != null ? ids[Number(m[1]) - 1] : ref } as any)
    }
  }
  const reused = args.children.length - (created.length - (created[0]?.endsWith('(epic)') === true ? 1 : 0))
  return `✅ Issue tree under **${epicId}**: created ${created.length > 0 ? created.join(', ') : 'nothing'}${reused > 0 ? `; ${reused} existing reused` : ''}.\n${args.children.map((c, i) => `- ${ids[i]}: ${c.title}`).join('\n')}`
})

// ── What changed ──────────────────────────────────────────────────────────────

/** "2026-11-01", "2026-11-01T08:00", "24h", "7d", "90m" → timestamp. */
export function parseSince (value: string, now = Date.now()): number {
  const rel = /^(\d+)\s*([mhd])$/i.exec(value.trim())
  if (rel != null) return now - Number(rel[1]) * { m: 60_000, h: 3_600_000, d: 86_400_000 }[rel[2].toLowerCase() as 'm' | 'h' | 'd']
  const ts = Date.parse(value)
  if (Number.isNaN(ts)) throw new Error(`Cannot read since='${value}'. Use ISO (2026-11-01, 2026-11-01T08:00) or relative (90m, 24h, 7d).`)
  return ts
}

export const changesSince = wrapToolHandler<z.infer<typeof ChangesSinceSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const since = parseSince(args.since)
  const query: Record<string, unknown> = { modifiedOn: { $gte: since } }
  if (args.projectIdentifiers != null && args.projectIdentifiers.length > 0) {
    const projects: any[] = await client.findAll(tracker.class.Project, { identifier: { $in: args.projectIdentifiers } })
    const missing = args.projectIdentifiers.filter((p) => !projects.some((x) => x.identifier === p))
    if (missing.length > 0) throw new Error(`Project(s) not found: ${missing.join(', ')}.`)
    query.space = { $in: projects.map((p) => p._id) }
  }
  const issues: any[] = await client.findAll(tracker.class.Issue, query, { sort: { modifiedOn: SortingOrder.Descending }, limit: args.limit })
  if (issues.length === 0) return `No issue changes since ${new Date(since).toISOString()}.`

  const ids = issues.map((i) => i._id)
  const [updates, comments, statuses]: any[][] = await Promise.all([
    client.findAll('activity:class:DocUpdateMessage', { attachedTo: { $in: ids }, createdOn: { $gte: since } }),
    client.findAll('chunter:class:ChatMessage', { attachedTo: { $in: ids }, createdOn: { $gte: since } }),
    client.findAll(tracker.class.IssueStatus, {})
  ])
  const authors = await socialIdNames(client, [...new Set([...updates, ...comments].map((m) => m.createdBy).filter((x) => x != null))])
  const statusName = new Map(statuses.map((s) => [s._id, s.name]))

  const lines = issues.map((issue) => {
    const ups = updates.filter((u) => u.attachedTo === issue._id)
    const fields = [...new Set(ups.map((u) => u.attributeUpdates?.attrKey).filter((k) => k != null && k !== 'rank').map((k) => k === 'attachedTo' ? 'parent' : k))]
    const cs = comments.filter((c) => c.attachedTo === issue._id)
    const who = [...new Set([...ups, ...cs].map((m) => authors.get(m.createdBy)).filter((n) => n != null))]
    const parts = [
      issue.createdOn >= since ? 'new' : undefined,
      fields.length > 0 ? `changed ${fields.join(', ')}` : undefined,
      cs.length > 0 ? `+${cs.length} comment(s)` : undefined
    ].filter((p) => p != null)
    const kind = issue._class === C.PullRequest ? 'PR ' : ''
    return `- ${kind}**${issue.identifier as string}** [${statusName.get(issue.status) ?? '?'}] ${issue.title as string} — ${parts.length > 0 ? parts.join(' · ') : 'updated'}${who.length > 0 ? ` (by ${who.join(', ')})` : ''} · ${formatDate(issue.modifiedOn)}`
  })
  return `## Changes since ${new Date(since).toISOString()} (${issues.length}${issues.length === args.limit ? '+' : ''})\n\n${lines.join('\n')}`
})

// ── Claims: lightweight leases so parallel agents do not work on the same issue ──

async function claimComments (client: any, issue: any): Promise<any[]> {
  const comments: any[] = await client.findAll('chunter:class:ChatMessage', { attachedTo: issue._id }, { sort: { createdOn: SortingOrder.Descending }, limit: 50 })
  return comments.filter((c) => CLAIM_RE.test(String(c.message ?? '')))
}

/** Latest claim marker → active claim, or undefined when released/expired. */
export function claimState (markers: any[], now = Date.now()): { agent: string, until: number } | undefined {
  const latest = markers[0]
  if (latest == null) return undefined
  const m = CLAIM_RE.exec(String(latest.message))!
  if (m[1] !== 'claim') return undefined
  const until = Date.parse(m[3] ?? '')
  if (Number.isNaN(until) || until < now) return undefined
  return { agent: m[2], until }
}

const agentName = (agent?: string): string => (agent ?? process.env.HULY_AGENT_NAME ?? 'claude').replace(/\s+/g, '-')

export const claimIssue = wrapToolHandler<z.infer<typeof ClaimIssueSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const issue = await findIssue(client, args.identifier)
  const agent = agentName(args.agent)
  const active = claimState(await claimComments(client, issue))
  if (active != null && active.agent !== agent && !args.force) {
    throw new Error(`${args.identifier} is claimed by '${active.agent}' until ${new Date(active.until).toISOString()}. Pick another issue or pass force=true.`)
  }
  const until = new Date(Date.now() + args.minutes * 60_000).toISOString()
  await addComment({ workspace: args.workspace, identifier: args.identifier, message: `🤖 Claimed by **${agent}** until ${until} [huly-claim agent=${agent} until=${until}]` } as any)
  await addLabel({ workspace: args.workspace, identifier: args.identifier, labelName: CLAIM_LABEL } as any)
  return `🔒 **${args.identifier}** claimed by ${agent} until ${until}.`
})

export const releaseIssue = wrapToolHandler<z.infer<typeof ReleaseIssueSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const issue = await findIssue(client, args.identifier)
  const agent = agentName(args.agent)
  await addComment({ workspace: args.workspace, identifier: args.identifier, message: `🤖 Released by **${agent}** [huly-release agent=${agent}]` } as any)
  const labels: any[] = await client.findAll('tags:class:TagReference', { attachedTo: issue._id })
  if (labels.some((l) => l.title === CLAIM_LABEL)) await removeLabel({ workspace: args.workspace, identifier: args.identifier, labelName: CLAIM_LABEL } as any)
  return `🔓 **${args.identifier}** released by ${agent}.`
})
