import tracker from '@hcengineering/tracker'
import { SortingOrder, generateId } from '@hcengineering/core'
import { makeRank } from '@hcengineering/rank'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { C, IDS, TODO_PRIORITY, TODO_PRIORITY_LABEL, generateEventId } from '../utils/classes'
import { formatDate, textToMarkup } from '../utils/format'
import { currentAccountUuid, currentPerson } from '../utils/people'
import { loadLabel } from '../utils/resolve'
import type { z } from 'zod'
import type { ListTodosSchema, CreateTodoSchema, UpdateTodoSchema, DeleteTodoSchema, ScheduleTodoSchema } from '../schemas'

function parseDate (value: string, label = 'date'): number {
  const t = new Date(value).getTime()
  if (isNaN(t)) throw new Error(`Invalid ${label}: '${value}'`)
  return t
}

async function findTodo (client: any, todoId: string): Promise<any> {
  const todo = await client.findOne(C.ToDo, { _id: todoId })
  if (todo == null) throw new Error(`To-do '${todoId}' not found.`)
  return todo
}

/** The user's calendar for new events/work slots: Huly's personal calendar "<account>_calendar". */
export async function primaryCalendar (client: any): Promise<string> {
  const uuid = await currentAccountUuid(client)
  const own = `${uuid}_calendar`
  if ((await client.findOne(C.Calendar, { _id: own })) != null) return own
  const any = await client.findOne(C.Calendar, { hidden: false })
  if (any == null) throw new Error('No calendar found for the current user.')
  return any._id
}

export const listTodos = wrapToolHandler<z.infer<typeof ListTodosSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const me = await currentPerson(client)
  const query: Record<string, unknown> = { user: me._id }
  if (args.status === 'open') query.doneOn = null
  let todos: any[] = await client.findAll(C.ToDo, query, { sort: { rank: SortingOrder.Ascending } })
  if (args.status === 'done') todos = todos.filter((t) => t.doneOn != null).sort((a, b) => b.doneOn - a.doneOn)
  if (args.dueBefore != null) {
    const limit = parseDate(args.dueBefore, 'dueBefore') + 86_400_000 - 1
    todos = todos.filter((t) => t.dueDate != null && t.dueDate <= limit)
  }
  const total = todos.length
  todos = todos.slice(0, args.limit)
  if (todos.length === 0) return `No ${args.status === 'all' ? '' : args.status + ' '}to-dos.`

  const lines: string[] = []
  for (const t of todos) {
    const done = t.doneOn != null ? `[x] (done ${formatDate(t.doneOn)})` : '[ ]'
    const due = t.dueDate != null ? ` · due ${formatDate(t.dueDate)}` : ''
    const prio = t.priority !== TODO_PRIORITY.NoPriority ? ` · ${TODO_PRIORITY_LABEL[t.priority] ?? t.priority}` : ''
    const link = t.attachedTo !== IDS.ToDoNotAttached ? ` · ${await loadLabel(client, t.attachedToClass, t.attachedTo)}` : ''
    const slots = (t.workslots ?? 0) > 0 ? ` · ${t.workslots as number} slot(s)` : ''
    lines.push(`- ${done} **${t.title as string}**${prio}${due}${link}${slots} — \`${t._id as string}\``)
  }
  return `## To-dos (${args.status}, ${total})\n\n${lines.join('\n')}${total > todos.length ? `\n\n_${total - todos.length} more (raise limit)._` : ''}`
})

export const createTodo = wrapToolHandler<z.infer<typeof CreateTodoSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const me = await currentPerson(client)
  const latest = await client.findOne(C.ToDo, { user: me._id, doneOn: null }, { sort: { rank: SortingOrder.Ascending } })

  const data: Record<string, unknown> = {
    title: args.title,
    description: textToMarkup(args.description ?? null),
    user: me._id,
    workslots: 0,
    doneOn: null,
    priority: TODO_PRIORITY[args.priority],
    rank: makeRank(undefined, latest?.rank)
  }
  if (args.dueDate != null) data.dueDate = parseDate(args.dueDate, 'dueDate')

  const id = generateId()
  if (args.issue != null) {
    // Like Huly's planner for issues: a ProjectToDo attached to the issue, visible to the project.
    const issue: any = await client.findOne(tracker.class.Issue, { identifier: args.issue })
    if (issue == null) throw new Error(`Issue '${args.issue}' not found.`)
    await client.addCollection(C.ProjectToDo, IDS.ToDosSpace, issue._id, tracker.class.Issue, 'todos', { ...data, attachedSpace: issue.space, visibility: 'public' }, id)
    return `✅ To-do **${args.title}** created on ${args.issue} (id: \`${id}\`).`
  }
  await client.addCollection(C.ToDo, IDS.ToDosSpace, IDS.ToDoNotAttached, C.ToDo, 'todos', { ...data, visibility: 'private' }, id)
  return `✅ To-do **${args.title}** created (id: \`${id}\`).`
})

export const updateTodo = wrapToolHandler<z.infer<typeof UpdateTodoSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const todo = await findTodo(client, args.todoId)
  const updates: Record<string, unknown> = {}
  if (args.title !== undefined) updates.title = args.title
  if (args.description !== undefined) updates.description = textToMarkup(args.description)
  if (args.dueDate !== undefined) updates.dueDate = args.dueDate === null ? null : parseDate(args.dueDate, 'dueDate')
  if (args.priority !== undefined) updates.priority = TODO_PRIORITY[args.priority]
  if (args.done !== undefined && args.done !== (todo.doneOn != null)) updates.doneOn = args.done ? Date.now() : null
  if (Object.keys(updates).length === 0) return `Nothing to update for **${todo.title as string}**.`
  await client.update(todo, updates)
  return `✅ To-do **${(updates.title as string | undefined) ?? todo.title as string}** updated (${Object.keys(updates).map((k) => k === 'doneOn' ? (args.done === true ? 'done' : 'reopened') : k).join(', ')}).`
})

export const deleteTodo = wrapToolHandler<z.infer<typeof DeleteTodoSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const todo = await findTodo(client, args.todoId)
  await client.removeCollection(todo._class, todo.space, todo._id, todo.attachedTo, todo.attachedToClass, todo.collection)
  return `🗑️ To-do **${todo.title as string}** deleted.`
})

export const scheduleTodo = wrapToolHandler<z.infer<typeof ScheduleTodoSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const todo = await findTodo(client, args.todoId)
  const me = await currentPerson(client)
  const date = parseDate(args.start, 'start')
  const dueDate = date + args.durationMinutes * 60_000
  const id = generateId()
  // Mirrors Huly's TodoWorkslots: a WorkSlot (calendar event) in the user's primary calendar.
  await client.addCollection(C.WorkSlot, IDS.CalendarSpace, todo._id, todo._class, 'workslots', {
    eventId: generateEventId(id),
    date,
    dueDate,
    calendar: await primaryCalendar(client),
    description: todo.description ?? '',
    participants: [me._id],
    title: todo.title,
    blockTime: true,
    allDay: false,
    access: 'owner',
    user: client.user,
    visibility: todo.visibility === 'public' ? 'public' : 'freeBusy',
    reminders: []
  }, id)
  return `✅ **${todo.title as string}** scheduled ${new Date(date).toISOString().slice(0, 16).replace('T', ' ')} UTC for ${args.durationMinutes} min (slot \`${id}\`).`
})

