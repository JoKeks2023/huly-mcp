// Eval tasks: what people ask an agent to do in Huly. Each task sets up its data, gives the
// agent a prompt in plain words (no tool names), and checks the result in Huly afterwards.
import tracker from '@hcengineering/tracker'
import { createIssue, updateIssue } from '../src/tools/issues'
import { createComponent } from '../src/tools/components'
import { createMilestone } from '../src/tools/milestones'
import { addBlockedBy } from '../src/tools/relations'

export interface Ctx { client: any, workspace: string, project: string, [k: string]: any }
export interface Task {
  id: string
  what: string
  setup?: (ctx: Ctx) => Promise<Record<string, any>>
  prompt: (ctx: Ctx) => string
  check: (ctx: Ctx, answer: string, tools: string[]) => Promise<{ ok: boolean, why: string }>
}

const where = (ctx: Ctx): string => `Huly workspace "${ctx.workspace}", project ${ctx.project}`
const text = (r: any): string => String(r?.content?.[0]?.text ?? '')
const idOf = (r: any): string => /([A-Z]+-\d+)/.exec(text(r))?.[1] ?? ''

async function issues (ctx: Ctx, titlePrefix: string): Promise<any[]> {
  const project = await ctx.client.findOne(tracker.class.Project, { identifier: ctx.project })
  return (await ctx.client.findAll(tracker.class.Issue, { space: project._id })).filter((i: any) => String(i.title).toLowerCase().startsWith(titlePrefix.toLowerCase()))
}
async function statusName (ctx: Ctx, id: string): Promise<string> {
  return (await ctx.client.findOne(tracker.class.IssueStatus, { _id: id }))?.name ?? '?'
}
async function comments (ctx: Ctx, issue: any): Promise<string[]> {
  return (await ctx.client.findAll('chunter:class:ChatMessage', { attachedTo: issue._id })).map((c: any) => String(c.message))
}
const make = async (ctx: Ctx, title: string, more: Record<string, unknown> = {}): Promise<string> =>
  idOf(await createIssue({ workspace: ctx.workspace, projectIdentifier: ctx.project, title, priority: 'NoPriority', ...more } as any))

