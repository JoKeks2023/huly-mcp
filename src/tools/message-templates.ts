// Message templates (templates plugin): reusable chat/e-mail texts with ${field} placeholders,
// grouped in categories (spaces). The message is inline markup.
import { generateId } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { markupToText } from '../utils/format'
import { markdownToProseMirror } from '../utils/markdown'

const markdownToMarkup = (md: string): string => JSON.stringify(markdownToProseMirror(md))
import { currentAccountUuid } from '../utils/people'
import { findNamed } from '../utils/tasks'
import type { z } from 'zod'
import type * as S from '../schemas'

export const MT = { Template: 'templates:class:MessageTemplate', Category: 'templates:class:TemplateCategory', Default: 'templates:space:Templates' } as const

async function findCategory (client: any, ref: string | undefined): Promise<any> {
  if (ref == null) {
    const def = await client.findOne(MT.Category, { _id: MT.Default })
    if (def == null) throw new Error('No default template category — pass category.')
    return def
  }
  return await findNamed(client, MT.Category, ref, 'Template category')
}

async function findTemplate (client: any, ref: string): Promise<any> {
  return await findNamed(client, MT.Template, ref, 'Message template')
}

export const listMessageTemplates = wrapToolHandler<z.infer<typeof S.ListMessageTemplatesSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const cats: any[] = await client.findAll(MT.Category, {})
  const tpls: any[] = await client.findAll(MT.Template, {})
  if (tpls.length === 0) return `No message templates. Categories: ${cats.map((c) => c.name).join(', ') || 'none'}.`
  const lines: string[] = []
  for (const c of cats) {
    const mine = tpls.filter((t) => t.space === c._id)
    if (mine.length === 0) continue
    lines.push(`### ${String(c.name)}`)
    for (const t of mine) {
      const text = markupToText(t.message).replace(/\s+/g, ' ').trim()
      lines.push(`- **${String(t.title)}** — ${text.slice(0, 100)}${text.length > 100 ? '…' : ''} — \`${String(t._id)}\``)
    }
  }
  return `## Message templates (${tpls.length})\n\n${lines.join('\n')}`
})

export const getMessageTemplate = wrapToolHandler<z.infer<typeof S.GetMessageTemplateSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const t = await findTemplate(client, args.template)
  const text = markupToText(t.message)
  const fields = [...new Set([...text.matchAll(/\$\{(\S+?)\}/g)].map((m) => m[1]))]
  return `## ${String(t.title)}\n\n${text}${fields.length > 0 ? `\n\n**Placeholders:** ${fields.join(', ')}` : ''}`
})

export const createMessageTemplate = wrapToolHandler<z.infer<typeof S.CreateMessageTemplateSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  let cat: any
  if (args.newCategory === true) {
    if (args.category == null) throw new Error('newCategory needs category (its name).')
    const id = generateId()
    await client.createDoc(MT.Category, 'core:space:Space', { name: args.category.trim(), description: '', private: false, archived: false, members: [await currentAccountUuid(client)] }, id)
    cat = { _id: id, name: args.category.trim() }
  } else cat = await findCategory(client, args.category)
  const id = generateId()
  await client.createDoc(MT.Template, cat._id, { title: args.title.trim(), message: markdownToMarkup(args.message) }, id)
  return `✅ Template **${args.title}** in ${String(cat.name)} — \`${id}\``
})

export const updateMessageTemplate = wrapToolHandler<z.infer<typeof S.UpdateMessageTemplateSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const t = await findTemplate(client, args.template)
  const update: Record<string, unknown> = {}
  if (args.title != null) update.title = args.title.trim()
  if (args.message != null) update.message = markdownToMarkup(args.message)
  if (Object.keys(update).length === 0) throw new Error('Nothing to change.')
  await client.updateDoc(MT.Template, t.space, t._id, update)
  return `✅ Template **${String(update.title ?? t.title)}** updated: ${Object.keys(update).join(', ')}.`
})

export const deleteMessageTemplate = wrapToolHandler<z.infer<typeof S.DeleteMessageTemplateSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const t = await findTemplate(client, args.template)
  await client.removeDoc(MT.Template, t.space, t._id)
  return `🗑️ Template **${String(t.title)}** deleted.`
})
