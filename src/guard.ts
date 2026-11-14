// Cross-cutting checks around every tool call:
// - HULY_WRITE_PROJECTS: changes are only allowed in the listed projects
// - HULY_AUDIT_LOG: every change is appended as one JSON line to this file
// - HULY_CONFIRM: destructive tools ask the user first (MCP elicitation) when the client can ask
import { appendFileSync } from 'node:fs'
import type { ToolDef } from './registry'
import { API_READ as HULY_API_READ } from './tools/admin'
import { recordChanges, addEntry, type UndoStep } from './utils/undo'
import { getConnectionManager, getConnection } from './connection'

const TASK_ID = /^([A-Z][A-Z0-9]*)-\d+$/
const PROJECT_KEYS = new Set(['projectIdentifier', 'targetProjectIdentifier', 'projectIdentifiers'])

/** A tool changes data when its workspace argument is mandatory (reads may omit it). */
export function isMutation (tool: ToolDef): boolean {
  const ws = tool.schema.shape.workspace
  return ws != null && !ws.isOptional()
}

/** Project keys an argument object refers to: project fields plus every "PROJ-12"-style value. */
export function projectsIn (args: unknown, key = ''): Set<string> {
  const out = new Set<string>()
  const visit = (value: unknown, k: string): void => {
    if (typeof value === 'string') {
      if (PROJECT_KEYS.has(k)) out.add(value.toUpperCase())
      const m = TASK_ID.exec(value)
      if (m != null) out.add(m[1])
    } else if (Array.isArray(value)) {
      for (const v of value) visit(v, k)
    } else if (value != null && typeof value === 'object') {
      for (const [ck, cv] of Object.entries(value)) visit(cv, ck)
    }
  }
  visit(args, key)
  return out
}

export function parseWriteProjects (value: string | undefined): Set<string> | undefined {
  const list = (value ?? '').split(',').map((p) => p.trim().toUpperCase()).filter((p) => p !== '')
  return list.length > 0 ? new Set(list) : undefined
}

export function assertWriteAllowed (tool: ToolDef, args: unknown, allowed: Set<string> | undefined): void {
  if (allowed == null || !isMutation(tool)) return
  const denied = [...projectsIn(args)].filter((p) => !allowed.has(p))
  if (denied.length > 0) {
    throw new Error(`Huly MCP: ${tool.name} touches project(s) ${denied.join(', ')}, but HULY_WRITE_PROJECTS only allows ${[...allowed].join(', ')}.`)
  }
}

function shorten (value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return value.length > 200 ? `${value.slice(0, 200)}… (${value.length} chars)` : value
  if (Array.isArray(value)) return depth > 3 ? `[${value.length} items]` : value.map((v) => shorten(v, depth + 1))
  if (value != null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, /base64/i.test(k) ? `[${String(v).length} chars]` : shorten(v, depth + 1)]))
  }
  return value
}

export function audit (path: string | undefined, tool: ToolDef, args: unknown, outcome: { ok: boolean, text: string }): void {
  if (path == null || path === '' || !isMutation(tool)) return
  const entry = { ts: new Date().toISOString(), tool: tool.name, args: shorten(args), ok: outcome.ok, result: outcome.text.split('\n')[0].slice(0, 300) }
  try { appendFileSync(path, JSON.stringify(entry) + '\n') } catch { /* auditing must never break a tool call */ }
}

// ── Confirmation for destructive tools ───────────────────────────────────────

const RISKY = new Set(['set_module', 'update_workspace_settings', 'create_workspace', 'huly_api', 'undo_changes', 'bulk_update_issues', 'move_issue', 'generic_update', 'generic_delete', 'revoke_public_link', 'restore_file_version', 'send_invite', 'set_member_role', 'cancel_execution'])

/** Deletes and bulk/structural changes that are hard to undo. */
export function isRisky (name: string): boolean {
  return name.startsWith('delete_') || RISKY.has(name)
}

/** Whether this call needs a confirmation: risky tools, except huly_api reads and its dry runs. */
export function needsConfirmation (name: string, args: any): boolean {
  if (name === 'huly_api') return args?.dryRun === false && !(HULY_API_READ as readonly string[]).includes(String(args?.method ?? ''))
  return isRisky(name) && args?.dryRun !== true
}

/**
 * MCP tool annotations: reads are read-only; deletes, removals and the risky tools above are
 * destructive; every other change (create, add, update, set, …) is marked non-destructive —
 * the MCP default for a write tool is "destructive", which would over-warn.
 * Off by default (HULY_ANNOTATIONS=1): they add ~16% to tools/list in every session.
 */
export function toolAnnotations (tool: ToolDef): { title: string, readOnlyHint?: boolean, destructiveHint?: boolean } {
  const title = tool.name.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
  if (!isMutation(tool)) return { title, readOnlyHint: true }
  return { title, destructiveHint: isRisky(tool.name) || /^(remove|revoke)_/.test(tool.name) }
}

export type ConfirmMode = 'auto' | 'off' | 'strict'

