// Command line for every Huly tool: `huly-mcp <tool> --param value`.
//
// The parameters come from the same zod schemas the MCP server sends to Claude (via JSON Schema),
// so the CLI can never drift from the tools. Calls go through the same guard: write scope
// (HULY_WRITE_PROJECTS), the confirmation for hard-to-undo tools and the audit log.
import { readFileSync } from 'fs'
import { createInterface } from 'readline'
import { z } from 'zod'
import { TOOLS, TOOLSETS, type ToolDef } from './registry'
import { guard, isMutation, isRisky, needsConfirmation, type Asker } from './guard'
import { normalizeArguments, aliasTarget } from './server'
import { parseEnvFile } from './watch'
import { closeConnection } from './connection'
import { packageVersion } from './tools/diagnostics'

// ── Parameters from the schema ─────────────────────────────────────────────────

type Kind = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null'

export interface Param {
  name: string
  kinds: Set<Kind>
  required: boolean
  enum?: string[]
  default?: unknown
  description?: string
  /** Kind of the array items (arrays of scalars can be given by repeating the flag). */
  items?: Set<Kind>
}

function kindsOf (node: any, out = new Set<Kind>()): Set<Kind> {
  if (node == null || typeof node !== 'object') { out.add('string'); return out }
  const t = node.type
  if (Array.isArray(t)) for (const k of t) out.add(k as Kind)
  else if (typeof t === 'string') out.add(t as Kind)
  for (const alt of [...(node.anyOf ?? []), ...(node.oneOf ?? [])]) kindsOf(alt, out)
  if (out.size === 0) out.add(node.enum != null ? 'string' : 'object')
  return out
}

function enumOf (node: any): string[] | undefined {
  if (Array.isArray(node?.enum)) return node.enum.map(String)
  for (const alt of [...(node?.anyOf ?? []), ...(node?.oneOf ?? [])]) { const e = enumOf(alt); if (e != null) return e }
  return undefined
}

function itemsOf (node: any): any {
  if (node?.items != null) return node.items
  for (const alt of [...(node?.anyOf ?? []), ...(node?.oneOf ?? [])]) { const i = itemsOf(alt); if (i != null) return i }
  return undefined
}

const cache = new Map<string, Param[]>()

export function paramsOf (tool: ToolDef): Param[] {
  const hit = cache.get(tool.name)
  if (hit != null) return hit
  const schema: any = z.toJSONSchema(tool.schema, { io: 'input', unrepresentable: 'any' })
  const required = new Set<string>(schema.required ?? [])
  const params = Object.entries<any>(schema.properties ?? {}).map(([name, node]) => {
    const items = itemsOf(node)
    return {
      name,
      kinds: kindsOf(node),
      required: required.has(name),
      enum: enumOf(node),
      default: node.default,
      description: node.description ?? (name === 'workspace' ? 'Workspace slug, name or id (or set HULY_WORKSPACE)' : undefined),
      items: items != null ? kindsOf(items) : undefined
    }
  })
  cache.set(tool.name, params)
  return params
}

// ── Names ─────────────────────────────────────────────────────────────────────

export const kebab = (s: string): string => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
const camel = (s: string): string => s.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase())

export function findTool (name: string): ToolDef | undefined {
  const n = name.trim().toLowerCase().replace(/-/g, '_')
  return TOOLS.find((t) => t.name === n)
}

function closest (word: string, candidates: string[]): string[] {
  const w = word.toLowerCase()
  const dist = (a: string, b: string): number => {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
    for (let j = 1; j <= b.length; j++) d[0][j] = j
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    return d[a.length][b.length]
  }
  return candidates
    .map((c) => ({ c, s: c.includes(w) || w.includes(c) ? 0 : dist(w, c) }))
    .filter((x) => x.s <= Math.max(2, Math.floor(w.length / 3)))
    .sort((a, b) => a.s - b.s)
    .slice(0, 3)
    .map((x) => x.c)
}

// ── Values ────────────────────────────────────────────────────────────────────

export class UsageError extends Error {}

