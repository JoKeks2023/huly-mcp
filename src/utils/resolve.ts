import task from '@hcengineering/task'
import type { TxOperations } from '@hcengineering/core'
import { markupToText } from './format'

export interface ObjectRef { _id: string, _class: string, space: string, label: string, doc: any }

const TASK_ID = /^[A-Z][A-Z0-9]*-\d+$/

/** Human-readable label for any Huly document: "PROJ-12: title", a title, a name, or message text. */
export function labelOf (doc: any): string {
  if (doc == null) return '(deleted)'
  const title = doc.title ?? doc.name ?? doc.label
  if (doc.identifier != null && title != null) return `${doc.identifier as string}: ${title as string}`
  if (title != null && title !== '') return String(title)
  if (typeof doc.message === 'string') return markupToText(doc.message).slice(0, 80)
  return String(doc._id)
}

/** Loads a document of a known class and labels it; undefined if it no longer exists. */
export async function loadLabel (client: TxOperations, _class: string, _id: string): Promise<string> {
  try {
    const doc = await client.findOne(_class as any, { _id } as any)
    return labelOf(doc)
  } catch {
    return String(_id)
  }
}

/**
 * Resolves "PROJ-12" (issue, pull request or any task) or a raw document id.
 * For raw ids the class is unknown, so the activity/notification records that point at it are used.
 */
export async function resolveObject (client: TxOperations, ref: string): Promise<ObjectRef> {
  if (TASK_ID.test(ref)) {
    const doc: any = await client.findOne(task.class.Task, { identifier: ref } as any)
    if (doc == null) throw new Error(`'${ref}' not found.`)
    return { _id: doc._id, _class: doc._class, space: doc.space, label: labelOf(doc), doc }
  }
  const ctx: any = await client.findOne('notification:class:DocNotifyContext' as any, { objectId: ref } as any)
  const msg: any = ctx == null ? await client.findOne('activity:class:ActivityMessage' as any, { attachedTo: ref } as any) : undefined
  const _class = ctx?.objectClass ?? msg?.attachedToClass
  if (_class == null) throw new Error(`Object '${ref}' not found (pass an issue id like PROJ-12 or an id from another tool).`)
  const doc: any = await client.findOne(_class, { _id: ref } as any)
  return { _id: ref, _class, space: doc?.space ?? ctx?.objectSpace, label: labelOf(doc), doc }
}
