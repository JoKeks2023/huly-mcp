import tracker from '@hcengineering/tracker'
import { SortingOrder } from '@hcengineering/core'
import { getConnection } from '../connection'
import { wrapToolHandler } from '../utils/errors'
import { C, IDS } from '../utils/classes'
import { formatDate, markupToText } from '../utils/format'
import { peopleNames, socialIdNames } from '../utils/people'
import type { z } from 'zod'
import type { ListPullRequestsSchema, GetPullRequestSchema } from '../schemas'

// Enums of the GitHub integration (services/github/github).
const STATE = ['open', 'closed', 'merged']
const DECISION = ['changes requested', 'approved', 'review required']
const REVIEW = ['pending', 'commented', 'approved', 'changes requested', 'dismissed']

export const listPullRequests = wrapToolHandler<z.infer<typeof ListPullRequestsSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const query: Record<string, unknown> = {}
  if (args.projectIdentifier != null) {
    const project = await client.findOne(tracker.class.Project, { identifier: args.projectIdentifier })
    if (project == null) throw new Error(`Project '${args.projectIdentifier}' not found.`)
    query.space = project._id
  }
  if (args.issue != null) {
    const issue = await client.findOne(tracker.class.Issue, { identifier: args.issue })
    if (issue == null) throw new Error(`Issue '${args.issue}' not found.`)
    query.attachedTo = issue._id
  }
  if (args.state !== 'all') query.state = STATE.indexOf(args.state)

  const prs: any[] = await client.findAll(C.PullRequest, query, { limit: args.limit, sort: { modifiedOn: SortingOrder.Descending } })
  if (prs.length === 0) return `No ${args.state === 'all' ? '' : args.state + ' '}pull requests found.`
  const names = await peopleNames(client)
  const lines = prs.map((pr) => {
    const gh = pr[IDS.GithubIssueMixin] ?? {}
    const decision = pr.reviewDecision != null ? ` · ${DECISION[pr.reviewDecision] ?? pr.reviewDecision}` : ''
    const draft = pr.draft === true ? ' · draft' : ''
    const who = pr.assignee != null ? ` · ${names.get(pr.assignee) ?? pr.assignee}` : ''
    return `- **${pr.identifier as string}** [${STATE[pr.state] ?? pr.state}${draft}${decision}] ${pr.title as string}${who}\n  #${gh.githubNumber as number ?? '?'} ${gh.url as string ?? ''} · updated ${formatDate(pr.modifiedOn)}`
  })
  return `## Pull requests (${prs.length})\n\n${lines.join('\n')}`
})

export const getPullRequest = wrapToolHandler<z.infer<typeof GetPullRequestSchema>>(async (args) => {
  const client: any = await getConnection(args.workspace)
  const pr: any = await client.findOne(C.PullRequest, { identifier: args.identifier })
  if (pr == null) throw new Error(`Pull request '${args.identifier}' not found.`)
  const gh = pr[IDS.GithubIssueMixin] ?? {}
  const issue = pr.attachedTo !== tracker.ids.NoParent ? await client.findOne(tracker.class.Issue, { _id: pr.attachedTo }) : undefined
  const reviews: any[] = await client.findAll(C.PullRequestReview, { attachedTo: pr._id }, { sort: { createdOn: SortingOrder.Ascending } })
  const comments: any[] = await client.findAll(C.ReviewComment, { attachedTo: pr._id }, { sort: { createdOn: SortingOrder.Ascending }, limit: 30 })
  const who = await socialIdNames(client, [...new Set([...reviews, ...comments].map((r) => r.createdBy))])

  const lines = [
    `## ${pr.identifier as string}: ${pr.title as string}`,
    `**State:** ${STATE[pr.state] ?? pr.state}${pr.draft === true ? ' (draft)' : ''}${pr.mergedAt != null ? `, merged ${formatDate(pr.mergedAt)}` : ''}${pr.closedAt != null && pr.mergedAt == null ? `, closed ${formatDate(pr.closedAt)}` : ''}`,
    `**Review decision:** ${pr.reviewDecision != null ? DECISION[pr.reviewDecision] : 'none'}`,
    `**GitHub:** #${gh.githubNumber as number ?? '?'} ${gh.url as string ?? ''}`,
    `**Branch:** ${pr.head?.name as string ?? '(deleted)'} → ${pr.base?.name as string ?? '?'} · ${pr.files as number ?? '?'} file(s) changed`,
    `**Issue:** ${issue != null ? `${issue.identifier as string}: ${issue.title as string}` : 'none'}`
  ]
  if (reviews.length > 0) {
    lines.push('', '**Reviews:**')
    for (const r of reviews) {
      const body = markupToText(r.body)
      lines.push(`- ${formatDate(r.createdOn)} ${who.get(r.createdBy) ?? 'GitHub user'}: ${REVIEW[r.state] ?? r.state}${body !== '' ? ` — ${body.slice(0, 300)}` : ''}`)
    }
  }
  if (comments.length > 0) {
    lines.push('', `**Review comments (${comments.length}${comments.length === 30 ? '+' : ''}):**`)
    for (const c of comments) lines.push(`- \`${c.path as string}:${c.line as number ?? c.originalLine as number ?? '?'}\` ${who.get(c.createdBy) ?? ''}: ${markupToText(c.body).slice(0, 300)}`)
  }
  return lines.join('\n')
})
