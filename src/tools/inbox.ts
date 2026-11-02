import { SortingOrder } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { C } from '../utils/classes'
import { currentAccountUuid } from '../utils/people'
import { loadLabel, resolveObject } from '../utils/resolve'
import type { z } from 'zod'
import type { ListNotificationsSchema, MarkNotificationsReadSchema } from '../schemas'

const when = (ts: number | undefined): string => ts == null ? '' : new Date(ts).toISOString().slice(0, 16).replace('T', ' ')

export const listNotifications = wrapToolHandler<z.infer<typeof ListNotificationsSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const user = await currentAccountUuid(client)
  const query: Record<string, unknown> = { user, archived: false }
  if (args.unreadOnly) query.isViewed = false

  const notes: any[] = await client.findAll(C.InboxNotification, query, { limit: args.limit, sort: { createdOn: SortingOrder.Descending } })
  if (notes.length === 0) return args.unreadOnly ? 'No unread notifications.' : 'No notifications.'

  // Group by the object they are about (one line per issue / PR / document / channel).
  const contexts: any[] = await client.findAll(C.DocNotifyContext, { _id: { $in: [...new Set(notes.map((n) => n.docNotifyContext))] } })
  const ctxById = new Map(contexts.map((c) => [c._id, c]))
  const groups = new Map<string, { ctx: any, notes: any[] }>()
  for (const n of notes) {
    const g = groups.get(n.docNotifyContext) ?? { ctx: ctxById.get(n.docNotifyContext), notes: [] }
    g.notes.push(n)
    groups.set(n.docNotifyContext, g)
  }

  const lines: string[] = []
  for (const { ctx, notes: group } of groups.values()) {
    const objectClass = ctx?.objectClass ?? group[0].objectClass
    const objectId = ctx?.objectId ?? group[0].objectId
    const label = objectClass != null ? await loadLabel(client, objectClass, objectId) : '(unknown)'
    const kind = String(objectClass ?? '').split(':').pop()
    const unread = group.filter((n) => n.isViewed !== true).length
    lines.push(`- **${label}** (${kind}) — ${group.length} notification(s)${unread > 0 ? `, ${unread} unread` : ''}, latest ${when(group[0].createdOn)}\n  ids: ${group.map((n) => `\`${n._id as string}\``).join(', ')}`)
  }
  return `## Notifications (${notes.length}${args.unreadOnly ? ' unread' : ''})\n\n${lines.join('\n')}`
})

export const markNotificationsRead = wrapToolHandler<z.infer<typeof MarkNotificationsReadSchema>>(async (args) => {
  const modes = [args.object != null, args.notificationIds != null, args.all === true].filter(Boolean).length
  if (modes !== 1) throw new Error('Pass exactly one of: object, notificationIds, all.')
  const client: any = await getConnection(args.workspace)
  const user = await currentAccountUuid(client)

  const query: Record<string, unknown> = { user, isViewed: false }
  if (args.archive) delete query.isViewed
  let scope = 'all notifications'
  if (args.object != null) {
    const obj = await resolveObject(client, args.object)
    const ctxs: any[] = await client.findAll(C.DocNotifyContext, { user, objectId: obj._id })
    query.docNotifyContext = { $in: ctxs.map((c) => c._id) }
    scope = obj.label
  }
  if (args.notificationIds != null) {
    query._id = { $in: args.notificationIds }
    delete query.isViewed
    scope = `${args.notificationIds.length} notification(s)`
  }
  if (args.archive) query.archived = false

  const notes: any[] = await client.findAll(C.InboxNotification, query)
  const update = args.archive ? { isViewed: true, archived: true } : { isViewed: true }
  for (const n of notes) await client.updateDoc(n._class, n.space, n._id, update)

  // Like Huly's inbox: the context remembers when it was last viewed.
  const now = Date.now()
  for (const ctxId of new Set(notes.map((n) => n.docNotifyContext))) {
    const ctx: any = await client.findOne(C.DocNotifyContext, { _id: ctxId })
    if (ctx != null) await client.updateDoc(ctx._class, ctx.space, ctx._id, { lastViewedTimestamp: now })
  }
  return `✅ ${notes.length} notification(s) ${args.archive ? 'archived' : 'marked read'} (${scope}).`
})
