import tracker, { type Issue } from '@hcengineering/tracker'
import { SortingOrder, type RelatedDocument } from '@hcengineering/core'
import { makeRank } from '@hcengineering/rank'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import type { z } from 'zod'
import type { AddRelationSchema, AddBlockedBySchema, SetParentSchema, RemoveRelationSchema, RemoveBlockedBySchema, RepairParentLinksSchema } from '../schemas'

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

/**
 * Sets or clears the parent the way Huly's own UI does (SetParentIssueActionPopup): only
 * `attachedTo` (and the rank among the new siblings) is written. The server derives
 * `parents`, `subIssues` and `childInfo` from it.
 *
 * Before 2.2.0 this tool wrote `parents`/`childInfo` directly and left `attachedTo` at
 * NoParent, so the sub-issue did not appear under its parent in Huly. Running set_parent
 * again on such an issue repairs it.
 */
export const setParent = wrapToolHandler<z.infer<typeof SetParentSchema>>(async (args) => {
  const client = await getConnection(args.workspace)

  const child = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (child == null) throw new Error(`Issue '${args.identifier}' not found.`)

  if (args.parentIdentifier == null) {
    const result = await linkToParent(client, child, null)
    return result === 'unchanged' ? `**${args.identifier}** has no parent.` : `✅ Cleared parent from **${args.identifier}**`
  }

  const parent = await client.findOne(tracker.class.Issue, { identifier: args.parentIdentifier })
  if (parent == null) throw new Error(`Parent issue '${args.parentIdentifier}' not found.`)
  const result = await linkToParent(client, child, parent)
  if (result === 'unchanged') return `**${args.identifier}** is already a sub-issue of **${args.parentIdentifier}**.`
  return `✅ **${args.identifier}** is now a sub-issue of **${args.parentIdentifier}**${result === 'repaired' ? ' (repaired link from an older version)' : ''}`
})

type Client = Awaited<ReturnType<typeof getConnection>>

/** True if the issue was linked by set_parent <= 2.1 (parents written, attachedTo left at NoParent). */
export function isLegacyLink (issue: Issue): boolean {
  return issue.attachedTo === tracker.ids.NoParent && (issue.parents ?? []).length > 0
}

/**
 * Links `child` under `parent` (or detaches it for null) the way Huly's UI does: only
 * attachedTo and rank are written, the server derives parents/subIssues/childInfo.
 */
export async function linkToParent (client: Client, child: Issue, parent: Issue | null): Promise<'linked' | 'repaired' | 'cleared' | 'unchanged'> {
  const legacy = isLegacyLink(child)

  // Linked by set_parent <= 2.1: parents/childInfo/subIssues were written by hand while
  // attachedTo stayed NoParent. Undo that bookkeeping first, otherwise the server's own
  // counting on the attachedTo change would count this child twice.
  const undoLegacy = async (): Promise<void> => {
    const old = await client.findOne(tracker.class.Issue, { _id: child.parents[0].parentId })
    if (old == null) return
    const childInfo = (old.childInfo ?? []).filter((c) => c.childId !== child._id)
    const removed = (old.childInfo ?? []).length - childInfo.length
    await client.updateDoc(tracker.class.Issue, old.space, old._id, {
      childInfo,
      subIssues: Math.max(0, (old.subIssues ?? 0) - Math.max(removed, 1))
    })
  }

  if (parent == null) {
    if (child.attachedTo === tracker.ids.NoParent && (child.parents ?? []).length === 0) return 'unchanged'
    if (legacy) await undoLegacy()
    await client.update(child, { attachedTo: tracker.ids.NoParent, parents: [] })
    return 'cleared'
  }

  if (parent._id === child._id) throw new Error('An issue cannot be its own parent.')
  if ((parent.parents ?? []).some((p) => p.parentId === child._id)) {
    throw new Error(`${parent.identifier} is a sub-issue of ${child.identifier} — that would create a cycle.`)
  }
  if (child.attachedTo === parent._id) return 'unchanged'

  const lastSibling = await client.findOne(tracker.class.Issue, { attachedTo: parent._id }, { sort: { rank: SortingOrder.Descending } })
  if (legacy) await undoLegacy()
  await client.update(child, { attachedTo: parent._id, rank: makeRank(lastSibling?.rank, undefined) })
  return legacy ? 'repaired' : 'linked'
}

