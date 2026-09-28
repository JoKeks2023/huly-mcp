import tracker from '@hcengineering/tracker'
import type { Issue, IssueParentInfo, IssueChildInfo } from '@hcengineering/tracker'
import type { RelatedDocument, Ref } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import type { z } from 'zod'
import type { AddRelationSchema, AddBlockedBySchema, SetParentSchema } from '../schemas'

export const addRelation = wrapToolHandler<z.infer<typeof AddRelationSchema>>(async (args) => {
  const client = await getConnection(args.workspace)

  const issueA = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (issueA == null) throw new Error(`Issue '${args.identifier}' not found.`)

  const issueB = await client.findOne(tracker.class.Issue, { identifier: args.relatedTo })
  if (issueB == null) throw new Error(`Issue '${args.relatedTo}' not found.`)

  const relA: RelatedDocument = { _id: issueB._id, _class: issueB._class }
  const relB: RelatedDocument = { _id: issueA._id, _class: issueA._class }

  const existingRels = issueA.relations ?? []
  if (existingRels.some((r) => r._id === issueB._id)) {
    return `**${args.identifier}** is already related to **${args.relatedTo}**.`
  }

  // Add bidirectional relation
  await client.updateDoc(tracker.class.Issue, issueA.space, issueA._id, {
    relations: [...existingRels, relA]
  })
  await client.updateDoc(tracker.class.Issue, issueB.space, issueB._id, {
    relations: [...(issueB.relations ?? []), relB]
  })

  return `✅ **${args.identifier}** is now related to **${args.relatedTo}**`
})

export const addBlockedBy = wrapToolHandler<z.infer<typeof AddBlockedBySchema>>(async (args) => {
  const client = await getConnection(args.workspace)

  const issue = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`)

  const blocker = await client.findOne(tracker.class.Issue, { identifier: args.blockedBy })
  if (blocker == null) throw new Error(`Issue '${args.blockedBy}' not found.`)

  const blockerRef: RelatedDocument = { _id: blocker._id, _class: blocker._class }

  const existing = issue.blockedBy ?? []
  if (existing.some((r) => r._id === blocker._id)) {
    return `**${args.identifier}** is already blocked by **${args.blockedBy}**.`
  }

  await client.updateDoc(tracker.class.Issue, issue.space, issue._id, {
    blockedBy: [...existing, blockerRef]
  })

  return `✅ **${args.identifier}** is now blocked by **${args.blockedBy}**`
})

export const setParent = wrapToolHandler<z.infer<typeof SetParentSchema>>(async (args) => {
  const client = await getConnection(args.workspace)

  const child = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (child == null) throw new Error(`Issue '${args.identifier}' not found.`)

  // Clear parent if requested
  if (args.parentIdentifier == null) {
    await client.updateDoc(tracker.class.Issue, child.space, child._id, { parents: [] })
    // Remove from old parent's childInfo if there was one
    if (child.parents.length > 0) {
      const oldParentId = child.parents[0].parentId
      const oldParent = await client.findOne(tracker.class.Issue, { _id: oldParentId })
      if (oldParent != null) {
        const newChildInfo = (oldParent.childInfo ?? []).filter((c) => c.childId !== child._id)
        await client.updateDoc(tracker.class.Issue, oldParent.space, oldParent._id, {
          subIssues: Math.max(0, (oldParent.subIssues ?? 1) - 1),
          childInfo: newChildInfo
        })
      }
    }
    return `✅ Cleared parent from **${args.identifier}**`
  }

  const parent = await client.findOne(tracker.class.Issue, { identifier: args.parentIdentifier })
  if (parent == null) throw new Error(`Parent issue '${args.parentIdentifier}' not found.`)
  if (parent._id === child._id) throw new Error('An issue cannot be its own parent.')

  const parentInfo: IssueParentInfo = {
    parentId: parent._id as Ref<Issue>,
    identifier: parent.identifier,
    parentTitle: parent.title,
    space: parent.space
  }

  const childInfoEntry: IssueChildInfo = {
    childId: child._id as Ref<Issue>,
    estimation: child.estimation ?? 0,
    reportedTime: child.reportedTime ?? 0
  }

  // Update child's parents list
  await client.updateDoc(tracker.class.Issue, child.space, child._id, {
    parents: [parentInfo, ...child.parents]
  })

  // Update parent's subIssues count and childInfo
  const existingChildInfo = parent.childInfo ?? []
  if (!existingChildInfo.some((c) => c.childId === child._id)) {
    await client.updateDoc(tracker.class.Issue, parent.space, parent._id, {
      subIssues: (parent.subIssues ?? 0) + 1,
      childInfo: [...existingChildInfo, childInfoEntry]
    })
  }

  return `✅ **${args.identifier}** is now a sub-issue of **${args.parentIdentifier}**`
})
