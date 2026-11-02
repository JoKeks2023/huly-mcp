import { SortingOrder, generateId } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { C, IDS, generateEventId } from '../utils/classes'
import { textToMarkup } from '../utils/format'
import { currentPerson, findPerson, peopleNames } from '../utils/people'
import { primaryCalendar } from './planner'
import { loadLabel } from '../utils/resolve'
import type { z } from 'zod'
import type { ListEventsSchema, CreateEventSchema, UpdateEventSchema, DeleteEventSchema } from '../schemas'

const DAY = 86_400_000
const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/

function parse (value: string, label: string): number {
  const t = new Date(value).getTime()
  if (isNaN(t)) throw new Error(`Invalid ${label}: '${value}'`)
  return t
}
const fmt = (ts: number, allDay: boolean): string => allDay ? new Date(ts).toISOString().slice(0, 10) : new Date(ts).toISOString().slice(0, 16).replace('T', ' ')

async function findEvent (client: any, id: string): Promise<any> {
  const ev = await client.findOne(C.Event, { _id: id })
  if (ev == null) throw new Error(`Event '${id}' not found.`)
  return ev
}

export const listEvents = wrapToolHandler<z.infer<typeof ListEventsSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const from = args.from != null ? parse(args.from, 'from') : new Date(new Date().toISOString().slice(0, 10)).getTime()
  const to = args.to != null ? parse(args.to, 'to') + (BARE_DATE.test(args.to) ? DAY - 1 : 0) : from + 7 * DAY - 1
  const events: any[] = await client.findAll(C.Event, { date: { $lte: to }, dueDate: { $gte: from } }, { sort: { date: SortingOrder.Ascending }, limit: args.limit })
  if (events.length === 0) return `No events between ${fmt(from, true)} and ${fmt(to, true)}.`
  const names = await peopleNames(client)
  const lines: string[] = []
  for (const e of events) {
    const span = e.allDay === true ? `${fmt(e.date, true)} (all day)` : `${fmt(e.date, false)}–${new Date(e.dueDate).toISOString().slice(11, 16)}`
    const kind = e._class === C.WorkSlot ? ` · work slot for ${await loadLabel(client, e.attachedToClass, e.attachedTo)}` : ''
    const where = e.location != null && e.location !== '' ? ` · 📍 ${e.location as string}` : ''
    const who = (e.participants ?? []).length > 1 ? ` · ${(e.participants as string[]).map((p) => names.get(p) ?? p).join(', ')}` : ''
    lines.push(`- ${span} **${e.title as string}**${where}${kind}${who} — \`${e._id as string}\``)
  }
  return `## Events ${fmt(from, true)} – ${fmt(to, true)} (${events.length}, times UTC)\n\n${lines.join('\n')}`
})

export const createEvent = wrapToolHandler<z.infer<typeof CreateEventSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const me = await currentPerson(client)
  let date = parse(args.start, 'start')
  let dueDate = args.end != null ? parse(args.end, 'end') : date + 3_600_000
  if (args.allDay) {
    date = new Date(new Date(date).toISOString().slice(0, 10)).getTime()
    dueDate = (args.end != null ? new Date(new Date(dueDate).toISOString().slice(0, 10)).getTime() : date) + DAY - 1
  }
  if (dueDate < date) throw new Error('end must be after start.')
  const participants = [me._id as string]
  for (const name of args.participants ?? []) {
    const p = await findPerson(client, name)
    if (!participants.includes(p._id)) participants.push(p._id)
  }
  const id = generateId()
  // Mirrors Huly's CreateEvent (single, non-recurring event in the user's calendar).
  await client.addCollection(C.Event, IDS.CalendarSpace, IDS.EventNotAttached, C.Event, 'events', {
    calendar: await primaryCalendar(client),
    eventId: generateEventId(id),
    date,
    dueDate,
    externalParticipants: [],
    description: textToMarkup(args.description ?? null),
    visibility: 'public',
    participants,
    reminders: [],
    title: args.title,
    location: args.location ?? '',
    blockTime: !args.allDay,
    allDay: args.allDay,
    timeZone: 'UTC',
    access: 'owner',
    user: client.user
  }, id)
  return `✅ Event **${args.title}** on ${fmt(date, args.allDay)}${args.allDay ? '' : ' UTC'} created (id: \`${id}\`).`
})

export const updateEvent = wrapToolHandler<z.infer<typeof UpdateEventSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const ev = await findEvent(client, args.eventId)
  const updates: Record<string, unknown> = {}
  if (args.title !== undefined) updates.title = args.title
  if (args.location !== undefined) updates.location = args.location
  if (args.description !== undefined) updates.description = textToMarkup(args.description)
  if (args.start !== undefined) {
    const start = parse(args.start, 'start')
    updates.date = start
    // Keep the duration when only the start moves.
    if (args.end === undefined) updates.dueDate = start + (ev.dueDate - ev.date)
  }
  if (args.end !== undefined) updates.dueDate = parse(args.end, 'end')
  if ((updates.dueDate as number ?? ev.dueDate) < (updates.date as number ?? ev.date)) throw new Error('end must be after start.')
  if (Object.keys(updates).length === 0) return `Nothing to update for **${ev.title as string}**.`
  await client.update(ev, updates)
  return `✅ Event **${(updates.title as string | undefined) ?? ev.title as string}** updated (${Object.keys(updates).join(', ')}).`
})

export const deleteEvent = wrapToolHandler<z.infer<typeof DeleteEventSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const ev = await findEvent(client, args.eventId)
  await client.removeCollection(ev._class, ev.space, ev._id, ev.attachedTo, ev.attachedToClass, ev.collection)
  return `🗑️ Event **${ev.title as string}** deleted.`
})