function scalar (p: Param, raw: string, kinds: Set<Kind>, flag: string): unknown {
  if (raw === 'null' && kinds.has('null')) return null
  if (kinds.has('boolean')) {
    const v = raw.toLowerCase()
    if (['true', 'yes', '1', 'on'].includes(v)) return true
    if (['false', 'no', '0', 'off'].includes(v)) return false
    if (kinds.size === 1 || (kinds.size === 2 && kinds.has('null'))) throw new UsageError(`${flag} expects true or false, got '${raw}'.`)
  }
  if (kinds.has('integer') || kinds.has('number')) {
    const n = Number(raw)
    if (raw.trim() !== '' && Number.isFinite(n)) {
      if (kinds.has('integer') && !kinds.has('number') && !Number.isInteger(n)) throw new UsageError(`${flag} expects a whole number, got '${raw}'.`)
      return n
    }
    if (!kinds.has('string')) throw new UsageError(`${flag} expects a number, got '${raw}'.`)
  }
  if (kinds.has('object') && !kinds.has('string')) {
    try { return JSON.parse(raw) } catch { throw new UsageError(`${flag} expects JSON, e.g. ${flag} '{"title":"…"}'.`) }
  }
  if (p.enum != null && !p.enum.includes(raw)) {
    const hint = closest(raw, p.enum)
    throw new UsageError(`${flag}: '${raw}' is not allowed. Use one of: ${p.enum.join(', ')}.${hint.length > 0 && !p.enum.includes(raw) ? ` Did you mean ${hint[0]}?` : ''}`)
  }
  return raw
}

/** Turns the raw strings given for one parameter into the value the schema wants. */
export function coerce (p: Param, raws: string[]): unknown {
  const flag = `--${kebab(p.name)}`
  if (p.kinds.has('array')) {
    if (raws.length === 1 && raws[0].trim().startsWith('[')) {
      try { return JSON.parse(raws[0]) } catch { throw new UsageError(`${flag}: invalid JSON array.`) }
    }
    if (raws.length === 1 && raws[0] === 'null' && p.kinds.has('null')) return null
    const items = p.items ?? new Set<Kind>(['string'])
    return raws.map((r) => scalar({ ...p, enum: undefined }, r, items, flag))
  }
  if (raws.length > 1) throw new UsageError(`${flag} was given ${raws.length} times; it takes one value.`)
  return scalar(p, raws[0], p.kinds, flag)
}

// ── Command line ──────────────────────────────────────────────────────────────

export interface Parsed {
  command?: string
  positionals: string[]
  flags: Map<string, string[]>
  workspace?: string
  envFile?: string
  input?: string
  json?: string
  format: 'text' | 'json'
  yes: boolean
  help: boolean
}

const GLOBAL_WITH_VALUE = new Set(['workspace', 'w', 'env-file', 'input', 'json', 'format'])

export function parseArgv (argv: string[]): Parsed {
  const out: Parsed = { positionals: [], flags: new Map(), format: 'text', yes: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') { out.positionals.push(...argv.slice(i + 1)); break }
    if (a === '-h' || a === '--help') { out.help = true; continue }
    if (a === '-y' || a === '--yes') { out.yes = true; continue }
    if (a.startsWith('-') && a !== '-') {
      const body = a.replace(/^--?/, '')
      const eq = body.indexOf('=')
      const name = eq >= 0 ? body.slice(0, eq) : body
      let value: string | undefined = eq >= 0 ? body.slice(eq + 1) : undefined
      const takesValue = (): string => {
        if (value !== undefined) return value
        const next = argv[i + 1]
        if (next == null) throw new UsageError(`--${name} needs a value.`)
        i++
        return next
      }
      if (GLOBAL_WITH_VALUE.has(name)) {
        const v = takesValue()
        if (name === 'workspace' || name === 'w') out.workspace = v
        else if (name === 'env-file') out.envFile = v
        else if (name === 'input') out.input = v
        else if (name === 'json') out.json = v
        else if (name === 'format') {
          if (v !== 'text' && v !== 'json') throw new UsageError('--format must be text or json.')
          out.format = v
        }
        continue
      }
      if (name.startsWith('no-') && value === undefined) { push(out.flags, name.slice(3), 'false'); continue }
      // A flag without "=value" takes the next word unless that is another flag (then it is a boolean switch).
      if (value === undefined) {
        const next = argv[i + 1]
        if (next != null && !(next.startsWith('-') && next.length > 1 && !/^-\d/.test(next))) { value = next; i++ } else value = 'true'
      }
      push(out.flags, name, value)
      continue
    }
    if (out.command == null) out.command = a
    else out.positionals.push(a)
  }
  return out
}

