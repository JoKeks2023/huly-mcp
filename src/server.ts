import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { TOOLS, TOOLSETS, DEFAULT_TOOLSETS, type Toolset } from './registry'
import { guard, elicitationAsker } from './guard'
import { registerResources, registerPrompts, registerSubscriptions } from './resources'

const SERVER_INSTRUCTIONS = `
Huly workspaces (tracker, docs, chat, planner, …), self-hosted or cloud. One account, possibly several workspaces.

Conventions
- workspace: slug, name or id from list_workspaces. Required for every change — never guess; ask if unclear.
  Reads may omit it only if exactly one workspace exists. Ids are only valid within their workspace.
- Project key: short ALL-CAPS (PROJ). Issue id: PROJ-123. Dates: ISO 8601 (2026-06-01).
- People: by name ("Joris", "Joris Conrad"), case-insensitive; ambiguous names are rejected.
- A field set to null is cleared. Descriptions/content are Markdown.

Agent workflow
- start_work → work → finish_work. get_issue_context gives everything about an issue in one call.
- Plans become issues with create_issue_tree (dry run first). changes_since catches up after a break.
- With several agents in parallel: claim_issue before working, finish_work releases the claim.
- Deletes and other risky tools may ask the user first. If they decline, do not retry.

Tips
- Read before writing: get_issue before update_issue, get_document before update_document (it replaces all).
- Epics are issues: set_parent / list_sub_issues. Issue statuses are workspace-wide.
- Ids for comments, attachments, documents come from the matching list_* tool.
- search_issues finds issues by content across projects.
- attach_file takes base64 content, not a path or URL.
- Tools are grouped in toolsets (HULY_TOOLSETS); missing tools may just be disabled.
`.trim()

/**
 * Parses HULY_TOOLSETS ("tracker,planner", "all", or unset for the defaults).
 * 'core' is always included. Unknown names are an error, so a typo never silently hides tools.
 */
export function parseToolsets (value: string | undefined): Set<Toolset> {
  const raw = (value ?? '').split(',').map((t) => t.trim().toLowerCase()).filter((t) => t !== '')
  if (raw.length === 0) return new Set<Toolset>(['core', ...DEFAULT_TOOLSETS])
  if (raw.includes('all')) return new Set<Toolset>(TOOLSETS)
  const unknown = raw.filter((t) => !(TOOLSETS as readonly string[]).includes(t))
  if (unknown.length > 0) {
    throw new Error(`Unknown toolset(s) in HULY_TOOLSETS: ${unknown.join(', ')}. Available: ${TOOLSETS.filter((t) => t !== 'core').join(', ')}, all`)
  }
  return new Set<Toolset>(['core', ...(raw as Toolset[])])
}

/** Instructions for a server pinned to one workspace (HULY_WORKSPACE): no workspace argument at all. */
export function pinnedInstructions (workspace: string): string {
  return SERVER_INSTRUCTIONS.replace(/- workspace: [^\n]*\n[^\n]*\n/, `- All tools work in workspace '${workspace}' (HULY_WORKSPACE); there is no workspace argument.\n`)
}

export function createServer (options: { toolsets?: string, workspace?: string } = {}): McpServer {
  const enabled = parseToolsets(options.toolsets ?? process.env.HULY_TOOLSETS)
  // Pinned to one workspace: the workspace argument (~80 chars in each of ~90 schemas) carries no
  // information, so it is left out of the schemas and filled in here. Write checks use the
  // registry schema, which keeps it, so "every change names its workspace" still holds.
  const pinned = (options.workspace ?? process.env.HULY_WORKSPACE ?? '').trim() || undefined
  const server = new McpServer({ name: 'huly-mcp-selfhost', version: '3.0.0' }, { instructions: pinned != null ? pinnedInstructions(pinned) : SERVER_INSTRUCTIONS })
  const asker = elicitationAsker(server)
  for (const tool of TOOLS) {
    if (!enabled.has(tool.toolset)) continue
    const handler = guard(tool, process.env, asker)
    if (pinned == null || tool.schema.shape.workspace == null) {
      server.tool(tool.name, tool.description, tool.schema.shape, handler)
    } else {
      const { workspace: _ws, ...shape } = tool.schema.shape
      server.tool(tool.name, tool.description, shape, async (args: any, extra: any) => await (handler as any)({ ...args, workspace: pinned }, extra))
    }
  }
  if (enabled.has('agent')) {
    registerResources(server)
    ;(server as any).hulySubscriptions = registerSubscriptions(server)
    registerPrompts(server)
  }
  slimToolList(server)
  return server
}

/** Validation-only keywords: zod still enforces them and answers with a clear error, so the model
 * does not need them up front (~2.4k characters in the default set). Defaults and enums stay. */
const LIMIT_KEYS = ['minLength', 'maxLength', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minItems', 'maxItems']

export function stripLimits (node: any): void {
  if (Array.isArray(node)) { for (const n of node) stripLimits(n); return }
  if (node == null || typeof node !== 'object') return
  for (const k of LIMIT_KEYS) if (typeof node[k] === 'number') delete node[k]
  for (const v of Object.values(node)) stripLimits(v)
}

/**
 * The SDK adds a JSON-Schema "$schema" URL and an "execution" block to every tool in tools/list.
 * Neither carries information for the model, but together they cost ~80 characters per tool in
 * every session. Strip them. If the SDK internals change, the original response is kept.
 */
function slimToolList (server: McpServer): void {
  const handlers: Map<string, (req: any, extra: any) => Promise<any>> | undefined = (server.server as any)._requestHandlers
  const original = handlers?.get('tools/list')
  if (handlers == null || original == null) return
  handlers.set('tools/list', async (req, extra) => {
    const result = await original(req, extra)
    for (const tool of result?.tools ?? []) {
      if (tool.inputSchema != null) delete tool.inputSchema.$schema
      stripLimits(tool.inputSchema)
      if (tool.execution?.taskSupport === 'forbidden' && Object.keys(tool.execution).length === 1) delete tool.execution
    }
    return result
  })
}
