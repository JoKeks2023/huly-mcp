import { SortingOrder } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { C } from '../utils/classes'
import { currentAccountUuid } from '../utils/people'
import { loadLabel, resolveObject } from '../utils/resolve'
import type { z } from 'zod'
import type { ListNotificationsSchema, MarkNotificationsReadSchema, ManageNotificationsSchema } from '../schemas'

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
    lines.push(`- **${label}** (${kind}) — ${group.length} notification(s)${unread > 0 ? `, ${unread} unread` : ''}, latest ${when(group[0].createdOn)}${args.ids === true ? `\n  ids: ${group.map((n) => `\`${n._id as string}\``).join(', ')}` : ''}`)
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

/**
 * Inbox housekeeping for one object, the way Huly's inbox does it: pin/unpin and hide/unhide its
 * conversation (DocNotifyContext), mark it unread again, restore archived notifications, and
 * follow/unfollow it (a Collaborator row for my account). unhide is our own addition — Huly only
 * un-hides on new activity.
 */
export const manageNotifications = wrapToolHandler<z.infer<typeof ManageNotificationsSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const user = await currentAccountUuid(client)
  const target = await resolveObject(client, args.object)

  if (args.action === 'follow' || args.action === 'unfollow') {
    const rows: any[] = await client.findAll(C.Collaborator, { attachedTo: target._id, collaborator: user })
    if (args.action === 'follow') {
      if (rows.length > 0) return `You already follow ${target.label}.`
      await client.addCollection(C.Collaborator, target.space, target._id, target._class, 'collaborators', { collaborator: user })
      return `✅ You now follow ${target.label} — its changes reach your inbox.`
    }
    if (rows.length === 0) return `You do not follow ${target.label}.`
    for (const r of rows) await client.removeCollection(C.Collaborator, r.space, r._id, r.attachedTo, r.attachedToClass, r.collection ?? 'collaborators')
    return `✅ You no longer follow ${target.label}.`
  }

  const ctx: any = await client.findOne(C.DocNotifyContext, { user, objectId: target._id })
  if (ctx == null) throw new Error(`${target.label} is not in your inbox (no notifications for it yet). Nothing was changed.`)
  const set = async (update: Record<string, unknown>): Promise<void> => { await client.updateDoc(ctx._class, ctx.space, ctx._id, update) }

  switch (args.action) {
    case 'pin': await set({ isPinned: true }); return `✅ Pinned ${target.label} in your inbox.`
    case 'unpin': await set({ isPinned: false }); return `✅ Unpinned ${target.label}.`
    case 'hide': await set({ hidden: true }); return `✅ Hidden ${target.label} — it comes back with new activity.`
    case 'unhide': await set({ hidden: false }); return `✅ ${target.label} is visible in your inbox again.`
    case 'unarchive': {
      const notes: any[] = await client.findAll(C.InboxNotification, { user, docNotifyContext: ctx._id, archived: true })
      for (const n of notes) await client.updateDoc(n._class, n.space, n._id, { archived: false })
      return `✅ ${notes.length} notification(s) of ${target.label} restored from the archive.`
    }
    case 'unread': {
      // Like Huly's "mark as unread": the notifications become unviewed and the context's
      // last-viewed time goes back to just before the oldest of them.
      const notes: any[] = await client.findAll(C.InboxNotification, { user, docNotifyContext: ctx._id, archived: false })
      if (notes.length === 0) return `${target.label} has no notifications to mark unread.`
      for (const n of notes) if (n.isViewed === true) await client.updateDoc(n._class, n.space, n._id, { isViewed: false })
      const oldest = Math.min(...notes.map((n) => n.createdOn ?? Date.now()))
      await set({ lastViewedTimestamp: oldest - 1 })
      return `✅ ${target.label} is unread again (${notes.length} notification(s)).`
    }
  }
  throw new Error(`Unknown action '${args.action as string}'.`)
})
