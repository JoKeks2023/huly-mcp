// Surveys (survey plugin, read-only): question sets and their polls (filled-in copies attached to
// e.g. a candidate or application). A poll keeps its own copy of the questions.
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import type { z } from 'zod'
import type * as S from '../schemas'

export const SV = { Survey: 'survey:class:Survey', Poll: 'survey:class:Poll' } as const
const KIND: Record<string, string> = { string: 'free text', option: 'single choice', options: 'multiple choice' }

export const listSurveys = wrapToolHandler<z.infer<typeof S.ListSurveysSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const surveys: any[] = await client.findAll(SV.Survey, {})
  if (surveys.length === 0) return 'No surveys (the module may be disabled).'
  const polls: any[] = await client.findAll(SV.Poll, {})
  const lines = surveys.map((s) => {
    const mine = polls.filter((p) => p.survey === s._id)
    return `- **${String(s.name)}** — ${(s.questions ?? []).length} question(s) · ${mine.length} poll(s), ${mine.filter((p) => p.isCompleted === true).length} completed — \`${String(s._id)}\``
  })
  return `## Surveys (${surveys.length})\n\n${lines.join('\n')}`
})

export const getSurvey = wrapToolHandler<z.infer<typeof S.GetSurveySchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const all: any[] = await client.findAll(SV.Survey, {})
  const s = all.find((x) => x._id === args.survey || String(x.name).toLowerCase() === args.survey.trim().toLowerCase())
  if (s == null) throw new Error(`Survey '${args.survey}' not found. Surveys: ${all.map((x) => x.name).join(', ') || 'none'}.`)
  const polls: any[] = await client.findAll(SV.Poll, { survey: s._id })
  const done = polls.filter((p) => p.isCompleted === true)
  const out = [`## ${String(s.name)}`]
  if (s.prompt != null && s.prompt !== '') out.push(String(s.prompt))
  out.push('', `### Questions — results from ${done.length} completed of ${polls.length} poll(s)`)
  ;(s.questions ?? []).forEach((q: any, i: number) => {
    out.push(`${i + 1}. ${String(q.name)} _(${KIND[q.kind] ?? q.kind}${q.isMandatory === true ? ', required' : ''})_`)
    const answers = done.map((p) => (p.questions ?? [])[i]).filter((a: any) => a != null && a.name === q.name)
    if (q.kind === 'string') {
      for (const a of answers.filter((x: any) => x.answer != null && x.answer !== '').slice(0, args.maxTextAnswers ?? 10)) out.push(`   - “${String(a.answer)}”`)
      return
    }
    const opts: string[] = q.options ?? []
    opts.forEach((o, j) => {
      const n = answers.filter((a: any) => (a.answers ?? []).includes(j)).length
      out.push(`   - ${o}${done.length > 0 ? `: ${n}` : ''}`)
    })
    const custom = answers.filter((a: any) => a.answer != null && a.answer !== '')
    if (q.hasCustomOption === true && custom.length > 0) out.push(`   - other: ${custom.map((a: any) => `“${String(a.answer)}”`).join(', ')}`)
  })
  return out.join('\n')
})
