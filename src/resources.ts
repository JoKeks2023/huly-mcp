// MCP resources (issues/documents addressable as huly:// URIs, e.g. @-mentions in Claude Code)
// and prompts (ready-made workflows, shown as slash commands in Claude Code).
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { completable } from '@modelcontextprotocol/sdk/server/completable.js'
import { SubscribeRequestSchema, UnsubscribeRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import tracker from '@hcengineering/tracker'
import task from '@hcengineering/task'
import { SortingOrder } from '@hcengineering/core'
import { getConnection, listWorkspaces } from './connection'
import { currentPerson } from './utils/people'
import { issueContext } from './tools/agent'
import { getDocument } from './tools/documents'

const DONE = new Set<string>([task.statusCategory.Won, task.statusCategory.Lost])

/** Open issues assigned to me, newest first — offered as huly:// resources. */
async function myOpenIssues (limit = 30): Promise<Array<{ uri: string, name: string, description: string }>> {
  const out: Array<{ uri: string, name: string, description: string }> = []
  for (const ws of await listWorkspaces()) {
    try {
      const client: any = await getConnection(ws.url)
      const me = await currentPerson(client)
      const statuses: any[] = await client.findAll(tracker.class.IssueStatus, {})
      const open = statuses.filter((s) => !DONE.has(s.category)).map((s) => s._id)
      const issues: any[] = await client.findAll(tracker.class.Issue, { assignee: me._id, status: { $in: open } }, { sort: { modifiedOn: SortingOrder.Descending }, limit })
      for (const i of issues) out.push({ uri: `huly://${ws.url}/issue/${i.identifier as string}`, name: `${i.identifier as string}: ${i.title as string}`, description: `Open issue in ${ws.name}` })
    } catch { /* a workspace that cannot be read just contributes nothing */ }
  }
  return out.slice(0, limit)
}


// ── Argument completions (MCP completion/complete) ───────────────────────────
// Clients that support completions suggest workspaces, projects and issue ids while typing.
const MAX = 100
const starts = (values: string[], prefix: string): string[] =>
  values.filter((v) => v.toLowerCase().startsWith(prefix.toLowerCase())).slice(0, MAX)

export async function completeWorkspace (prefix: string): Promise<string[]> {
  try { return starts((await listWorkspaces()).map((w) => w.url), prefix) } catch { return [] }
}

export async function completeProject (prefix: string, workspace?: string): Promise<string[]> {
  try {
    const client: any = await getConnection(workspace)
    const projects: any[] = (await client.findAll(tracker.class.Project, {})).filter((p: any) => p.archived !== true)
    return starts(projects.map((p) => p.identifier as string).sort(), prefix)
  } catch { return [] }
}

export async function completeIssue (prefix: string, workspace?: string): Promise<string[]> {
  try {
    const client: any = await getConnection(workspace)
    const m = /^([A-Za-z][A-Za-z0-9]*)(?:-(\d*))?$/.exec(prefix.trim())
    if (m == null) {
      // No project typed yet: offer my open issues, newest first.
      const me = await currentPerson(client)
      const mine: any[] = await client.findAll(tracker.class.Issue, { assignee: me._id }, { sort: { modifiedOn: SortingOrder.Descending }, limit: 50 })
      return mine.map((i) => i.identifier as string)
    }
    if (m[2] == null) {
      const projects = await completeProject(m[1], workspace)
      return projects.length === 1 ? projects.map((p) => `${p}-`) : projects
    }
    const project = await client.findOne(tracker.class.Project, { identifier: m[1].toUpperCase() })
    if (project == null) return []
    const issues: any[] = await client.findAll(tracker.class.Issue, { space: project._id }, { sort: { modifiedOn: SortingOrder.Descending }, limit: 500 })
    return starts(issues.map((i) => i.identifier as string), prefix)
  } catch { return [] }
}

const ws = (ctx?: { arguments?: Record<string, string> }): string | undefined => ctx?.arguments?.workspace
const wsArg = (): any => completable(z.string(), async (v) => await completeWorkspace(v))
const issueArg = (): any => completable(z.string(), async (v, ctx) => await completeIssue(v, ws(ctx)))
const projectArg = (): any => completable(z.string(), async (v, ctx) => await completeProject(v, ws(ctx)))

export function registerResources (server: McpServer): void {
  server.registerResource(
    'issue',
    new ResourceTemplate('huly://{workspace}/issue/{identifier}', {
      list: async () => ({ resources: (await myOpenIssues()).map((r) => ({ ...r, mimeType: 'text/markdown' })) }),
      complete: {
        workspace: async (v) => await completeWorkspace(v),
        identifier: async (v, ctx) => await completeIssue(v, ws(ctx))
      }
    }),
    { title: 'Huly issue', description: 'Issue with description, sub-issues, blockers, PRs and comments', mimeType: 'text/markdown' },
    async (uri, vars) => ({
      contents: [{ uri: uri.href, mimeType: 'text/markdown', text: await issueContext(String(vars.workspace), String(vars.identifier)) }]
    })
  )
  server.registerResource(
    'document',
    new ResourceTemplate('huly://{workspace}/document/{id}', { list: undefined, complete: { workspace: async (v) => await completeWorkspace(v) } }),
    { title: 'Huly document', description: 'Document with its content', mimeType: 'text/markdown' },
    async (uri, vars) => {
      const result = await getDocument({ workspace: String(vars.workspace), documentId: String(vars.id) } as any)
      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: result.content[0].text }] }
    }
  )
}