function push (m: Map<string, string[]>, k: string, v: string): void { m.set(k, [...(m.get(k) ?? []), v]) }

export interface Io {
  env: NodeJS.ProcessEnv
  out: (text: string) => void
  err: (text: string) => void
  readFile: (path: string) => string
  /** Interactive confirmation; undefined when stdin is not a terminal. */
  confirm?: (message: string) => Promise<boolean>
}

/** Builds the tool arguments from flags, --json, --input and a positional (for tools with one required parameter). */
export function buildArgs (tool: ToolDef, parsed: Parsed, io: Io): Record<string, unknown> {
  const params = paramsOf(tool)
  const byName = new Map(params.map((p) => [p.name, p]))
  let args: Record<string, unknown> = {}
  const fromJson = (text: string, where: string): void => {
    let v: unknown
    try { v = JSON.parse(text) } catch { throw new UsageError(`${where} is not valid JSON.`) }
    if (v == null || typeof v !== 'object' || Array.isArray(v)) throw new UsageError(`${where} must be a JSON object of parameters.`)
    args = { ...args, ...(v as Record<string, unknown>) }
  }
  if (parsed.input != null) fromJson(parsed.input === '-' ? io.readFile('/dev/stdin') : io.readFile(parsed.input), `--input ${parsed.input}`)
  if (parsed.json != null) fromJson(parsed.json, '--json')

  for (const [rawName, values] of parsed.flags) {
    const fileFlag = rawName.endsWith('-file') ? camel(rawName.slice(0, -5)) : undefined
    if (fileFlag != null && byName.get(fileFlag)?.kinds.has('string') === true) {
      if (values.length > 1) throw new UsageError(`--${rawName} was given more than once.`)
      if (parsed.flags.has(kebab(fileFlag)) || parsed.flags.has(fileFlag)) throw new UsageError(`Pass either --${kebab(fileFlag)} or --${rawName}, not both.`)
      try { args[fileFlag] = io.readFile(values[0]) } catch (e) { throw new UsageError(`--${rawName}: cannot read ${values[0]} (${(e as Error).message}).`) }
      continue
    }
    const name = camel(rawName)
    const target = byName.has(name) ? name : aliasTarget(tool.name, name, new Set(byName.keys()))
    if (target == null) {
      const flags = params.filter((p) => p.name !== 'workspace').map((p) => `--${kebab(p.name)}`)
      const hint = closest(`--${rawName}`, flags)
      throw new UsageError(`Unknown option --${rawName} for ${tool.name}.${hint.length > 0 ? ` Did you mean ${hint[0]}?` : ''} See: huly-mcp help ${tool.name}`)
    }
    const param = byName.get(target)!
    const boolOnly = [...param.kinds].every((k) => k === 'boolean' || k === 'null')
    const literal = /^(true|false|yes|no|on|off|1|0|null)$/i
    if (boolOnly && values.length === 1 && !literal.test(values[0])) {
      // "--dry-run PROJ-12": the switch is on, the word after it is a positional value.
      args[target] = true
      parsed.positionals.push(values[0])
      continue
    }
    args[target] = coerce(param, values)
  }

  if (parsed.positionals.length > 0) {
    const open = params.filter((p) => p.required && p.name !== 'workspace' && args[p.name] === undefined)
    if (open.length !== 1 || parsed.positionals.length > 1) {
      throw new UsageError(`Unexpected argument '${parsed.positionals[0]}'. Pass parameters as --name value (see: huly-mcp help ${tool.name}).`)
    }
    args[open[0].name] = coerce(open[0], parsed.positionals)
  }

  const ws = parsed.workspace ?? ((io.env.HULY_WORKSPACE ?? '').trim() || undefined)
  if (ws != null && byName.has('workspace') && args.workspace === undefined) args.workspace = ws

  const known = new Set(params.map((p) => p.name))
  const normalized = normalizeArguments(tool.name, args, known)
  if ('error' in normalized) throw new UsageError(normalized.error.replace(' Nothing was done.', ''))
  return normalized.args
}

/** zod issues as "--flag: message" lines. */
function explain (tool: ToolDef, error: z.ZodError): string {
  const lines = error.issues.map((i) => {
    const key = String(i.path[0] ?? '')
    if (key === 'workspace' && i.code === 'invalid_type') return '--workspace is required for changes (or set HULY_WORKSPACE).'
    const where = key !== '' ? `--${kebab(key)}${i.path.length > 1 ? ` (${i.path.slice(1).join('.')})` : ''}` : tool.name
    return `${where}: ${i.message}`
  })
  return `${lines.join('\n')}\nSee: huly-mcp help ${tool.name}`
}

