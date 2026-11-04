// Processes (process plugin, read-only): process definitions on card types (states and
// transitions) and their running executions. Executions are advanced by Huly's process service.
import { generateId, SortingOrder } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { formatDate } from '../utils/format'
import { labelText } from '../utils/attributes'
import type { z } from 'zod'
import type * as S from '../schemas'

export const PR = { Process: 'process:class:Process', State: 'process:class:State', Transition: 'process:class:Transition', Execution: 'process:class:Execution', Log: 'process:class:ExecutionLog', ToDo: 'process:class:ProcessToDo' } as const

const trig = (id: string): string => (String(id).split(':').pop() ?? '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()

async function findProcess (client: any, ref: string): Promise<any> {
  const all: any[] = await client.findAll(PR.Process, {})
  const hits = all.filter((p) => p._id === ref || String(p.name).toLowerCase() === ref.trim().toLowerCase())
  if (hits.length !== 1) throw new Error(hits.length === 0 ? `Process '${ref}' not found. Processes: ${all.map((p) => p.name).join(', ') || 'none'}.` : `Process '${ref}' is ambiguous — pass its id.`)
  return hits[0]
}

export const listProcesses = wrapToolHandler<z.infer<typeof S.ListProcessesSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const processes: any[] = await client.findAll(PR.Process, {})
  if (processes.length === 0) return 'No processes defined.'
  const [states, transitions]: any[][] = await Promise.all([client.findAll(PR.State, {}), client.findAll(PR.Transition, {})])
  const h = client.getHierarchy()
  const out: string[] = [`## Processes (${processes.length})`]
  for (const p of processes) {
    let tag = String(p.masterTag)
    try { tag = labelText(h.getClass(p.masterTag).label) } catch { /* custom tag ids */ }
    const st = states.filter((s) => s.process === p._id).sort((a, b) => String(a.rank).localeCompare(String(b.rank)))
    const title = (id: string | null): string => id == null ? 'start' : String(st.find((s) => s._id === id)?.title ?? '?')
    const flags = [p.autoStart === true ? 'auto-start' : undefined, p.parallelExecutionForbidden === true ? 'one at a time' : undefined, p.automationOnly === true ? 'automation only' : undefined].filter((x) => x != null)
    out.push('', `### ${String(p.name)} — on ${tag}${flags.length > 0 ? ` (${flags.join(', ')})` : ''} \`${String(p._id)}\``)
    if (p.description != null && p.description !== '') out.push(String(p.description))
    out.push(`States: ${st.map((s) => s.title).join(' → ') || '—'}`)
    for (const t of transitions.filter((x) => x.process === p._id).sort((a, b) => String(a.rank).localeCompare(String(b.rank)))) {
      out.push(`- ${title(t.from)} → ${title(t.to)} · when ${trig(t.trigger)}${(t.actions ?? []).length > 0 ? ` · ${(t.actions as any[]).length} action(s)` : ''}`)
    }
  }
  return out.join('\n')
})

export const listExecutions = wrapToolHandler<z.infer<typeof S.ListExecutionsSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const query: Record<string, unknown> = {}
  if (args.process != null) query.process = (await findProcess(client, args.process))._id
  if (args.status != null) query.status = args.status
  const execs: any[] = await client.findAll(PR.Execution, query, { sort: { modifiedOn: SortingOrder.Descending }, limit: args.limit ?? 30 })
  if (execs.length === 0) return 'No process executions.'
  const [processes, states, cards]: any[][] = await Promise.all([
    client.findAll(PR.Process, {}),
    client.findAll(PR.State, {}),
    client.findAll('card:class:Card', { _id: { $in: [...new Set(execs.map((e) => e.card))] } })
  ])
  const lines = execs.map((e) => {
    const card = cards.find((c) => c._id === e.card)
    const state = e.currentState != null ? String(states.find((s) => s._id === e.currentState)?.title ?? '?') : 'not started'
    const err = (e.error ?? []).length > 0 ? ' · ⚠️ error, waiting' : ''
    return `- **${String(processes.find((p) => p._id === e.process)?.name ?? '?')}** on "${String(card?.title ?? e.card)}" — ${String(e.status)} · state ${state}${err} · ${formatDate(e.modifiedOn)} — \`${String(e._id)}\``
  })
  return `## Executions (${execs.length})\n\n${lines.join('\n')}`
})

