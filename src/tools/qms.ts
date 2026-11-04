// Quality management (read-only): controlled documents (documents plugin — versioned, with
// review/approval states) and trainings (training + questions plugins).
import { SortingOrder } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { formatDate, markupToText } from '../utils/format'
import { readMarkup } from '../utils/content'
import { peopleNames } from '../utils/people'
import type { z } from 'zod'
import type * as S from '../schemas'

export const QMS = {
  Space: 'documents:class:DocumentSpace',
  Meta: 'documents:class:DocumentMeta',
  ProjectMeta: 'documents:class:ProjectMeta',
  ProjectDoc: 'documents:class:ProjectDocument',
  Doc: 'documents:class:ControlledDocument',
  Category: 'documents:class:DocumentCategory',
  ChangeControl: 'documents:class:ChangeControl',
  Request: 'documents:class:DocumentRequest',
  Template: 'documents:mixin:DocumentTemplate',
  NoProject: 'documents:ids:NoProject',
  NoParent: 'documents:ids:NoParent',
  Folder: 'documents:ids:Folder',
  Training: 'training:class:Training',
  TrainingRequest: 'training:class:TrainingRequest',
  Attempt: 'training:class:TrainingAttempt',
  Question: 'questions:class:Question'
} as const

const version = (d: any): string => `v${Number(d.major ?? 0)}.${Number(d.minor ?? 0)}`
const state = (d: any): string => `${String(d.state)}${d.controlledState != null ? `/${String(d.controlledState)}` : ''}`
const newest = (a: any, b: any): number => (b.seqNumber - a.seqNumber) || (b.major - a.major) || (b.minor - a.minor) || (b.createdOn - a.createdOn)

export const listControlledDocuments = wrapToolHandler<z.infer<typeof S.ListControlledDocumentsSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const spaces: any[] = (await client.findAll(QMS.Space, {})).filter((s: any) => s._class !== 'products:class:Product')
  const chosen = args.space != null ? spaces.filter((s) => s._id === args.space || String(s.name).toLowerCase() === args.space!.toLowerCase()) : spaces
  if (chosen.length === 0) throw new Error(`Document space '${args.space ?? ''}' not found. Spaces: ${spaces.map((s) => s.name).join(', ') || 'none'}.`)
  const names = await peopleNames(client)
  const out: string[] = []
  for (const sp of chosen) {
    const [metas, pms]: any[][] = await Promise.all([client.findAll(QMS.Meta, { space: sp._id }), client.findAll(QMS.ProjectMeta, { space: sp._id, project: QMS.NoProject })])
    const pds: any[] = pms.length > 0 ? await client.findAll(QMS.ProjectDoc, { attachedTo: { $in: pms.map((p) => p._id) } }) : []
    const docIds = pds.map((p) => p.document).filter((d) => d !== QMS.Folder)
    const docs: any[] = docIds.length > 0 ? await client.findAll(QMS.Doc, { _id: { $in: docIds } }) : []
    out.push(`## ${String(sp.name)} (${docs.filter((d) => d[QMS.Template] == null).length} version(s))`)
    const walk = (parent: string, depth: number): void => {
      const kids = pms.filter((p) => p.parent === parent).sort((a, b) => String(a.rank).localeCompare(String(b.rank)))
      for (const pm of kids) {
        const meta = metas.find((m) => m._id === pm.meta)
        const mine = pds.filter((p) => p.attachedTo === pm._id)
        const isFolder = mine.some((p) => p.document === QMS.Folder)
        const versions = docs.filter((d) => mine.some((p) => p.document === d._id) && (args.includeTemplates === true || d[QMS.Template] == null)).sort(newest)
        if (isFolder) out.push(`${'  '.repeat(depth)}- 📁 ${String(meta?.title ?? '?')}`)
        else if (versions.length > 0) {
          const d = versions[0]
          out.push(`${'  '.repeat(depth)}- **${String(d.code)}** ${String(d.title)} ${version(d)} — ${state(d)}${d.effectiveDate != null ? ` · effective ${formatDate(d.effectiveDate)}` : ''}${d.owner != null ? ` · owner ${names.get(d.owner) ?? '?'}` : ''}${versions.length > 1 ? ` · ${versions.length} versions` : ''}${d[QMS.Template] != null ? ' · template' : ''}`)
        }
        walk(pm.meta, depth + 1)
      }
    }
    walk(QMS.NoParent, 0)
  }
  return out.join('\n')
})

