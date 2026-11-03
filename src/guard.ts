// Cross-cutting checks around every tool call:
// - HULY_WRITE_PROJECTS: changes are only allowed in the listed projects
// - HULY_AUDIT_LOG: every change is appended as one JSON line to this file
import { appendFileSync } from 'node:fs'
import type { ToolDef } from './registry'

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

/** Wraps a handler with the write scope check and the audit log. */
export function guard (tool: ToolDef, env: NodeJS.ProcessEnv = process.env): ToolDef['handler'] {
  const allowed = parseWriteProjects(env.HULY_WRITE_PROJECTS)
  const auditPath = env.HULY_AUDIT_LOG
  return async (args) => {
    assertWriteAllowed(tool, args, allowed)
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