/** True when a transition needs input that only Huly's UI can ask for (a "${...userRequest...}" param). */
export function needsUserInput (transition: any): boolean {
  const asks = (v: unknown): boolean => {
    if (typeof v === 'string') {
      const i = v.indexOf('${'); const j = v.lastIndexOf('}')
      if (i === -1 || j <= i) return false
      try { return JSON.parse(v.substring(i + 1, j + 1))?.type === 'userRequest' } catch { return false }
    }
    if (Array.isArray(v)) return v.some(asks)
    if (v != null && typeof v === 'object') return Object.values(v).some(asks)
    return false
  }
  return (transition?.actions ?? []).some((a: any) => a != null && asks(a.params))
}

// Like Huly's "Run process" menu (process-resources createExecution): a new Execution in the card's
// space without a state; Huly's process service then follows the start transition.
export const startProcess = wrapToolHandler<z.infer<typeof S.StartProcessSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const proc = await findProcess(client, args.process)
  if (proc.automationOnly === true) throw new Error(`Process '${String(proc.name)}' only runs from automations.`)
  const card = await client.findOne('card:class:Card', { _id: args.card })
  if (card == null) throw new Error(`Card '${args.card}' not found (pass its id, see list_cards).`)
  const h = client.getHierarchy()
  const fits = h.isDerived(card._class, proc.masterTag) || (h.isMixin(proc.masterTag) === true && h.hasMixin(card, proc.masterTag) === true)
  if (!fits) throw new Error(`Process '${String(proc.name)}' does not apply to this card's type.`)
  const start = (await client.findAll(PR.Transition, { process: proc._id, from: null }))[0]
  if (start == null) throw new Error(`Process '${String(proc.name)}' has no start transition.`)
  if (needsUserInput(start)) throw new Error(`Starting '${String(proc.name)}' asks for input that only the Huly app can collect — start it there.`)
  if (proc.parallelExecutionForbidden === true) {
    const running = await client.findOne(PR.Execution, { process: proc._id, card: card._id, status: 'active' })
    if (running != null) throw new Error(`'${String(proc.name)}' is already running on this card (\`${String(running._id)}\`).`)
  }
  if (args.dryRun === true) return `Dry run: would start **${String(proc.name)}** on "${String(card.title)}". Nothing was changed.`
  const id = generateId()
  await client.createDoc(PR.Execution, card.space, { process: proc._id, currentState: null, card: card._id, rollback: [], context: {}, status: 'active' }, id)
  return `✅ Started **${String(proc.name)}** on "${String(card.title)}" — \`${id}\`. Huly's process service moves it on; check with list_executions.`
})

export const cancelExecution = wrapToolHandler<z.infer<typeof S.CancelExecutionSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const exec = await client.findOne(PR.Execution, { _id: args.execution })
  if (exec == null) throw new Error(`Execution '${args.execution}' not found (ids from list_executions).`)
  if (exec.status !== 'active') throw new Error(`Execution is already ${String(exec.status)}.`)
  const proc = await client.findOne(PR.Process, { _id: exec.process })
  if (args.dryRun === true) return `Dry run: would cancel **${String(proc?.name ?? '?')}** \`${String(exec._id)}\`. Nothing was changed.`
  await client.updateDoc(PR.Execution, exec.space, exec._id, { status: 'cancelled' })
  return `🛑 Cancelled **${String(proc?.name ?? '?')}** \`${String(exec._id)}\`.`
})
