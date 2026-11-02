import { SortingOrder } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { C } from '../utils/classes'
import { markupToText } from '../utils/format'
import { socialIdNames } from '../utils/people'
import { loadLabel, resolveObject } from '../utils/resolve'
import type { z } from 'zod'
import type { GetActivitySchema } from '../schemas'

const when = (ts: number): string => new Date(ts).toISOString().slice(0, 16).replace('T', ' ')

async function describeValue (client: any, attrClass: string | undefined, value: unknown): Promise<string> {
  if (value == null) return '—'
  if (typeof value === 'string' && attrClass != null && attrClass.includes(':class:') && !attrClass.startsWith('core:class:Type')) {
    const label = await loadLabel(client, attrClass, value)
    return label === value ? value : label.replace(/^[A-Z]+-\d+: /, '')
  }
  if (typeof value === 'number' && value > 1e12) return when(value)
  if (typeof value === 'string') return markupToText(value).slice(0, 80)
  return JSON.stringify(value).slice(0, 80)
}

export const getActivity = wrapToolHandler<z.infer<typeof GetActivitySchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const obj = await resolveObject(client, args.object)

  const messages: any[] = await client.findAll(C.ActivityMessage, { attachedTo: obj._id }, { sort: { createdOn: SortingOrder.Descending }, limit: args.limit })
  if (messages.length === 0) return `No activity for ${obj.label}.`
  messages.reverse()

  const who = await socialIdNames(client, [...new Set(messages.map((m) => m.createdBy).filter((x) => x != null))])
  const lines: string[] = []
  for (const m of messages) {
    const by = who.get(m.createdBy) ?? 'System'
    let what: string
    if (m._class === C.DocUpdateMessage) {
      const u = m.attributeUpdates
      if (m.action === 'create') what = 'created'
      else if (m.action === 'remove') what = `removed ${String(m.objectClass ?? '').split(':').pop() ?? ''}`
      else if (u != null) {
        const set = await Promise.all((u.set ?? []).map(async (v: unknown) => await describeValue(client, u.attrClass, v)))
        const added = await Promise.all((u.added ?? []).map(async (v: unknown) => await describeValue(client, u.attrClass, v)))
        const removed = await Promise.all((u.removed ?? []).map(async (v: unknown) => await describeValue(client, u.attrClass, v)))
        what = `${u.attrKey as string}: ${[set.length > 0 ? `→ ${set.join(', ')}` : '', added.length > 0 ? `+ ${added.join(', ')}` : '', removed.length > 0 ? `− ${removed.join(', ')}` : ''].filter(Boolean).join(' ') || 'changed'}`
      } else what = `updated ${String(m.objectClass ?? '').split(':').pop() ?? ''}`
    } else if (typeof m.message === 'string') {
      what = `💬 ${markupToText(m.message).slice(0, 200)}${(m.replies ?? 0) > 0 ? ` (${m.replies as number} replies)` : ''} \`${m._id as string}\``
    } else {
      what = String(m._class).split(':').pop() ?? 'activity'
    }
    lines.push(`- ${when(m.createdOn)} **${by}** ${what}`)
  }
  return `## Activity of ${obj.label} (last ${messages.length})\n\n${lines.join('\n')}`
})
