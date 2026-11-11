// undo_changes: reverse the last write tool calls made through this server (see utils/undo.ts).
import type { z } from 'zod'
import { getConnection, getConnectionManager } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { journalOf, type UndoEntry, type UndoStep } from '../utils/undo'
import type { UndoChangesSchema } from '../schemas'

const time = (ts: number): string => new Date(ts).toISOString().slice(11, 16)

const VERB: Record<UndoStep['kind'], string> = { created: 'delete', changed: 'restore', deleted: 're-create' }

function describeStep (s: UndoStep): string {
  if (s.kind === 'changed') return `restore ${(s.fields ?? []).join(', ')} on ${s.target.label}`
  return `${VERB[s.kind]} ${s.target.label}`
}

/** Collapse repeated steps on the same object into one line for the plan. */
function planLines (entry: UndoEntry): string[] {
  const seen = new Map<string, string>()
  for (const s of [...entry.steps].reverse()) {
    const key = `${s.kind}:${s.target._id}`
    if (!seen.has(key)) seen.set(key, describeStep(s))
  }
  const lines = [...seen.values()]
  return lines.length > 6 ? [...lines.slice(0, 5), `… ${lines.length - 5} more`] : lines
}

const sameWorkspace = (a: string | undefined, b: string | undefined): boolean =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()

async function applyStep (client: any, s: UndoStep): Promise<'done' | 'skipped'> {
  const exists = async (): Promise<boolean> => (await client.findOne(s.target._class, { _id: s.target._id }).catch(() => undefined)) != null
  switch (s.method) {
    case 'removeDoc':
    case 'removeCollection':
      if (!(await exists())) return 'skipped'
      await client[s.method](...s.args)
      return 'done'
    case 'updateDoc':
    case 'updateMixin':
      if (s.method === 'updateDoc' && !(await exists())) return 'skipped'
      await client[s.method](...s.args)
      return 'done'
    case 'createDoc': {
      if (await exists()) return 'skipped'
      const [_class, space, data, id, mixins] = s.args as [string, string, any, string, Record<string, any>]
      await client.createDoc(_class, space, data, id)
      for (const [mixin, attrs] of Object.entries(mixins ?? {})) await client.createMixin(id, _class, space, mixin, attrs)
      return 'done'
    }
    case 'addCollection': {
      if (await exists()) return 'skipped'
      const [_class, space, attachedTo, attachedToClass, collection, data, id, mixins] = s.args as [string, string, string, string, string, any, string, Record<string, any>]
      await client.addCollection(_class, space, attachedTo, attachedToClass, collection, data, id)
      for (const [mixin, attrs] of Object.entries(mixins ?? {})) await client.createMixin(id, _class, space, mixin, attrs)
      return 'done'
    }
  }
}

export const undoChanges = wrapToolHandler<z.infer<typeof UndoChangesSchema>>(async (args) => {
  const journal = journalOf(getConnectionManager())
  const mine = journal.filter((e) => sameWorkspace(e.workspace, args.workspace))
  if (mine.length === 0) return `Nothing to undo in workspace ${args.workspace} — no changes were made through this server${journal.length > 0 ? ' in this workspace' : ''} since it started.`
  const picked = mine.slice(-args.count).reverse()

  const header = (e: UndoEntry, i: number): string =>
    `${i + 1}. ${time(e.at)} UTC — ${e.tool}${e.failed != null ? ' (failed halfway — undoing the part that was done)' : ''}`

  if (args.dryRun) {
    const out = picked.map((e, i) => [header(e, i), ...planLines(e).map((l) => `   - ${l}`)].join('\n'))
    return `## Undo — dry run (${picked.length} of ${mine.length} change(s) in ${args.workspace})\n\n${out.join('\n')}\n\nRun again with dryRun: false to undo. Activity entries and notifications Huly created stay; file contents that were deleted are not restored.`
  }

  const client: any = await getConnection(args.workspace)
  const touchedByUs = new Set<string>()
  const results: string[] = []
  for (const [i, entry] of picked.entries()) {
    // Someone (or something) changed an object after us? Then undoing would overwrite their work.
    if (!args.force) {
      const changed: string[] = []
      for (const [id, a] of Object.entries(entry.after)) {
        if (touchedByUs.has(id)) continue
        const now = await client.findOne(a._class, { _id: id }).catch(() => undefined)
        const current = now?.modifiedOn ?? null
        if (current !== a.modifiedOn) changed.push(entry.steps.find((s) => s.target._id === id)?.target.label ?? id)
      }
      if (changed.length > 0) {
        results.push(`${header(entry, i)}\n   ⚠️ skipped — changed since: ${changed.join(', ')} (force: true undoes anyway)`)
        // Older entries may build on this one; stop rather than undo out of order.
        break
      }
    }
    let done = 0; let skipped = 0
    for (const step of [...entry.steps].reverse()) {
      if (await applyStep(client, step) === 'done') done++; else skipped++
      touchedByUs.add(step.target._id)
    }
    journal.splice(journal.indexOf(entry), 1)
    // Our own undo changed these objects: older entries must not mistake that for someone else's edit.
    for (const id of new Set(entry.steps.map((s) => s.target._id))) {
      const cls = entry.steps.find((s) => s.target._id === id)!.target._class
      const now = await client.findOne(cls, { _id: id }).catch(() => undefined)
      for (const older of journal) if (older.after[id] != null) older.after[id].modifiedOn = now?.modifiedOn ?? null
    }
    results.push(`${header(entry, i)}\n   ✅ undone (${done} step(s)${skipped > 0 ? `, ${skipped} already in place` : ''}): ${planLines(entry).join('; ')}`)
  }
  return `## Undo in ${args.workspace}\n\n${results.join('\n')}`
})