// ── Help texts ────────────────────────────────────────────────────────────────

function typeLabel (p: Param): string {
  if (p.enum != null) return p.enum.join('|')
  if (p.kinds.has('array')) return `${[...(p.items ?? ['string'])].filter((k) => k !== 'null').join('|')}…`
  const k = [...p.kinds].filter((x) => x !== 'null')
  if (k.includes('object')) return 'json'
  return k.join('|') || 'value'
}

export function toolHelp (tool: ToolDef): string {
  const params = paramsOf(tool)
  const kind = !isMutation(tool) ? 'reads only' : isRisky(tool.name) ? 'changes data — hard to undo, asks first (or --yes)' : 'changes data'
  const required = params.filter((p) => p.required && p.name !== 'workspace')
  const positional = required.length === 1 ? ` <${kebab(required[0].name)}>` : ''
  const rows = params.map((p) => {
    const flag = `--${kebab(p.name)} <${typeLabel(p)}>`
    const notes = [
      p.required && !(p.name === 'workspace') ? 'required' : p.name === 'workspace' && isMutation(tool) ? 'required (or HULY_WORKSPACE)' : undefined,
      p.kinds.has('null') ? 'null clears/none' : undefined,
      p.default !== undefined ? `default ${JSON.stringify(p.default)}` : undefined,
      p.kinds.has('array') && !(p.items?.has('object') ?? false) ? 'repeat the flag for more' : undefined
    ].filter(Boolean).join(', ')
    return { flag, text: [p.description, notes !== '' ? `(${notes})` : ''].filter((x) => x != null && x !== '').join(' ') }
  })
  const width = Math.min(44, Math.max(...rows.map((r) => r.flag.length), 10))
  const lines = rows.map((r) => `  ${r.flag.padEnd(width)}  ${r.text}`)
  const example = required.length === 1
    ? `huly-mcp ${tool.name} ${required[0].name === 'identifier' ? 'PROJ-12' : `<${kebab(required[0].name)}>`}`
    : `huly-mcp ${tool.name} ${required.map((p) => `--${kebab(p.name)} ${p.enum?.[0] ?? (p.kinds.has('array') || p.kinds.has('object') ? "'…'" : '…')}`).join(' ')}`.trim()
  return [
    `${tool.name} — ${tool.description}`,
    `Toolset: ${tool.toolset} · ${kind}`,
    '',
    `Usage: huly-mcp ${tool.name}${positional} [options]`,
    '',
    'Parameters:',
    ...lines,
    '',
    'Also: --json \'{…}\' or --input file.json (- = stdin) for all parameters at once; --<text-param>-file <path> reads a text value from a file.',
    '',
    `Example: ${example}`
  ].join('\n')
}

export function mainHelp (): string {
  return `huly-mcp — Huly from the command line, the same ${TOOLS.length} tools the MCP server offers.

Usage:
  huly-mcp tools [search] [--toolset <name>]   list tools
  huly-mcp help <tool>                         parameters of one tool
  huly-mcp <tool> [<value>] [--param value …]  run a tool
  huly-mcp completion bash|zsh                 shell completion (eval "$(huly-mcp completion zsh)")
  huly-mcp --version                           version

Server and helpers:
  huly-mcp                                     MCP server over stdio (what MCP clients start)
  huly-mcp http [--port 8000]                  MCP server over HTTP for a team
  huly-mcp setup                               get a token for Google/GitHub accounts
  huly-mcp watch …                             hand Huly issues to Claude
  huly-mcp junit report.xml --project …        CI test results into Huly

Options for tools:
  -w, --workspace <slug>    workspace (or HULY_WORKSPACE)
  --format text|json        json: {"ok":…,"tool":…,"text":…} for scripts
  -y, --yes                 confirm hard-to-undo changes without asking
  --env-file <file>         load HULY_* settings from a file
  --json '{…}' / --input f  parameters as JSON

Login comes from the environment, as for the server: HULY_EMAIL + HULY_PASSWORD or HULY_TOKEN,
self-hosted also HULY_ACCOUNTS_URL and HULY_FRONT_URL. Write scope (HULY_WRITE_PROJECTS) and the
audit log (HULY_AUDIT_LOG) apply here too.

Exit codes: 0 ok · 1 the tool failed or was cancelled · 2 wrong usage.`
}