export const repairParentLinks = wrapToolHandler<z.infer<typeof RepairParentLinksSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const project = await client.findOne(tracker.class.Project, { identifier: args.projectIdentifier })
  if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`)

  const issues = await client.findAll(tracker.class.Issue, { space: project._id })
  const byId = new Map(issues.map((i) => [i._id as string, i]))
  const legacy = issues.filter(isLegacyLink)
  if (legacy.length === 0) return `No broken parent links in ${args.projectIdentifier}.`

  const lines: string[] = []
  let repaired = 0; let skipped = 0
  for (const child of legacy) {
    const parentRef = child.parents[0]
    const parent = byId.get(parentRef.parentId as string) ?? await client.findOne(tracker.class.Issue, { _id: parentRef.parentId })
    if (parent == null) {
      skipped++
      lines.push(`- ${child.identifier}: parent ${parentRef.identifier} no longer exists — skipped`)
      continue
    }
    if (args.dryRun) {
      lines.push(`- ${child.identifier} → under ${parent.identifier}`)
      continue
    }
    await linkToParent(client, child, parent)
    repaired++
    lines.push(`- ${child.identifier} → under ${parent.identifier} ✅`)
  }

  const head = args.dryRun
    ? `## Dry run: ${legacy.length - skipped} sub-issue(s) in ${args.projectIdentifier} would be re-linked${skipped > 0 ? `, ${skipped} skipped` : ''}\nRun again with dryRun=false to apply.`
    : `## Repaired ${repaired} sub-issue link(s) in ${args.projectIdentifier}${skipped > 0 ? `, ${skipped} skipped` : ''}`
  return `${head}\n\n${lines.join('\n')}`
})

export const removeRelation = wrapToolHandler<z.infer<typeof RemoveRelationSchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const issueA = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (issueA == null) throw new Error(`Issue '${args.identifier}' not found.`)
  const issueB = await client.findOne(tracker.class.Issue, { identifier: args.relatedTo })
  if (issueB == null) throw new Error(`Issue '${args.relatedTo}' not found.`)

  const aHas = (issueA.relations ?? []).some((r) => r._id === issueB._id)
  const bHas = (issueB.relations ?? []).some((r) => r._id === issueA._id)
  if (!aHas && !bHas) return `**${args.identifier}** and **${args.relatedTo}** are not related.`

  // add_relation links both directions; remove both.
  if (aHas) await client.updateDoc(tracker.class.Issue, issueA.space, issueA._id, { relations: (issueA.relations ?? []).filter((r) => r._id !== issueB._id) })
  if (bHas) await client.updateDoc(tracker.class.Issue, issueB.space, issueB._id, { relations: (issueB.relations ?? []).filter((r) => r._id !== issueA._id) })

  return `✅ **${args.identifier}** and **${args.relatedTo}** are no longer related`
})

export const removeBlockedBy = wrapToolHandler<z.infer<typeof RemoveBlockedBySchema>>(async (args) => {
  const client = await getConnection(args.workspace)
  const issue = await client.findOne(tracker.class.Issue, { identifier: args.identifier })
  if (issue == null) throw new Error(`Issue '${args.identifier}' not found.`)
  const blocker = await client.findOne(tracker.class.Issue, { identifier: args.blockedBy })
  if (blocker == null) throw new Error(`Issue '${args.blockedBy}' not found.`)

  const existing = issue.blockedBy ?? []
  if (!existing.some((r) => r._id === blocker._id)) return `**${args.identifier}** is not blocked by **${args.blockedBy}**.`

  await client.updateDoc(tracker.class.Issue, issue.space, issue._id, { blockedBy: existing.filter((r) => r._id !== blocker._id) })
  return `✅ **${args.identifier}** is no longer blocked by **${args.blockedBy}**`
})
