// Trainings (training + questions plugins): create a draft with questions, release it, assign it
// to people, cancel an assignment. Mirrors Huly's own UI (training-resources/questions-resources):
// codes TR-n from the training sequence, a release archives the previous released revision and
// releases the questions, assignments only for released trainings.
import { SortingOrder } from '@hcengineering/core'
import { makeRank } from '@hcengineering/rank'
import type { z } from 'zod'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { formatDate } from '../utils/format'
import { markdownToProseMirror } from '../utils/markdown'
import { currentPerson, findPerson } from '../utils/people'
import type * as S from '../schemas'

const T = {
  Training: 'training:class:Training',
  Request: 'training:class:TrainingRequest',
  Space: 'training:space:Trainings',
  Question: 'questions:class:Question'
}

const QUESTION_CLASS: Record<string, { question: string, assessment: string }> = {
  single: { question: 'questions:class:SingleChoiceQuestion', assessment: 'questions:class:SingleChoiceAssessment' },
  multiple: { question: 'questions:class:MultipleChoiceQuestion', assessment: 'questions:class:MultipleChoiceAssessment' },
  ordering: { question: 'questions:class:OrderingQuestion', assessment: 'questions:class:OrderingAssessment' }
}

type QuestionInput = z.infer<typeof S.TrainingQuestionSchema>

/** Question data (and assessment data when correct answers are given), checked before anything is written. */
export function questionDoc (q: QuestionInput, n: number): { _class: string, data: Record<string, unknown> } {
  const where = `Question ${n} ("${q.title}")`
  if (q.options.length < 2) throw new Error(`${where}: give at least two options.`)
  const options = q.options.map((label) => ({ label }))
  const kind = QUESTION_CLASS[q.type]
  if (q.correct == null) return { _class: kind.question, data: { title: q.title, questionData: { options } } }
  const idx = (Array.isArray(q.correct) ? q.correct : [q.correct]).map((c) => {
    const i = typeof c === 'number' ? c - 1 : q.options.findIndex((o) => o.trim().toLowerCase() === String(c).trim().toLowerCase())
    if (i < 0 || i >= q.options.length) throw new Error(`${where}: correct answer '${String(c)}' is not one of the options (use the option text or its number, 1 = first).`)
    return i
  })
  let assessmentData: Record<string, unknown>
  if (q.type === 'single') {
    if (idx.length !== 1) throw new Error(`${where}: a single-choice question has exactly one correct answer.`)
    assessmentData = { correctIndex: idx[0] }
  } else if (q.type === 'multiple') {
    assessmentData = { correctIndices: [...new Set(idx)].sort((a, b) => a - b) }
  } else {
    // correct = the options in the right order; Huly stores, per option, its position (1-based).
    if (idx.length !== q.options.length || new Set(idx).size !== idx.length) throw new Error(`${where}: for ordering, list every option once, in the correct order.`)
    const correctOrder = q.options.map((_o, i) => idx.indexOf(i) + 1)
    assessmentData = { correctOrder }
  }
  return { _class: kind.assessment, data: { title: q.title, questionData: { options }, assessmentData } }
}

async function findTraining (client: any, ref: string, state?: string): Promise<any> {
  const all: any[] = await client.findAll(T.Training, {}, { sort: { revision: SortingOrder.Descending } })
  const matches = all.filter((x) => x._id === ref || String(x.code).toLowerCase() === ref.toLowerCase() || String(x.title).toLowerCase() === ref.toLowerCase())
  if (matches.length === 0) throw new Error(`Training '${ref}' not found (code like TR-3, title or id; list_trainings).`)
  if (state != null) {
    const inState = matches.find((x) => x.state === state)
    if (inState != null) return inState
    throw new Error(`Training '${ref}' has no ${state} revision (latest: rev ${Number(matches[0].revision)}, ${String(matches[0].state)}).`)
  }
  return matches[0]
}

async function addQuestions (client: any, training: any, questions: QuestionInput[], owner: string): Promise<number> {
  const docs = questions.map((q, i) => questionDoc(q, i + 1)) // all validated first
  const existing: any[] = await client.findAll(T.Question, { attachedTo: training._id, collection: 'questions' }, { sort: { rank: SortingOrder.Descending }, limit: 1 })
  let rank: string | undefined = existing[0]?.rank
  for (const d of docs) {
    rank = makeRank(rank, undefined)
    await client.addCollection(d._class, training.space, training._id, T.Training, 'questions', { ...d.data, rank, owner, releasedOn: null, releasedBy: null })
  }
  return docs.length
}

