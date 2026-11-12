import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { TOOLS, TOOLSETS, DEFAULT_TOOLSETS, type Toolset } from './registry'
import { guard, elicitationAsker, toolAnnotations } from './guard'
import { registerResources, registerPrompts, registerSubscriptions } from './resources'

const SERVER_INSTRUCTIONS = `
Huly workspaces (tracker, docs, chat, planner, …), self-hosted or cloud.

- workspace: slug, name or id from list_workspaces. Required for changes — never guess; ask if unclear.
  Reads may omit it only if exactly one workspace exists. Ids are only valid within their workspace.
- Issue id PROJ-123; dates ISO 8601; people by name (ambiguous names are rejected); null clears a field; text is Markdown.
- Start with one-call overviews: my_day, standup, triage_inbox, project_report, get_issue_context.
- Agent work: start_work → work → finish_work; plans → create_issue_tree (dry run first); with parallel agents claim_issue first.
- Read before replacing: get_issue before update_issue description, get_document before update_document.
- Risky tools may ask the user; if declined, do not retry. Login or setup problems: check_setup. A change was wrong: undo_changes (dry run first).
- Missing tools may be in a disabled toolset (HULY_TOOLSETS).
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

export function createServer (options: { toolsets?: string, workspace?: string, dynamic?: boolean, annotations?: boolean } = {}): McpServer {
  const enabled = parseToolsets(options.toolsets ?? process.env.HULY_TOOLSETS)
  // Pinned to one workspace: the workspace argument (~80 chars in each of ~90 schemas) carries no
  // information, so it is left out of the schemas and filled in here. Write checks use the
  // registry schema, which keeps it, so "every change names its workspace" still holds.
  const pinned = (options.workspace ?? process.env.HULY_WORKSPACE ?? '').trim() || undefined
  const annotate = options.annotations ?? ['1', 'true', 'yes'].includes(String(process.env.HULY_ANNOTATIONS ?? '').toLowerCase())
  const dynamic = options.dynamic ?? ['1', 'true', 'yes'].includes(String(process.env.HULY_DYNAMIC_TOOLSETS ?? '').toLowerCase())
  let instructions = pinned != null ? pinnedInstructions(pinned) : SERVER_INSTRUCTIONS
  if (enabled.has('agent')) instructions += '\n- Guides: resources huly://guide/workflow, huly://guide/costs, huly://guide/onboarding, huly://guide/features; prompt "setup" writes a project\'s Huly rules.'
  if (dynamic) instructions = instructions.replace('- Missing tools may be in a disabled toolset (HULY_TOOLSETS).', '- More tools (calendar, cards, drive, testing, recruiting, …) load on demand: enable_toolsets.')
  const server = new McpServer({ name: 'huly-mcp-selfhost', version: '3.6.0' }, { instructions })
  const asker = elicitationAsker(server)
  // Load on demand (HULY_DYNAMIC_TOOLSETS=1): every tool is registered, those outside HULY_TOOLSETS
  // start disabled; enable_toolsets switches them on and the client is told the tool list changed.
  const registered = new Map<string, any>()
  for (const tool of TOOLS) {
    if (!enabled.has(tool.toolset) && !dynamic) continue
    const handler = guard(tool, process.env, asker)
    let reg: any
    if (pinned == null || tool.schema.shape.workspace == null) {
      reg = annotate
        ? server.tool(tool.name, tool.description, tool.schema.shape, toolAnnotations(tool), handler)
        : server.tool(tool.name, tool.description, tool.schema.shape, handler)
    } else {
      const { workspace: _ws, ...shape } = tool.schema.shape
      const pinnedHandler = async (args: any, extra: any): Promise<any> => await (handler as any)({ ...args, workspace: pinned }, extra)
      reg = annotate
        ? server.tool(tool.name, tool.description, shape, toolAnnotations(tool), pinnedHandler)
        : server.tool(tool.name, tool.description, shape, pinnedHandler)
    }
    if (!enabled.has(tool.toolset)) reg.disable()
    registered.set(tool.name, reg)
  }
  if (dynamic) registerEnableToolsets(server, enabled, registered)
  if (enabled.has('agent')) {
    registerResources(server)
    ;(server as any).hulySubscriptions = registerSubscriptions(server)
    registerPrompts(server)
  }
  slimToolList(server)
  checkArguments(server, new Map(TOOLS.map((t) => [t.name, new Set(Object.keys(t.schema.shape))])))
  return server
}

/** The on-demand switch: lists toolsets (with their tools) or enables them. */
function registerEnableToolsets (server: McpServer, enabled: Set<Toolset>, registered: Map<string, any>): void {
  const available = (): string[] => TOOLSETS.filter((t) => !enabled.has(t))
  server.tool('enable_toolsets', 'Load more Huly tools. No args: list toolsets and their tools; then pass the names you need', {
    toolsets: z.array(z.string()).optional()
  }, async (args) => {
    const names = (args.toolsets ?? []).map((t) => t.trim().toLowerCase())
    if (names.length === 0) {
      const lines = available().map((t) => `- **${t}** (${TOOLS.filter((x) => x.toolset === t).length}): ${TOOLS.filter((x) => x.toolset === t).map((x) => x.name).join(', ')}`)
      return { content: [{ type: 'text' as const, text: lines.length > 0 ? `## Toolsets not loaded yet\n\n${lines.join('\n')}` : 'All toolsets are loaded.' }] }
    }
    const unknown = names.filter((n) => !(TOOLSETS as readonly string[]).includes(n))
    if (unknown.length > 0) return { isError: true, content: [{ type: 'text' as const, text: `Unknown toolset(s): ${unknown.join(', ')}. Available: ${available().join(', ')}.` }] }
    const added: string[] = []
    for (const n of names as Toolset[]) {
      if (enabled.has(n)) continue
      enabled.add(n)
      for (const tool of TOOLS.filter((t) => t.toolset === n)) { registered.get(tool.name)?.enable(); added.push(tool.name) }
    }
    return { content: [{ type: 'text' as const, text: added.length > 0 ? `✅ Loaded ${added.length} tool(s): ${added.join(', ')}. They are available from your next step.` : 'Already loaded.' }] }
  })
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

