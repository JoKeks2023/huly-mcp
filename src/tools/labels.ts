import tags from '@hcengineering/tags'
import tracker from '@hcengineering/tracker'
import core, { generateId, type Ref } from '@hcengineering/core'
import type { TagElement } from '@hcengineering/tags'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import type { z } from 'zod'
import type {
  ListLabelCategoriesSchema,
  CreateLabelCategorySchema,
  SetLabelCategorySchema,
  ListLabelsSchema,
  CreateLabelSchema,
  AddLabelSchema,
  RemoveLabelSchema,
  UpdateLabelSchema,
  DeleteLabelSchema
} from '../schemas'

export const listLabels = wrapToolHandler<z.infer<typeof ListLabelsSchema>>(async (args) => {
  const client = await getConnection(args.workspace)

  const allLabels = await client.findAll(tags.class.TagElement, { targetClass: tracker.class.Issue })

  if (allLabels.length === 0) return 'No labels found in this workspace.'

  const lines = allLabels.map((l) => {
    const color = l.color != null ? ` (color: #${l.color.toString(16).padStart(6, '0')})` : ''
    return `- **${l.title}**${color} — used ${l.refCount ?? 0} time(s) | id: \`${l._id}\``
  })

  return `## Labels (${allLabels.length})\n\n${lines.join('\n')}`
})

export const createLabel = wrapToolHandler<z.infer<typeof CreateLabelSchema>>(async (args) => {
  const client = await getConnection(args.workspace)

  // Check if label already exists
  const existing = await client.findOne(tags.class.TagElement, {
    targetClass: tracker.class.Issue,
    title: args.title
  })
  if (existing != null) {
    return `Label **${args.title}** already exists (id: \`${existing._id}\`).`
  }

  // Find or use the default no-category
  const category = await client.findOne(tags.class.TagCategory, {
    targetClass: tracker.class.Issue
  })

  const labelId = generateId<TagElement>()
  await client.createDoc(
    tags.class.TagElement,
    core.space.Workspace,
    {
      title: args.title,
      targetClass: tracker.class.Issue,
      description: '',
      color: args.color != null ? parseInt(args.color.replace('#', ''), 16) : 8,
      category: category?._id ?? tags.category.NoCategory,
      refCount: 0
    },
    labelId
  )

  return `✅ Created label **${args.title}** (id: \`${labelId}\`)`
})

export const addLabel = wrapToolHandler<z.infer<typeof AddLabelSchema>>(async (args) => {
  const client = await getConnection(args.workspace)

  // Find issue
  const issue = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`)

  // Find label by name or create it
  let label = await client.findOne(tags.class.TagElement, {
    targetClass: tracker.class.Issue,
    title: args.labelName
  })

  if (label == null) {
    // Auto-create label
    const category = await client.findOne(tags.class.TagCategory, {
      targetClass: tracker.class.Issue
    })
    const labelId = generateId<TagElement>()
    await client.createDoc(
      tags.class.TagElement,
      core.space.Workspace,
      {
        title: args.labelName,
        targetClass: tracker.class.Issue,
        description: '',
        color: 8,
        category: category?._id ?? tags.category.NoCategory,
        refCount: 0
      },
      labelId
    )
    label = await client.findOne(tags.class.TagElement, { _id: labelId })
    if (label == null) throw new Error(`Failed to create label '${args.labelName}'.`)
  }

  // Check if already attached
  const existing = await client.findOne(tags.class.TagReference, {
    attachedTo: issue._id,
    tag: label._id
  })
  if (existing != null) {
    return `Label **${args.labelName}** is already on **${args.identifier}**.`
  }

  // Attach label via addCollection
  await client.addCollection(
    tags.class.TagReference,
    issue.space,
    issue._id,
    tracker.class.Issue,
    'labels',
    {
      tag: label._id as Ref<TagElement>,
      title: label.title,
      color: label.color
    }
  )

  return `✅ Added label **${args.labelName}** to **${args.identifier}**`
})

export const removeLabel = wrapToolHandler<z.infer<typeof RemoveLabelSchema>>(async (args) => {
  const client = await getConnection(args.workspace)

  const issue = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`)

  const label = await client.findOne(tags.class.TagElement, {
    targetClass: tracker.class.Issue,
    title: args.labelName
  })
  if (label == null) throw new Error(`Label '${args.labelName}' not found.`)

  const ref = await client.findOne(tags.class.TagReference, {
    attachedTo: issue._id,
    tag: label._id
  })
  if (ref == null) {
    return `Label **${args.labelName}** is not on **${args.identifier}**.`
  }

  await client.removeCollection(
    tags.class.TagReference,
    issue.space,
    ref._id,
    issue._id,
    tracker.class.Issue,
    'labels'
  )

  return `✅ Removed label **${args.labelName}** from **${args.identifier}**`
})

async function findLabel (client: Awaited<ReturnType<typeof getConnection>>, title: string): Promise<TagElement> {
  const label = await client.findOne(tags.class.TagElement, { targetClass: tracker.class.Issue, title })
  if (label == null) throw new Error(`Label '${title}' not found.`)
  return label
}

