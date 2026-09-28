import tags from '@hcengineering/tags'
import tracker from '@hcengineering/tracker'
import core, { generateId, type Ref } from '@hcengineering/core'
import type { TagElement } from '@hcengineering/tags'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import type { z } from 'zod'
import type {
  ListLabelsSchema,
  CreateLabelSchema,
  AddLabelSchema,
  RemoveLabelSchema
} from '../schemas'

export const listLabels = wrapToolHandler<z.infer<typeof ListLabelsSchema>>(async (args) => {
  const client = await getConnection(args.workspace)

  const query = args.projectIdentifier != null
    ? { targetClass: tracker.class.Issue }
    : { targetClass: tracker.class.Issue }

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