export const getControlledDocument = wrapToolHandler<z.infer<typeof S.GetControlledDocumentSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const ref = args.document.trim()
  let docs: any[] = await client.findAll(QMS.Doc, { code: ref.toUpperCase() })
  if (docs.length === 0) { const byId = await client.findOne(QMS.Doc, { _id: ref }); if (byId != null) docs = await client.findAll(QMS.Doc, { attachedTo: byId.attachedTo }) }
  if (docs.length === 0) {
    const all: any[] = await client.findAll(QMS.Doc, {})
    const hits = all.filter((d) => String(d.title).toLowerCase() === ref.toLowerCase())
    if (hits.length > 0) docs = all.filter((d) => d.attachedTo === hits[0].attachedTo)
  }
  if (docs.length === 0) throw new Error(`Controlled document '${args.document}' not found (use its code like SOP-12, its title or id).`)
  docs.sort(newest)
  const d = docs[0]
  const names = await peopleNames(client)
  const who = (ids: string[] | undefined): string => (ids ?? []).map((i) => names.get(i) ?? '?').join(', ') || '—'
  const [category, change, requests] = await Promise.all([
    d.category != null ? client.findOne(QMS.Category, { _id: d.category }) : undefined,
    d.changeControl != null ? client.findOne(QMS.ChangeControl, { _id: d.changeControl }) : undefined,
    client.findAll(QMS.Request, { attachedTo: d._id })
  ])
  const out = [
    `## ${String(d.code)} ${String(d.title)} ${version(d)}`,
    `**State:** ${state(d)} · **Category:** ${category != null ? `${String(category.code)} ${String(category.title)}` : '—'} · **Effective:** ${formatDate(d.effectiveDate)}${d.plannedEffectiveDate != null ? ` (planned ${formatDate(d.plannedEffectiveDate)})` : ''}`,
    `**Author:** ${who(d.author != null ? [d.author] : [])} · **Owner:** ${who(d.owner != null ? [d.owner] : [])} · **Co-authors:** ${who(d.coAuthors)}`,
    `**Reviewers:** ${who(d.reviewers)} · **Approvers:** ${who(d.approvers)}${d.reviewInterval != null ? ` · review every ${Number(d.reviewInterval)} months` : ''}`
  ]
  if (d.abstract != null && d.abstract !== '') out.push('', `**Abstract:** ${String(d.abstract)}`)
  if (change != null && [change.description, change.reason, change.impact].some((x) => x != null && x !== '')) {
    out.push('', '### Change control', `- Reason: ${markupToText(change.reason) || '—'}`, `- Description: ${markupToText(change.description) || '—'}`, `- Impact: ${markupToText(change.impact) || '—'}`)
  }
  if (requests.length > 0) {
    out.push('', '### Review / approval requests')
    for (const r of requests) out.push(`- ${String(r._class).split(':').pop() ?? ''}: ${String(r.status)} · approved by ${who(r.approved)} of ${who(r.requested)}${(r.rejected ?? []).length > 0 ? ` · rejected by ${who(r.rejected)}` : ''}`)
  }
  if (docs.length > 1) out.push('', '### Versions', ...docs.map((v) => `- ${version(v)} — ${state(v)}${v.effectiveDate != null ? ` · effective ${formatDate(v.effectiveDate)}` : ''} — \`${String(v._id)}\``))
  if (args.content !== false) {
    const text = await readMarkup(args.workspace, d.content)
    out.push('', '### Content', text.trim() !== '' ? text : '_(empty)_')
  }
  return out.join('\n')
})