export const updateLabel = wrapToolHandler<z.infer<typeof UpdateLabelSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const label = await findLabel(client, args.labelName)

  const updates: Record<string, unknown> = {}
  if (args.newName !== undefined && args.newName !== label.title) {
    const clash = await client.findOne(tags.class.TagElement, { targetClass: tracker.class.Issue, title: args.newName })
    if (clash != null) throw new Error(`A label named '${args.newName}' already exists.`)
    updates.title = args.newName
  }
  if (args.color !== undefined) updates.color = parseInt(args.color.replace('#', ''), 16)
  if (args.description !== undefined) updates.description = args.description
  if (Object.keys(updates).length === 0) return `Nothing to update for label **${label.title}**.`

  await client.updateDoc(tags.class.TagElement, label.space, label._id, updates as any)

  // Issues show the title/color copied into each TagReference — keep them in sync.
  const refUpdates: Record<string, unknown> = {}
  if (updates.title !== undefined) refUpdates.title = updates.title
  if (updates.color !== undefined) refUpdates.color = updates.color
  let synced = 0
  if (Object.keys(refUpdates).length > 0) {
    const refs = await client.findAll(tags.class.TagReference, { tag: label._id })
    for (const ref of refs) {
      await client.updateCollection(tags.class.TagReference, ref.space, ref._id, ref.attachedTo, ref.attachedToClass, ref.collection, refUpdates as any)
      synced++
    }
  }

  return `✅ Label **${(updates.title as string | undefined) ?? label.title}** updated (${Object.keys(updates).map((k) => (k === 'title' ? 'name' : k)).join(', ')})${synced > 0 ? ` on ${synced} issue(s)` : ''}.`
})

export const deleteLabel = wrapToolHandler<z.infer<typeof DeleteLabelSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const label = await findLabel(client, args.labelName)

  // Remove the label from every issue first, so no issue keeps a reference to a deleted label.
  const refs = await client.findAll(tags.class.TagReference, { tag: label._id })
  for (const ref of refs) {
    await client.removeCollection(tags.class.TagReference, ref.space, ref._id, ref.attachedTo, ref.attachedToClass, ref.collection)
  }
  await client.removeDoc(tags.class.TagElement, label.space, label._id)

  return `🗑️ Label **${label.title}** deleted${refs.length > 0 ? ` and removed from ${refs.length} issue(s)` : ''}.`
})

// ── Label categories (tags:class:TagCategory) ───────────────────────────────

export const listLabelCategories = wrapToolHandler<z.infer<typeof ListLabelCategoriesSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const categories: any[] = await client.findAll(tags.class.TagCategory, { targetClass: tracker.class.Issue })
  const labels: any[] = await client.findAll(tags.class.TagElement, { targetClass: tracker.class.Issue })
  if (categories.length === 0) return 'No label categories.'
  const lines = categories.map((c) => {
    const own = labels.filter((l) => l.category === c._id).map((l) => l.title)
    return `- **${String(c.label)}**${c.default === true ? ' (default)' : ''} — ${own.length > 0 ? own.join(', ') : 'no labels'} — \`${String(c._id)}\``
  })
  const loose = labels.filter((l) => !categories.some((c) => c._id === l.category)).map((l) => l.title)
  return `## Label categories (${categories.length})\n\n${lines.join('\n')}${loose.length > 0 ? `\n\nWithout category: ${loose.join(', ')}` : ''}`
})

export const createLabelCategory = wrapToolHandler<z.infer<typeof CreateLabelCategorySchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const existing: any[] = await client.findAll(tags.class.TagCategory, { targetClass: tracker.class.Issue })
  const same = existing.find((c) => String(c.label).toLowerCase() === args.name.toLowerCase())
  if (same != null) return `ℹ️ Category **${String(same.label)}** already exists — \`${String(same._id)}\`.`
  const id = await client.createDoc(tags.class.TagCategory, core.space.Workspace, { label: args.name, targetClass: tracker.class.Issue, icon: tags.icon.Tags, tags: [], default: false })
  return `✅ Label category **${args.name}** created — \`${String(id)}\`.`
})

export const setLabelCategory = wrapToolHandler<z.infer<typeof SetLabelCategorySchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const label = await client.findOne(tags.class.TagElement, { targetClass: tracker.class.Issue, title: args.labelName })
  if (label == null) throw new Error(`Label '${args.labelName}' not found.`)
  const categories: any[] = await client.findAll(tags.class.TagCategory, { targetClass: tracker.class.Issue })
  const cat = categories.find((c) => c._id === args.category || String(c.label).toLowerCase() === args.category.toLowerCase())
  if (cat == null) throw new Error(`Category '${args.category}' not found. Available: ${categories.map((c) => c.label).join(', ')}.`)
  await client.updateDoc(tags.class.TagElement, label.space, label._id, { category: cat._id })
  return `✅ Label **${args.labelName}** is now in category **${String(cat.label)}**.`
})
