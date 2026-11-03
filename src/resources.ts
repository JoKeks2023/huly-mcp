// MCP resources (issues/documents addressable as huly:// URIs, e.g. @-mentions in Claude Code)
// and prompts (ready-made workflows, shown as slash commands in Claude Code).
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
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

export function registerResources (server: McpServer): void {
  server.registerResource(
    'issue',
    new ResourceTemplate('huly://{workspace}/issue/{identifier}', {
      list: async () => ({ resources: (await myOpenIssues()).map((r) => ({ ...r, mimeType: 'text/markdown' })) })
    }),
    { title: 'Huly issue', description: 'Issue with description, sub-issues, blockers, PRs and comments', mimeType: 'text/markdown' },
    async (uri, vars) => ({
      contents: [{ uri: uri.href, mimeType: 'text/markdown', text: await issueContext(String(vars.workspace), String(vars.identifier)) }]
    })
  )
  server.registerResource(
    'document',
    new ResourceTemplate('huly://{workspace}/document/{id}', { list: undefined }),
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
    argsSchema: { workspace: z.string(), identifier: z.string() }
  }, ({ workspace, identifier }) => user(
    `Start work on Huly issue ${identifier} in workspace ${workspace}: call start_work, read the context it returns ` +
    '(description, sub-issues, blockers, PRs, comments). If it is blocked by open issues, say so before doing anything. ' +
    'Then propose a short implementation plan and use the suggested branch name.'
  ))

  server.registerPrompt('finish', {
    title: 'Finish an issue',
    description: 'Post a work summary, link the PR and move the issue to review',
    argsSchema: { workspace: z.string(), identifier: z.string(), pullRequest: z.string().optional() }
  }, ({ workspace, identifier, pullRequest }) => user(
    `Finish Huly issue ${identifier} in workspace ${workspace}: summarise what was changed and how it was verified ` +
    `(be honest about anything not verified), then call finish_work with that summary${pullRequest != null ? ` and pullRequest "${pullRequest}"` : ''}.`
  ))

  server.registerPrompt('plan', {
    title: 'Turn a plan into issues',
    description: 'Epic + sub-issues from a goal or plan, with duplicate check',
    argsSchema: { workspace: z.string(), projectIdentifier: z.string(), goal: z.string() }
  }, ({ workspace, projectIdentifier, goal }) => user(
    `Break this down into a Huly epic with sub-issues in project ${projectIdentifier} (workspace ${workspace}):\n\n${goal}\n\n` +
    'Look up components and milestones first (list_components, list_milestones) and assign each child the fitting ones. ' +
    'Express ordering with blockedBy. Call create_issue_tree with dryRun=true, show me the plan, and only create it after I confirm.'
  ))

  server.registerPrompt('triage', {
    title: 'Triage my inbox',
    description: 'Go through unread notifications and suggest actions',
    argsSchema: { workspace: z.string() }
  }, ({ workspace }) => user(
    `Triage my Huly inbox in workspace ${workspace}: list_notifications (unread), group them by urgency, and for each ` +
    'suggest one action (reply, start work, delegate, ignore). Do not change anything until I pick.'
  ))

  server.registerPrompt('standup', {
    title: 'Stand-up summary',
    description: 'What changed since yesterday and what is next',
    argsSchema: { workspace: z.string(), since: z.string().optional() }
  }, ({ workspace, since }) => user(
    `Write my stand-up for Huly workspace ${workspace}: call changes_since with since="${since ?? '24h'}", ` +
    'then my open assigned issues. Format: Done / In progress / Blocked / Next — short bullet points with issue ids.'
  ))
}