export function toolsList (search: string | undefined, toolset: string | undefined): string {
  const q = search?.toLowerCase()
  if (toolset != null && !(TOOLSETS as readonly string[]).includes(toolset)) throw new UsageError(`Unknown toolset '${toolset}'. Toolsets: ${TOOLSETS.join(', ')}.`)
  const hits = TOOLS.filter((t) => (toolset == null || t.toolset === toolset) &&
    (q == null || t.name.includes(q.replace(/-/g, '_')) || t.description.toLowerCase().includes(q)))
  if (hits.length === 0) return `No tools match '${search ?? ''}'.`
  const width = Math.max(...hits.map((t) => t.name.length))
  const out: string[] = []
  for (const ts of TOOLSETS) {
    const group = hits.filter((t) => t.toolset === ts)
    if (group.length === 0) continue
    out.push(`${ts}:`)
    for (const t of group) out.push(`  ${t.name.padEnd(width)}  ${isMutation(t) ? (isRisky(t.name) ? '!' : '+') : ' '} ${t.description}`)
  }
  out.push('', `${hits.length} tool(s) · + changes data · ! hard to undo · details: huly-mcp help <tool>`)
  return out.join('\n')
}

// ── Completion ────────────────────────────────────────────────────────────────

const COMMANDS = ['tools', 'help', 'completion', 'version', 'http', 'setup', 'watch', 'junit']

/** Candidates for the word being completed, given the words before it. */
export function complete (words: string[], current: string): string[] {
  const before = words.filter((w) => w !== '')
  const commandIdx = before.findIndex((w, i) => i > 0 && !w.startsWith('-') && !GLOBAL_WITH_VALUE.has((before[i - 1] ?? '').replace(/^--?/, '')))
  const prev = before[before.length - 1] ?? ''
  if (commandIdx < 0) {
    if (current.startsWith('-')) return ['--workspace', '--format', '--yes', '--env-file', '--help'].filter((f) => f.startsWith(current))
    return [...COMMANDS, ...TOOLS.map((t) => t.name)].filter((c) => c.startsWith(current))
  }
  const command = before[commandIdx]
  if (command === 'help') return TOOLS.map((t) => t.name).filter((c) => c.startsWith(current))
  if (command === 'completion') return ['bash', 'zsh'].filter((c) => c.startsWith(current))
  const tool = findTool(command)
  if (tool == null) return []
  const params = paramsOf(tool)
  if (prev.startsWith('--')) {
    const p = params.find((x) => `--${kebab(x.name)}` === prev)
    if (p?.enum != null) return p.enum.filter((e) => e.startsWith(current))
    if (p != null && p.kinds.has('boolean')) return ['true', 'false'].filter((e) => e.startsWith(current))
  }
  if (current.startsWith('-') || current === '') {
    const used = new Set(before.filter((w) => w.startsWith('--')))
    return [...params.map((p) => `--${kebab(p.name)}`), '--format', '--yes']
      .filter((f) => !used.has(f) && f.startsWith(current === '' ? '--' : current))
  }
  return []
}

export function completionScript (shell: string): string {
  const bash = `# huly-mcp completion (bash). Add to ~/.bashrc: eval "$(huly-mcp completion bash)"
_huly_mcp() {
  local IFS=$'\\n'
  COMPREPLY=($(huly-mcp __complete "\${COMP_CWORD}" "\${COMP_WORDS[@]}" 2>/dev/null))
}
complete -o default -F _huly_mcp huly-mcp`
  if (shell === 'bash') return bash
  if (shell === 'zsh') return `# huly-mcp completion (zsh). Add to ~/.zshrc: eval "$(huly-mcp completion zsh)"
autoload -U +X bashcompinit && bashcompinit
${bash}`
  throw new UsageError('completion takes bash or zsh.')
}

// ── Run ───────────────────────────────────────────────────────────────────────

function terminalAsker (io: Io): Asker | undefined {
  if (io.confirm == null) return undefined
  return { canAsk: () => true, ask: io.confirm }
}