export const createTraining = wrapToolHandler<z.infer<typeof S.CreateTrainingSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  ;(args.questions ?? []).forEach((q, i) => questionDoc(q, i + 1)) // fail before taking a code
  const me = await currentPerson(client)
  const sequence = await client.findOne('core:class:Sequence', { attachedTo: T.Training })
  if (sequence == null) throw new Error('The training module is not set up in this workspace (no training sequence).')
  const inc: any = await client.updateDoc(sequence._class, sequence.space, sequence._id, { $inc: { sequence: 1 } }, true)
  const code = `TR-${Number(inc?.object?.sequence ?? sequence.sequence + 1)}`
  const id = await client.createDoc(T.Training, T.Space, {
    title: args.title,
    code,
    revision: 1,
    state: 'draft',
    owner: me._id,
    author: me._id,
    description: JSON.stringify(markdownToProseMirror(args.description ?? '')),
    attachments: 0,
    passingScore: args.passingScore,
    releasedOn: null,
    releasedBy: null,
    questions: 0,
    requests: 0
  })
  const training = await client.findOne(T.Training, { _id: id })
  const n = args.questions != null && args.questions.length > 0 ? await addQuestions(client, training, args.questions, me._id) : 0
  return `✅ Created **${code}** "${args.title}" (draft, pass ${args.passingScore}%, ${n} question(s)). Next: release_training, then assign_training.`
})

export const addTrainingQuestions = wrapToolHandler<z.infer<typeof S.AddTrainingQuestionsSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const training = await findTraining(client, args.training, 'draft')
  const me = await currentPerson(client)
  const n = await addQuestions(client, training, args.questions, me._id)
  return `✅ Added ${n} question(s) to **${String(training.code)}** (draft).`
})

export const releaseTraining = wrapToolHandler<z.infer<typeof S.ReleaseTrainingSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const draft = await findTraining(client, args.training, 'draft')
  const me = await currentPerson(client)
  const questions: any[] = await client.findAll(T.Question, { attachedTo: draft._id, collection: 'questions' })
  if (questions.length === 0) throw new Error(`${String(draft.code)} has no questions — add some first (add_training_questions).`)
  const released: any[] = await client.findAll(T.Training, { code: draft.code, state: 'released' })
  const now = Date.now()
  for (const old of released) await client.updateDoc(old._class, old.space, old._id, { state: 'archived' })
  for (const q of questions) {
    if (q.releasedOn == null) await client.updateCollection(q._class, q.space, q._id, q.attachedTo, q.attachedToClass, q.collection, { releasedOn: now, releasedBy: me._id })
  }
  await client.updateDoc(draft._class, draft.space, draft._id, { state: 'released', releasedOn: now, releasedBy: me._id, author: me._id })
  return `✅ Released **${String(draft.code)}** rev ${Number(draft.revision)} with ${questions.length} question(s)${released.length > 0 ? `; archived ${released.length} earlier release(s)` : ''}. Assign it with assign_training.`
})

export const assignTraining = wrapToolHandler<z.infer<typeof S.AssignTrainingSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const training = await findTraining(client, args.training, 'released')
  const trainees = [...new Set((await Promise.all(args.trainees.map(async (n) => await findPerson(client, n)))).map((p) => p._id))]
  const me = await currentPerson(client)
  const dueDate = args.dueDate != null ? new Date(args.dueDate).getTime() : null
  if (dueDate != null && Number.isNaN(dueDate)) throw new Error(`Cannot read dueDate '${args.dueDate}' (ISO date, e.g. 2026-12-01).`)
  await client.addCollection(T.Request, training.space, training._id, T.Training, 'requests', {
    owner: me._id,
    trainees,
    dueDate,
    maxAttempts: args.maxAttempts ?? null,
    attempts: 0,
    canceledOn: null,
    canceledBy: null
  })
  return `✅ Assigned **${String(training.code)}** "${String(training.title)}" to ${trainees.length} person(s)${dueDate != null ? `, due ${formatDate(dueDate)}` : ''}${args.maxAttempts != null ? `, max ${args.maxAttempts} attempt(s)` : ''}. Progress: get_training.`
})

export const cancelTrainingRequest = wrapToolHandler<z.infer<typeof S.CancelTrainingRequestSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const request = await client.findOne(T.Request, { _id: args.requestId })
  if (request == null) throw new Error(`Assignment '${args.requestId}' not found (ids are shown by get_training).`)
  if (request.canceledOn != null) return `Assignment was already canceled on ${formatDate(request.canceledOn)}.`
  const me = await currentPerson(client)
  await client.updateCollection(request._class, request.space, request._id, request.attachedTo, request.attachedToClass, request.collection, { canceledOn: Date.now(), canceledBy: me._id })
  return '✅ Assignment canceled; the trainees no longer see it as open.'
})