/** Names models often use instead of ours. Applied only when the tool has the target and not the alias. */
export const ARG_ALIASES: Record<string, string> = {
  status: 'statusName',
  project: 'projectIdentifier',
  projectId: 'projectIdentifier',
  issue: 'identifier',
  issueId: 'identifier',
  id: 'identifier',
  component: 'componentLabel',
  milestone: 'milestoneLabel'
}

/** Per-tool aliases: names that are right elsewhere but would be wrong as a global alias
 * (milestoneLabel → label must not hit the component tools). */
export const TOOL_ARG_ALIASES: Record<string, Record<string, string>> = {
  get_milestone: { milestoneLabel: 'label', milestone: 'label' },
  update_milestone: { milestoneLabel: 'label', milestone: 'label' },
  update_component: { componentLabel: 'label', component: 'label' }
}

/** The real parameter an alias stands for in this tool, if any. */
export function aliasTarget (tool: string, name: string, known: Set<string>): string | undefined {
  const target = TOOL_ARG_ALIASES[tool]?.[name] ?? ARG_ALIASES[name]
  return target != null && known.has(target) ? target : undefined
}

/**
 * zod drops unknown keys silently, so `update_issue {status: "Done"}` answered "No changes made"
 * and the model never learned why. Before validation: map common aliases to the real name and
 * reject anything else unknown with the list of valid parameters — one cheap retry instead of
 * a wrong result. `workspace` is always accepted (it is ignored when the server is pinned).
 */
export function normalizeArguments (tool: string, args: Record<string, unknown>, known: Set<string>): { args: Record<string, unknown> } | { error: string } {
  const out: Record<string, unknown> = {}
  const unknown: string[] = []
  for (const [k, v] of Object.entries(args)) {
    if (known.has(k) || k === 'workspace') { out[k] = v; continue }
    const target = aliasTarget(tool, k, known)
    if (target != null && !(target in args)) { out[target] = v; continue }
    unknown.push(k)
  }
  if (unknown.length === 0) return { args: out }
  const valid = [...known].filter((k) => k !== 'workspace')
  return { error: `Unknown parameter(s) for ${tool}: ${unknown.join(', ')}. ${valid.length > 0 ? `Valid: ${valid.join(', ')}` : 'It takes no parameters besides workspace'}. Nothing was done.` }
}

function checkArguments (server: McpServer, shapes: Map<string, Set<string>>): void {
  const handlers: Map<string, (req: any, extra: any) => Promise<any>> | undefined = (server.server as any)._requestHandlers
  const original = handlers?.get('tools/call')
  if (handlers == null || original == null) return
  handlers.set('tools/call', async (req, extra) => {
    const known = shapes.get(req?.params?.name)
    const args = req?.params?.arguments
    if (known == null || args == null || typeof args !== 'object' || Array.isArray(args)) return await original(req, extra)
    const res = normalizeArguments(req.params.name, args, known)
    if ('error' in res) return { isError: true, content: [{ type: 'text', text: res.error }] }
    return await original({ ...req, params: { ...req.params, arguments: res.args } }, extra)
  })
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