const user = (text: string): { messages: Array<{ role: 'user', content: { type: 'text', text: string } }> } =>
  ({ messages: [{ role: 'user', content: { type: 'text', text } }] })

export function registerPrompts (server: McpServer): void {
  server.registerPrompt('start', {
    title: 'Start working on an issue',
    description: 'Pick up an issue, load its context and propose a plan',
    argsSchema: { workspace: wsArg(), identifier: issueArg() }
  }, ({ workspace, identifier }) => user(
    `Start work on Huly issue ${identifier} in workspace ${workspace}: call start_work, read the context it returns ` +
    '(description, sub-issues, blockers, PRs, comments). If it is blocked by open issues, say so before doing anything. ' +
    'Then propose a short implementation plan and use the suggested branch name.'
  ))

  server.registerPrompt('finish', {
    title: 'Finish an issue',
    description: 'Post a work summary, link the PR and move the issue to review',
    argsSchema: { workspace: wsArg(), identifier: issueArg(), pullRequest: z.string().optional() }
  }, ({ workspace, identifier, pullRequest }) => user(
    `Finish Huly issue ${identifier} in workspace ${workspace}: summarise what was changed and how it was verified ` +
    `(be honest about anything not verified), then call finish_work with that summary${pullRequest != null ? ` and pullRequest "${pullRequest}"` : ''}.`
  ))

  server.registerPrompt('plan', {
    title: 'Turn a plan into issues',
    description: 'Epic + sub-issues from a goal or plan, with duplicate check',
    argsSchema: { workspace: wsArg(), projectIdentifier: projectArg(), goal: z.string() }
  }, ({ workspace, projectIdentifier, goal }) => user(
    `Break this down into a Huly epic with sub-issues in project ${projectIdentifier} (workspace ${workspace}):\n\n${goal}\n\n` +
    'Look up components and milestones first (list_components, list_milestones) and assign each child the fitting ones. ' +
    'Express ordering with blockedBy. Call create_issue_tree with dryRun=true, show me the plan, and only create it after I confirm.'
  ))

  server.registerPrompt('triage', {
    title: 'Triage my inbox',
    description: 'Go through unread notifications and suggest actions',
    argsSchema: { workspace: wsArg() }
  }, ({ workspace }) => user(
    `Triage my Huly inbox in workspace ${workspace}: list_notifications (unread), group them by urgency, and for each ` +
    'suggest one action (reply, start work, delegate, ignore). Do not change anything until I pick.'
  ))

  server.registerPrompt('standup', {
    title: 'Stand-up summary',
    description: 'What changed since yesterday and what is next',
    argsSchema: { workspace: wsArg(), since: z.string().optional() }
  }, ({ workspace, since }) => user(
    `Write my stand-up for Huly workspace ${workspace}: call changes_since with since="${since ?? '24h'}", ` +
    'then my open assigned issues. Format: Done / In progress / Blocked / Next — short bullet points with issue ids.'
  ))
}

// ── Resource subscriptions (resources/subscribe → notifications/resources/updated) ──
// Huly pushes no per-document events to this client, so subscribed issues/documents are
// polled for a newer modifiedOn. The timer only runs while something is subscribed.

/** modifiedOn of the object behind a huly:// URI, or undefined if it cannot be read. */
export async function modifiedOn (uri: string): Promise<number | undefined> {
  const m = /^huly:\/\/([^/]+)\/(issue|document)\/(.+)$/.exec(uri)
  if (m == null) return undefined
  try {
    const client: any = await getConnection(decodeURIComponent(m[1]))
    const id = decodeURIComponent(m[3])
    const doc = m[2] === 'issue'
      ? await client.findOne(tracker.class.Issue, { identifier: id })
      : await client.findOne('document:class:Document', { _id: id })
    return doc?.modifiedOn
  } catch {
    return undefined
  }
}

export function registerSubscriptions (server: McpServer, pollMs = Number(process.env.HULY_SUBSCRIBE_POLL_MS ?? 30_000)): { poll: () => Promise<void>, subscriptions: Map<string, number | undefined> } {
  const subscriptions = new Map<string, number | undefined>()
  let timer: NodeJS.Timeout | undefined
  let polling = false

  const poll = async (): Promise<void> => {
    if (polling) return
    polling = true
    try {
      for (const [uri, last] of subscriptions) {
        const now = await modifiedOn(uri)
        if (now != null && last != null && now > last) {
          subscriptions.set(uri, now)
          await server.server.sendResourceUpdated({ uri }).catch(() => {})
        } else if (last == null && now != null) {
          subscriptions.set(uri, now)
        }
      }
    } finally {
      polling = false
    }
  }
  const sync = (): void => {
    if (subscriptions.size > 0 && timer == null) {
      timer = setInterval(() => { void poll() }, Math.max(5_000, pollMs))
      timer.unref()
    } else if (subscriptions.size === 0 && timer != null) {
      clearInterval(timer)
      timer = undefined
    }
  }

  server.server.registerCapabilities({ resources: { subscribe: true, listChanged: true } })
  server.server.setRequestHandler(SubscribeRequestSchema, async (req) => {
    subscriptions.set(req.params.uri, await modifiedOn(req.params.uri))
    sync()
    return {}
  })
  server.server.setRequestHandler(UnsubscribeRequestSchema, async (req) => {
    subscriptions.delete(req.params.uri)
    sync()
    return {}
  })
  server.server.onclose = () => { subscriptions.clear(); sync() }
  return { poll, subscriptions }
}