/** Runs the CLI; returns the exit code. */
export async function runCli (argv: string[], io: Io): Promise<number> {
  let parsed: Parsed
  try { parsed = parseArgv(argv) } catch (e) { io.err(`${(e as Error).message}\n`); return 2 }
  const fail = (message: string, code: number, tool?: string): number => {
    if (parsed.format === 'json') io.out(JSON.stringify({ ok: false, tool, error: message }) + '\n')
    else io.err(`${message}\n`)
    return code
  }

  try {
    if (parsed.envFile != null) {
      for (const [k, v] of Object.entries(parseEnvFile(io.readFile(parsed.envFile)))) if (io.env[k] == null || io.env[k] === '') io.env[k] = v
    }
    const cmd = parsed.command
    if (cmd === 'version' || (cmd == null && parsed.flags.has('version'))) { io.out(`huly-mcp-selfhost ${packageVersion()}\n`); return 0 }
    if (cmd == null || cmd === 'help') {
      const target = parsed.positionals[0]
      if (target == null) { io.out(mainHelp() + '\n'); return 0 }
      const t = findTool(target)
      if (t == null) return fail(unknownTool(target), 2)
      io.out(toolHelp(t) + '\n')
      return 0
    }
    if (cmd === 'tools') {
      const ts = parsed.flags.get('toolset')?.[0]
      io.out(toolsList(parsed.positionals[0], ts) + '\n')
      return 0
    }
    if (cmd === 'completion') { io.out(completionScript(parsed.positionals[0] ?? '') + '\n'); return 0 }

    const tool = findTool(cmd)
    if (tool == null) return fail(unknownTool(cmd), 2)
    if (parsed.help) { io.out(toolHelp(tool) + '\n'); return 0 }

    const args = buildArgs(tool, parsed, io)
    const checked = tool.schema.safeParse(args)
    if (!checked.success) return fail(explain(tool, checked.error), 2, tool.name)

    // Hard-to-undo tools: ask in a terminal; in scripts only with --yes.
    const env = { ...io.env }
    const risky = needsConfirmation(tool.name, checked.data)
    if (parsed.yes) env.HULY_CONFIRM = 'off'
    else if (risky && io.confirm == null && (env.HULY_CONFIRM ?? 'auto') !== 'off') {
      return fail(`${tool.name} changes data that is hard to undo. Run it in a terminal to confirm, or pass --yes.`, 1, tool.name)
    }
    const handler = guard(tool, env, parsed.yes ? undefined : terminalAsker(io))
    const result: any = await handler(checked.data)
    const text: string = result?.content?.[0]?.text ?? ''
    const cancelled = text.startsWith('Cancelled:')
    if (parsed.format === 'json') io.out(JSON.stringify({ ok: !cancelled, tool: tool.name, text }) + '\n')
    else if (cancelled) io.err(text + '\n')
    else io.out(text.endsWith('\n') ? text : text + '\n')
    return cancelled ? 1 : 0
  } catch (e) {
    if (e instanceof UsageError) return fail(e.message, 2)
    return fail((e as Error).message.replace(/^Huly MCP: /, ''), 1, parsed.command)
  }
}

function unknownTool (name: string): string {
  const hint = closest(name.replace(/-/g, '_'), TOOLS.map((t) => t.name))
  return `Unknown command or tool '${name}'.${hint.length > 0 ? ` Did you mean ${hint.join(', ')}?` : ''} List them with: huly-mcp tools`
}

/** Process entry: real stdin/stdout, terminal confirmation, connections closed at the end. */
export async function main (argv: string[]): Promise<number> {
  if (argv[0] === '__complete') {
    // Called by the shell completion: __complete <cword> <words…>
    const cword = Number(argv[1])
    const words = argv.slice(2)
    for (const c of complete(words.slice(0, cword), words[cword] ?? '')) process.stdout.write(c + '\n')
    return 0
  }
  const interactive = process.stdin.isTTY === true && process.stderr.isTTY === true
  const io: Io = {
    env: process.env,
    out: (t) => { process.stdout.write(t) },
    err: (t) => { process.stderr.write(t) },
    readFile: (p) => readFileSync(p === '/dev/stdin' ? 0 : p, 'utf8'),
    confirm: interactive
      ? async (message) => await new Promise<boolean>((resolve) => {
        const rl = createInterface({ input: process.stdin, output: process.stderr })
        rl.question(`${message}\nProceed? [y/N] `, (a) => { rl.close(); resolve(/^y(es)?$/i.test(a.trim())) })
      })
      : undefined
  }
  const code = await runCli(argv, io)
  await closeConnection().catch(() => {})
  return code
}