export const listTrainings = wrapToolHandler<z.infer<typeof S.ListTrainingsSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const all: any[] = await client.findAll(QMS.Training, {}, { sort: { revision: SortingOrder.Descending } })
  const latest = new Map<string, any>()
  for (const t of all) if (!latest.has(t.code)) latest.set(t.code, t)
  const list = [...latest.values()].filter((t) => args.includeArchived === true || !['archived', 'deleted'].includes(t.state))
  if (list.length === 0) return 'No trainings.'
  const names = await peopleNames(client)
  const lines = list.map((t) => `- **${String(t.code)}** rev ${Number(t.revision)} — ${String(t.title)} — ${String(t.state)} · pass ${Number(t.passingScore)}% · ${Number(t.questions ?? 0)} question(s) · ${Number(t.requests ?? 0)} request(s) · owner ${names.get(t.owner) ?? '?'}`)
  return `## Trainings (${list.length})\n\n${lines.join('\n')}`
})

export const getTraining = wrapToolHandler<z.infer<typeof S.GetTrainingSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const all: any[] = await client.findAll(QMS.Training, {}, { sort: { revision: SortingOrder.Descending } })
  const t = all.find((x) => x._id === args.training || String(x.code).toLowerCase() === args.training.toLowerCase() || String(x.title).toLowerCase() === args.training.toLowerCase())
  if (t == null) throw new Error(`Training '${args.training}' not found (code like TR-3, title or id).`)
  const names = await peopleNames(client)
  const [questions, requests]: any[][] = await Promise.all([
    client.findAll(QMS.Question, { attachedTo: t._id }, { sort: { rank: SortingOrder.Ascending } }),
    client.findAll(QMS.TrainingRequest, { attachedTo: t._id })
  ])
  const attempts: any[] = requests.length > 0 ? await client.findAll(QMS.Attempt, { attachedTo: { $in: requests.map((r) => r._id) } }) : []
  const out = [`## ${String(t.code)} rev ${Number(t.revision)}: ${String(t.title)}`, `**State:** ${String(t.state)} · **Passing score:** ${Number(t.passingScore)}%${t.releasedOn != null ? ` · released ${formatDate(t.releasedOn)}` : ''}`]
  const desc = markupToText(t.description).trim()
  if (desc !== '') out.push('', desc)
  out.push('', `### Questions (${questions.length})`)
  questions.forEach((q, i) => {
    const kind = String(q._class).split(':').pop() ?? ''
    const opts: string[] = (q.questionData?.options ?? []).map((o: any) => markupToText(o.label).trim())
    const a = q.assessmentData ?? {}
    const correct = new Set<number>(a.correctIndex != null ? [a.correctIndex] : a.correctIndices ?? [])
    out.push(`${i + 1}. ${markupToText(q.title).trim()} _(${kind})_`)
    opts.forEach((o, j) => out.push(`   - ${args.showAnswers === true && correct.has(j) ? '✅ ' : ''}${o}`))
    if (args.showAnswers === true && a.correctOrder != null) out.push(`   - correct order: ${(a.correctOrder as number[]).map((j) => opts[j]).join(' → ')}`)
  })
  if (requests.length > 0) {
    out.push('', '### Assignments')
    for (const r of requests) {
      const mine = attempts.filter((x) => x.attachedTo === r._id)
      const per = (r.trainees ?? []).map((p: string) => {
        const best = mine.filter((x) => x.owner === p).sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0))[0]
        return `${names.get(p) ?? '?'}: ${best != null ? `${String(best.state)}${best.score != null ? ` ${Number(best.score)}%` : ''}` : 'not started'}`
      })
      out.push(`- due ${formatDate(r.dueDate)}${r.canceledOn != null ? ' (canceled)' : ''} — ${per.join('; ') || 'no trainees'}`)
    }
  }
  return out.join('\n')
})