export const TASKS: Task[] = [
  {
    id: 't1',
    what: 'Create a bug with priority and due date',
    prompt: (ctx) => `In ${where(ctx)}: file a bug "zz-eval Safari login fails". It's high priority and must be fixed by 2026-12-01.`,
    check: async (ctx) => {
      const found = await issues(ctx, 'zz-eval Safari')
      if (found.length !== 1) return { ok: false, why: `${found.length} issues created` }
      const i = found[0]
      const due = i.dueDate != null ? new Date(i.dueDate).toISOString().slice(0, 10) : 'none'
      return { ok: i.priority === 2 && due === '2026-12-01', why: `priority=${String(i.priority)} due=${due}` }
    }
  },
  {
    id: 't2',
    what: 'Plan an epic with sub-issues and a blocker',
    prompt: (ctx) => `In ${where(ctx)}: plan an epic "zz-eval Onboarding" with three sub-issues: "zz-eval Welcome screen", "zz-eval Account setup", "zz-eval First project". "First project" can only start after "Account setup" is done.`,
    check: async (ctx) => {
      const epic = (await issues(ctx, 'zz-eval Onboarding'))[0]
      if (epic == null) return { ok: false, why: 'no epic' }
      const all = await issues(ctx, 'zz-eval')
      const children = all.filter((i) => i.attachedTo === epic._id)
      const first = children.find((c) => /first project/i.test(c.title))
      const setup = children.find((c) => /account setup/i.test(c.title))
      const blocked = first != null && setup != null && (first.blockedBy ?? []).some((b: any) => b._id === setup._id)
      return { ok: children.length === 3 && blocked && all.length === 4, why: `children=${children.length} blocked=${String(blocked)} total=${all.length}` }
    }
  },
  {
    id: 't3',
    what: 'Pick up an issue: status, assignee, comment',
    setup: async (ctx) => ({ id: await make(ctx, 'zz-eval Fix CSV export') }),
    prompt: (ctx) => `In ${where(ctx)}: I'm starting work on the issue about fixing the CSV export now. Make that visible in Huly and note that I'm starting with the date columns.`,
    check: async (ctx) => {
      const i = (await issues(ctx, 'zz-eval Fix CSV'))[0]
      const st = await statusName(ctx, i.status)
      const cs = await comments(ctx, i)
      const noted = cs.some((c) => /date/i.test(c))
      return { ok: st === 'In Progress' && i.assignee != null && noted, why: `status=${st} assignee=${i.assignee != null} comment=${noted}` }
    }
  },
  {
    id: 't4',
    what: 'Do not create a duplicate',
    setup: async (ctx) => ({ id: await make(ctx, 'zz-eval Dark mode toggle in settings') }),
    prompt: (ctx) => `In ${where(ctx)}: we need a dark mode toggle in the settings — make sure there is an issue for it.`,
    check: async (ctx) => {
      const n = (await issues(ctx, '')).filter((i) => /dark mode/i.test(String(i.title))).length
      return { ok: n === 1, why: `${n} dark-mode issue(s)` }
    }
  },
  {
    id: 't5',
    what: 'Hand back finished work with a PR link',
    setup: async (ctx) => {
      const id = await make(ctx, 'zz-eval Cache warmup')
      await updateIssue({ workspace: ctx.workspace, identifier: id, statusName: 'In Progress' } as any)
      return { id }
    },
    prompt: (ctx) => `In ${where(ctx)}: I finished the cache warmup issue; the pull request is https://github.com/JoKeks2023/huly-mcp/pull/123. Hand it over for review.`,
    check: async (ctx) => {
      const i = (await issues(ctx, 'zz-eval Cache'))[0]
      const st = await statusName(ctx, i.status)
      const cs = await comments(ctx, i)
      const linked = cs.some((c) => /123/.test(c))
      // "Review in progress" only where the project's issue workflow has it; otherwise the status stays.
      return { ok: ['Review in progress', 'In Progress'].includes(st) && linked, why: `status=${st} prLinked=${linked}` }
    }
  },
  {
    id: 't6',
    what: 'Milestone: create and assign',
    setup: async (ctx) => ({ id: await make(ctx, 'zz-eval Payment retries') }),
    prompt: (ctx) => `In ${where(ctx)}: create a milestone "zz-eval v1" due 2026-12-15 and put the payment retries issue into it.`,
    check: async (ctx) => {
      const project = await ctx.client.findOne(tracker.class.Project, { identifier: ctx.project })
      const ms = (await ctx.client.findAll(tracker.class.Milestone, { space: project._id })).find((m: any) => m.label === 'zz-eval v1')
      const i = (await issues(ctx, 'zz-eval Payment'))[0]
      return { ok: ms != null && i.milestone === ms._id, why: `milestone=${ms != null} assigned=${ms != null && i.milestone === ms._id}` }
    }
  },
  {
    id: 't7',
    what: 'Read: overdue issues',
    setup: async (ctx) => ({ id: await make(ctx, 'zz-eval Renew certificate', { dueDate: '2026-01-15' }) }),
    prompt: (ctx) => `In ${where(ctx)}: which issues are overdue? Just list their ids and titles.`,
    check: async (ctx, answer) => ({ ok: answer.includes(ctx.id) || /renew certificate/i.test(answer), why: `mentions ${String(ctx.id)}: ${answer.includes(ctx.id)}` })
  },
  {
    id: 't8',
    what: 'Read: what is the issue about, in one call if possible',
    setup: async (ctx) => {
      const id = await make(ctx, 'zz-eval Rate limiter', { description: 'Use a token bucket per API key. Limit: 100 requests per minute.' })
      return { id }
    },
    prompt: (ctx) => `In ${where(ctx)}: what does ${String(ctx.id)} ask for — which algorithm and which limit?`,
    check: async (_ctx, answer) => {
      const ok = /token bucket/i.test(answer) && /100/.test(answer)
      return { ok, why: `answer has algorithm+limit: ${ok}` }
    }
  },
  {
    id: 't9',
    what: 'Create with component and milestone (one call ideally)',
    setup: async (ctx) => {
      await createComponent({ workspace: ctx.workspace, projectIdentifier: ctx.project, label: 'zz-eval Backend' } as any)
      await createMilestone({ workspace: ctx.workspace, projectIdentifier: ctx.project, label: 'zz-eval v2', targetDate: '2026-12-20', status: 'Planned' } as any)
      return {}
    },
    prompt: (ctx) => `In ${where(ctx)}: the export crashes on files over 2 GB. File it — it's a backend problem and has to be fixed for release zz-eval v2.`,
    check: async (ctx) => {
      const found = (await issues(ctx, '')).filter((i) => /export|2 ?GB/i.test(String(i.title)))
      if (found.length !== 1) return { ok: false, why: `${found.length} issues` }
      const project = await ctx.client.findOne(tracker.class.Project, { identifier: ctx.project })
      const comp = (await ctx.client.findAll(tracker.class.Component, { space: project._id })).find((c: any) => c.label === 'zz-eval Backend')
      const ms = (await ctx.client.findAll(tracker.class.Milestone, { space: project._id })).find((m: any) => m.label === 'zz-eval v2')
      const i = found[0]
      return { ok: i.component === comp?._id && i.milestone === ms?._id, why: `component=${i.component === comp?._id} milestone=${i.milestone === ms?._id}` }
    }
  },
  {
    id: 't10',
    what: 'Pick up work and track a side finding without duplicates',
    setup: async (ctx) => ({ id: await make(ctx, 'zz-eval Request timeout after 30 s') }),
    prompt: (ctx) => `In ${where(ctx)}: I'm fixing the request timeout bug now. While looking at it I saw that the retry logic has no tests at all — that should be tracked too, as part of the timeout work.`,
    check: async (ctx) => {
      const main = (await issues(ctx, 'zz-eval Request timeout'))[0]
      const st = await statusName(ctx, main.status)
      const all = await issues(ctx, '')
      const side = all.filter((i) => /retry/i.test(i.title))
      const under = side.filter((i) => i.attachedTo === main._id)
      return { ok: st === 'In Progress' && main.assignee != null && side.length === 1, why: `status=${st} assignee=${main.assignee != null} retryIssues=${side.length} subIssue=${under.length === 1}` }
    }
  },
  {
    id: 't11',
    what: 'Status overview in few calls',
    setup: async (ctx) => {
      const a = await make(ctx, 'zz-eval Migrate database', { dueDate: '2026-02-01' })
      const b = await make(ctx, 'zz-eval Switch traffic')
      await addBlockedBy({ workspace: ctx.workspace, identifier: b, blockedBy: a } as any)
      return { a, b }
    },
    prompt: (ctx) => `Give me a short status overview of ${where(ctx)}: what is overdue and what is blocked?`,
    check: async (ctx, answer) => {
      const ok = answer.includes(ctx.a) || /migrate database/i.test(answer)
      const blocked = answer.includes(ctx.b) || /switch traffic/i.test(answer)
      return { ok: ok && blocked, why: `overdue=${ok} blocked=${blocked}` }
    }
  },
  {
    id: 't12',
    what: 'Same change on several issues',
    setup: async (ctx) => ({ ids: [await make(ctx, 'zz-eval Old banner'), await make(ctx, 'zz-eval Old footer'), await make(ctx, 'zz-eval Old header')] }),
    prompt: (ctx) => `In ${where(ctx)}: the three "Old …" layout issues (banner, footer, header) are not important any more — set them all to low priority.`,
    check: async (ctx) => {
      const olds = await issues(ctx, 'zz-eval Old')
      const low = olds.filter((i) => i.priority === 4).length
      return { ok: low === 3, why: `${low}/3 low` }
    }
  }
]
