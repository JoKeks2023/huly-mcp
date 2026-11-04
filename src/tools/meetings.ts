// Meetings (love plugin, read-only): office rooms, meeting minutes per room and their transcripts.
// Transcripts are chat messages in the minutes' 'transcription' collection, one per utterance.
import { SortingOrder } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { markupToText } from '../utils/format'
import { readMarkup } from '../utils/content'
import { socialIdNames } from '../utils/people'
import type { z } from 'zod'
import type * as S from '../schemas'

export const LOVE = { Room: 'love:class:Room', Office: 'love:class:Office', Minutes: 'love:class:MeetingMinutes', Message: 'chunter:class:ChatMessage', Collaborator: 'core:class:Collaborator' } as const
const ROOM_TYPE = ['video', 'audio', 'reception']
const ACCESS = ['open', 'knock', 'do not disturb']

const when = (ts: number | undefined): string => ts == null ? '?' : new Date(ts).toISOString().slice(0, 16).replace('T', ' ')

export const listMeetings = wrapToolHandler<z.infer<typeof S.ListMeetingsSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const rooms: any[] = await client.findAll(LOVE.Room, {})
  const query: Record<string, unknown> = {}
  if (args.room != null) {
    const q = args.room.trim().toLowerCase()
    const hits = rooms.filter((r) => r._id === args.room || String(r.name).toLowerCase() === q)
    if (hits.length !== 1) throw new Error(hits.length === 0 ? `Room '${args.room}' not found. Rooms: ${rooms.map((r) => r.name).join(', ')}.` : `Room '${args.room}' is ambiguous.`)
    query.attachedTo = hits[0]._id
  }
  if (args.since != null) {
    const t = Date.parse(args.since)
    if (Number.isNaN(t)) throw new Error(`since must be a date, got '${args.since}'.`)
    query.createdOn = { $gte: t }
  }
  const minutes: any[] = await client.findAll(LOVE.Minutes, query, { sort: { createdOn: SortingOrder.Descending }, limit: args.limit ?? 20 })
  const roomLines = rooms.filter((r) => r._class !== LOVE.Office || args.includeOffices === true)
    .map((r) => `- ${String(r.name)} (${ROOM_TYPE[r.type] ?? r.type}, ${ACCESS[r.access] ?? r.access}${r.startWithTranscription === true ? ', transcribed' : ''}) · ${Number(r.meetings ?? 0)} meeting(s)`)
  const out = [`## Rooms (${roomLines.length})`, ...roomLines, '', `## Meetings (${minutes.length})`]
  if (minutes.length === 0) out.push('No meeting minutes yet.')
  for (const m of minutes) {
    const room = rooms.find((r) => r._id === m.attachedTo)
    const dur = m.meetingEnd != null ? ` – ${when(m.meetingEnd).slice(11)}` : m.status === 0 ? ' (running)' : ''
    out.push(`- **${String(m.title)}** · ${String(room?.name ?? '?')} · ${when(m.createdOn)}${dur} · ${Number(m.transcription ?? 0)} transcript line(s), ${Number(m.todos ?? 0)} action item(s) — \`${String(m._id)}\``)
  }
  return out.join('\n')
})

export const getMeeting = wrapToolHandler<z.infer<typeof S.GetMeetingSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const m = await client.findOne(LOVE.Minutes, { _id: args.id })
  if (m == null) throw new Error(`Meeting '${args.id}' not found (ids come from list_meetings).`)
  const room = await client.findOne(LOVE.Room, { _id: m.attachedTo })
  const [collabs, todos, lines]: any[][] = await Promise.all([
    client.findAll(LOVE.Collaborator, { attachedTo: m._id }),
    client.findAll('time:class:ToDo', { attachedTo: m._id }),
    args.transcript === false ? Promise.resolve([]) : client.findAll(LOVE.Message, { attachedTo: m._id, collection: 'transcription' }, { sort: { createdOn: SortingOrder.Ascending }, limit: args.limit ?? 500 })
  ])
  const persons: any[] = collabs.length > 0 ? await client.findAll('contact:class:Person', { personUuid: { $in: collabs.map((c) => c.collaborator) } }) : []
  const speakers = await socialIdNames(client, [...new Set(lines.map((l) => l.createdBy).filter((x) => x != null))])
  const notes = await readMarkup(args.workspace, m.description)
  const out = [
    `## ${String(m.title)}`,
    `**Room:** ${String(room?.name ?? '?')} · **Start:** ${when(m.createdOn)} · **End:** ${m.meetingEnd != null ? when(m.meetingEnd) : m.status === 0 ? 'running' : '?'}`,
    `**Participants:** ${persons.length > 0 ? persons.map((p) => String(p.name).split(',').reverse().join(' ').trim()).join(', ') : `${collabs.length}`}`
  ]
  if (notes.trim() !== '') out.push('', '### Notes', notes.trim())
  if (todos.length > 0) out.push('', '### Action items', ...todos.map((t) => `- [${t.doneOn != null ? 'x' : ' '}] ${String(t.title)}`))
  if (args.transcript !== false) {
    out.push('', `### Transcript (${lines.length}${lines.length === (args.limit ?? 500) ? '+' : ''})`)
    if (lines.length === 0) out.push('_(none)_')
    for (const l of lines) out.push(`[${when(l.createdOn).slice(11)}] **${speakers.get(l.createdBy) ?? '?'}:** ${markupToText(l.message).trim()}`)
  }
  return out.join('\n')
})
