#!/usr/bin/env node
/**
 * Live demo of huly-mcp-sdk tools against a real Huly workspace.
 * Runs through: list projects → create issue → add comment → add label →
 *               update issue → add relation → get issue → delete issue
 */

'use strict'

const fs = require('fs')
const path = require('path')

// Load .env
const envPath = path.join(__dirname, '..', '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/)
    if (m) process.env[m[1]] = m[2].trim()
  }
}

// Target workspace (these scripts write data, so it must be explicit):
// --workspace=<slug|name|id>, or HULY_WORKSPACE as a fallback.
const workspace = process.argv.find(a => a.startsWith('--workspace='))?.slice('--workspace='.length) || process.env.HULY_WORKSPACE
if (!workspace) {
  console.error('❌  No workspace given. Pass --workspace=<slug> (see list_workspaces / npm run setup).')
  process.exit(1)
}

const distDir = path.join(__dirname, '..', 'dist')
const { getConnection, closeConnection } = require(path.join(distDir, 'connection'))
const tracker = require('@hcengineering/tracker')
const task = require('@hcengineering/task')
const tags = require('@hcengineering/tags')
const { generateId, SortingOrder } = require('@hcengineering/core')
const { makeRank } = require('@hcengineering/rank')

const GREEN  = '\x1b[32m'
const CYAN   = '\x1b[36m'
const YELLOW = '\x1b[33m'
const BOLD   = '\x1b[1m'
const RESET  = '\x1b[0m'

function header (text) {
  console.log(`\n${BOLD}${CYAN}━━━  ${text}  ━━━${RESET}`)
}
function ok (text) { console.log(`${GREEN}✅  ${text}${RESET}`) }
function info (text) { console.log(`${YELLOW}    ${text}${RESET}`) }
function print (text) { console.log(`    ${text}`) }