export function parseConfirmMode (value: string | undefined): ConfirmMode {
  const v = (value ?? 'auto').trim().toLowerCase()
  if (v === 'auto' || v === 'off' || v === 'strict') return v
  throw new Error(`HULY_CONFIRM must be auto, off or strict (got '${value ?? ''}').`)
}

/** What the confirm callback can do with the connected client. */
export interface Asker {
  /** True when the client can show a form (MCP elicitation). */
  canAsk: () => boolean
  /** Shows the question; resolves true only on an explicit yes. */
  ask: (message: string) => Promise<boolean>
}

/** One readable line per argument, without the workspace and with long values cut. */
export function describeCall (tool: ToolDef, args: Record<string, unknown>): string {
  const parts = Object.entries(args ?? {})
    .filter(([k, v]) => k !== 'workspace' && v != null && k !== 'confirm')
    .map(([k, v]) => `${k}: ${JSON.stringify(shorten(v)).slice(0, 160)}`)
  const ws = typeof args?.workspace === 'string' ? ` in workspace ${args.workspace}` : ''
  return `Huly: ${tool.name.replace(/_/g, ' ')}${ws}?\n${parts.join('\n')}`
}

/** MCP elicitation on top of an McpServer. */
export function elicitationAsker (server: any): Asker {
  return {
    canAsk: () => server.server.getClientCapabilities()?.elicitation?.form != null,
    ask: async (message) => {
      const res = await server.server.elicitInput({
        mode: 'form',
        message,
        requestedSchema: { type: 'object', properties: { confirm: { type: 'boolean', title: 'Yes, do it', default: false } }, required: ['confirm'] }
      })
      return res.action === 'accept' && res.content?.confirm === true
    }
  }
}

/** Keeps the undo entry of one write call, with each touched document's state right after it. */
async function remember (owner: object, tool: ToolDef, args: any, steps: UndoStep[], error: unknown): Promise<void> {
  const after: Record<string, { _class: string, modifiedOn: number | null }> = {}
  try {
    const client: any = await getConnection(args?.workspace)
    for (const s of steps) {
      if (after[s.target._id] != null) continue
      const doc = s.kind === 'deleted' ? undefined : await client.findOne(s.target._class, { _id: s.target._id }).catch(() => undefined)
      after[s.target._id] = { _class: s.target._class, modifiedOn: doc?.modifiedOn ?? null }
    }
  } catch { /* without the after-state undo still works, it just cannot warn about later edits */ }
  addEntry(owner, { tool: tool.name, workspace: args?.workspace, at: Date.now(), steps, after, failed: error != null ? (error as Error).message : undefined })
}

/** Wraps a handler with the write scope check, the confirmation for risky tools and the audit log. */
export function guard (tool: ToolDef, env: NodeJS.ProcessEnv = process.env, asker?: Asker): ToolDef['handler'] {
  const allowed = parseWriteProjects(env.HULY_WRITE_PROJECTS)
  const auditPath = env.HULY_AUDIT_LOG
  const confirm = parseConfirmMode(env.HULY_CONFIRM)
  return async (args) => {
    assertWriteAllowed(tool, args, allowed)
    if (confirm !== 'off' && needsConfirmation(tool.name, args)) {
      const canAsk = asker?.canAsk() === true
      if (!canAsk && confirm === 'strict') {
        audit(auditPath, tool, args, { ok: false, text: 'refused: HULY_CONFIRM=strict and the client cannot ask' })
        throw new Error(`Huly MCP: ${tool.name} needs a human confirmation (HULY_CONFIRM=strict), but this client cannot ask. Leave it to a person.`)
      }
      if (canAsk) {
        let yes = false
        try { yes = await asker!.ask(describeCall(tool, args as any)) } catch (e) {
          audit(auditPath, tool, args, { ok: false, text: `confirmation failed: ${(e as Error).message}` })
          throw new Error(`Huly MCP: could not ask for confirmation of ${tool.name} (${(e as Error).message}). Nothing was changed.`)
        }
        if (!yes) {
          audit(auditPath, tool, args, { ok: false, text: 'declined by the user' })
          return { content: [{ type: 'text', text: `Cancelled: the user declined ${tool.name}. Nothing was changed — do not retry unless they ask.` }] }
        }
      }
    }
    // Writes are recorded so undo_changes can reverse them (undo itself is not recorded).
    if (isMutation(tool) && tool.name !== 'undo_changes') {
      const owner = getConnectionManager()
      const { result, error, steps } = await recordChanges(async () => await tool.handler(args))
      if (steps.length > 0) await remember(owner, tool, args, steps, error)
      if (error != null) {
        audit(auditPath, tool, args, { ok: false, text: (error as Error).message })
        throw error
      }
      audit(auditPath, tool, args, { ok: true, text: result!.content[0]?.text ?? '' })
      return result!
    }
    try {
      const result = await tool.handler(args)
      audit(auditPath, tool, args, { ok: true, text: result.content[0]?.text ?? '' })
      return result
    } catch (e) {
      audit(auditPath, tool, args, { ok: false, text: (e as Error).message })
      throw e
    }
  }
}