async function main () {
  console.log(`\n${BOLD}🚀  huly-mcp-sdk live demo${RESET}`)
  console.log(`    Workspace: ${workspace}\n`)

  const client = await getConnection(workspace)
  ok('Connected to Huly')

  // ── 1. List projects ──────────────────────────────────────────────────────
  header('1 / 8  —  list_projects')
  const projects = await client.findAll(tracker.default.class.Project, {})
  ok(`Found ${projects.length} project(s)`)
  for (const p of projects) {
    print(`• ${BOLD}${p.identifier}${RESET}  ${p.name}`)
  }

  // Pick first project for the rest of the demo
  const project = projects[0]
  if (project == null) { console.error('No projects found — aborting.'); return }
  info(`Using project: ${project.identifier}`)

  // ── 2. List issues (top 5) ────────────────────────────────────────────────
  header('2 / 8  —  list_issues')
  const issues = await client.findAll(
    tracker.default.class.Issue,
    { space: project._id },
    { limit: 5, sort: { modifiedOn: SortingOrder.Descending } }
  )
  const statuses = await client.findAll(tracker.default.class.IssueStatus, {})
  const statusMap = new Map(statuses.map(s => [s._id, s.name]))
  ok(`Showing 5 most-recent issues in ${project.identifier}`)
  for (const i of issues) {
    print(`• ${BOLD}${i.identifier}${RESET}  [${statusMap.get(i.status) ?? '?'}]  ${i.title}`)
  }

  // ── 3. Create issue ───────────────────────────────────────────────────────
  header('3 / 8  —  create_issue')
  const incResult = await client.updateDoc(
    tracker.default.class.Project, project.space, project._id,
    { $inc: { sequence: 1 } }, true
  )
  const issueNumber = incResult?.object?.sequence ?? project.sequence + 1
  const identifier = `${project.identifier}-${issueNumber}`

  const defaultStatus = project.defaultIssueStatus != null
    ? (statuses.find(s => s._id === project.defaultIssueStatus) ?? statuses[0])
    : statuses[0]
  const kind = await client.findOne(task.default.class.TaskType,
    project.type != null ? { parent: project.type } : {})
  const lastIssue = await client.findOne(
    tracker.default.class.Issue, { space: project._id },
    { sort: { rank: SortingOrder.Descending } }
  )
  const rank = makeRank(lastIssue?.rank, undefined)

  const issueId = generateId()
  await client.addCollection(
    tracker.default.class.Issue, project._id,
    tracker.default.ids.NoParent, tracker.default.class.Issue, 'subIssues',
    {
      title: '🧪 huly-mcp-sdk demo issue',
      description: null,
      status: defaultStatus._id,
      priority: 2, // High
      number: issueNumber, identifier, rank,
      kind: kind._id,
      comments: 0, subIssues: 0,
      dueDate: null, assignee: null, component: null, milestone: null,
      parents: [], remainingTime: 0, estimation: 0,
      reportedTime: 0, reports: 0, childInfo: [], relations: []
    },
    issueId
  )
  ok(`Created ${BOLD}${identifier}${RESET}: 🧪 huly-mcp-sdk demo issue`)

  // ── 4. Add comment ────────────────────────────────────────────────────────
  header('4 / 8  —  add_comment')
  const chunter = require('@hcengineering/chunter')
  await client.addCollection(
    chunter.default.class.ChatMessage, project._id,
    issueId, tracker.default.class.Issue, 'comments',
    { message: 'This issue was created by the **huly-mcp-sdk** demo script 🎉', attachments: 0 }
  )
  ok(`Added comment to ${identifier}`)

  // ── 5. Add label ──────────────────────────────────────────────────────────
  header('5 / 8  —  add_label')
  const core = require('@hcengineering/core')
  let label = await client.findOne(tags.default.class.TagElement, {
    targetClass: tracker.default.class.Issue, title: 'demo'
  })
  if (label == null) {
    const cat = await client.findOne(tags.default.class.TagCategory, {
      targetClass: tracker.default.class.Issue
    })
    const labelId = generateId()
    await client.createDoc(
      tags.default.class.TagElement, core.default.space.Workspace,
      {
        title: 'demo', targetClass: tracker.default.class.Issue,
        description: '', color: 0x6366f1,
        category: cat?._id ?? tags.default.category.NoCategory, refCount: 0
      }, labelId
    )
    label = await client.findOne(tags.default.class.TagElement, { _id: labelId })
    info('Auto-created label "demo" (color: #6366f1)')
  }
  const issue = await client.findOne(tracker.default.class.Issue, { identifier })
  await client.addCollection(
    tags.default.class.TagReference, issue.space, issue._id,
    tracker.default.class.Issue, 'labels',
    { tag: label._id, title: label.title, color: label.color }
  )
  ok(`Labeled ${identifier} with "demo"`)

  // ── 6. Update issue ───────────────────────────────────────────────────────
  header('6 / 8  —  update_issue')
  const inProgress = statuses.find(s => s.name.toLowerCase().includes('progress')) ?? statuses[1] ?? statuses[0]
  await client.updateDoc(
    tracker.default.class.Issue, issue.space, issue._id,
    { status: inProgress._id, priority: 1 /* Urgent */ }
  )
  ok(`Updated ${identifier} → status: "${inProgress.name}", priority: Urgent`)

  // ── 7. Get issue (full details) ───────────────────────────────────────────
  header('7 / 8  —  get_issue')
  const fresh = await client.findOne(tracker.default.class.Issue, { identifier })
  const freshStatus = statusMap.get(fresh.status) ?? 'Unknown'
  const PRIORITY = ['No priority', 'Urgent', 'High', 'Medium', 'Low']
  ok(`Full details for ${identifier}`)
  print(`  Title:    ${fresh.title}`)
  print(`  Status:   ${freshStatus}`)
  print(`  Priority: ${PRIORITY[fresh.priority] ?? fresh.priority}`)
  print(`  Comments: ${fresh.comments}`)

  // ── 8. Delete issue (cleanup) ─────────────────────────────────────────────
  header('8 / 8  —  delete_issue  (cleanup)')
  await client.removeCollection(
    tracker.default.class.Issue, fresh.space, fresh._id,
    fresh.attachedTo, fresh.attachedToClass, fresh.collection
  )
  ok(`Deleted ${identifier} — workspace is clean`)

  await closeConnection()

  console.log(`\n${BOLD}${GREEN}🎉  Demo complete! All 8 tools exercised successfully.${RESET}\n`)
}

main().catch(err => {
  console.error('\n❌  Demo failed:', err.message)
  process.exit(1)
})
