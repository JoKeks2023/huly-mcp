#!/usr/bin/env node
/**
 * Bulk-import issues from a CSV file into a Huly tracker project.
 *
 * Usage:
 *   node scripts/import-csv.js <csv-file> <project-identifier>
 *
 * Example:
 *   node scripts/import-csv.js tasks.csv PROJ
 *
 * CSV format (first row = headers):
 *   title,priority,status,dueDate
 *   Fix login bug,High,In Progress,2025-04-01
 *   Add dark mode,Medium,,
 *
 * Required columns:
 *   title       — issue title (required)
 *
 * Optional columns:
 *   priority    — Urgent | High | Medium | Low | No priority  (default: No priority)
 *   status      — name of an existing status in the project    (default: project default)
 *   dueDate     — YYYY-MM-DD                                   (default: none)
 *
 * Auth (set ONE option as env vars):
 *   Option A (SSO/Google/GitHub):
 *     HULY_TOKEN=eyJ...          — token from DevTools → Application → IndexedDB database name
 *
 *   Option B (email + password):
 *     HULY_EMAIL=you@example.com
 *     HULY_PASSWORD=yourpassword
 *
 *   Target workspace (required — one account can have several):
 *     --workspace=your-workspace-slug   (or HULY_WORKSPACE=your-workspace-slug)
 */

'use strict'

const fs = require('fs')
const path = require('path')

// Target workspace (these scripts write data, so it must be explicit):
// --workspace=<slug|name|id>, or HULY_WORKSPACE as a fallback.
const workspace = process.argv.find(a => a.startsWith('--workspace='))?.slice('--workspace='.length) || process.env.HULY_WORKSPACE
if (!workspace) {
  console.error('❌  No workspace given. Pass --workspace=<slug> (see list_workspaces / npm run setup).')
  process.exit(1)
}

// ── Load compiled huly-mcp modules ──────────────────────────────────────────
const distDir = path.join(__dirname, '..', 'dist')
if (!fs.existsSync(path.join(distDir, 'connection.js'))) {
  console.error('❌  dist/ not found. Run `npm run build` first.')
  process.exit(1)
}
const { getConnection, closeConnection } = require(path.join(distDir, 'connection'))
const tracker = require('@hcengineering/tracker')
const task = require('@hcengineering/task')
const { SortingOrder, generateId } = require('@hcengineering/core')
const { makeRank } = require('@hcengineering/rank')

// ── Parse CLI args ────────────────────────────────────────────────────────────
const [,, csvFile, projectIdentifier] = process.argv
if (!csvFile || !projectIdentifier) {
  console.error('Usage: node scripts/import-csv.js <csv-file> <project-identifier> --workspace=<slug>')
  process.exit(1)
}
if (!fs.existsSync(csvFile)) {
  console.error(`❌  File not found: ${csvFile}`)
  process.exit(1)
}

// ── CSV parser (no dependencies) ─────────────────────────────────────────────
function parseCsv (text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  return lines.slice(1).map(line => {
    // Handle quoted fields
    const fields = []
    let current = ''
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes }
      else if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = '' }
      else { current += ch }
    }
    fields.push(current.trim())
    return Object.fromEntries(headers.map((h, i) => [h, fields[i] ?? '']))
  })
}

// ── Priority mapping ──────────────────────────────────────────────────────────
const PRIORITY_MAP = {
  'urgent': 1,    // IssuePriority.Urgent
  'high': 2,      // IssuePriority.High
  'medium': 3,    // IssuePriority.Medium
  'low': 4,       // IssuePriority.Low
  'no priority': 0,
  '': 0
}

function parsePriority (str) {
  const key = (str || '').toLowerCase().trim()
  return PRIORITY_MAP[key] ?? 0
}

// ── Main import ───────────────────────────────────────────────────────────────
async function main () {
  console.log(`\n📋  Huly CSV Importer`)
  console.log(`    File:    ${csvFile}`)
  console.log(`    Project: ${projectIdentifier}`)
  console.log(`    Workspace: ${workspace}\n`)

  // Parse CSV
  const rows = parseCsv(fs.readFileSync(csvFile, 'utf8'))
  const validRows = rows.filter(r => r.title && r.title.trim())
  console.log(`📂  Found ${rows.length} rows, ${validRows.length} with titles.\n`)

  if (validRows.length === 0) {
    console.error('❌  No valid rows found. Make sure CSV has a "title" column.')
    process.exit(1)
  }

  // Connect to Huly
  console.log('🔌  Connecting to Huly...')
  const client = await getConnection(workspace)
  console.log('✅  Connected.\n')

  // Find project
  const project = await client.findOne(tracker.default.class.Project, { identifier: projectIdentifier })
  if (project == null) {
    console.error(`❌  Project '${projectIdentifier}' not found.`)
    await closeConnection()
    process.exit(1)
  }

  // Load statuses — Huly stores them in project space OR global model space
  let statuses = await client.findAll(tracker.default.class.IssueStatus, { space: project._id })
  if (statuses.length === 0) {
    // Fall back to global model-level statuses (used by default project types)
    statuses = await client.findAll(tracker.default.class.IssueStatus, {})
  }
  const statusMap = new Map(statuses.map(s => [s.name.toLowerCase(), s]))
  const defaultStatus = project.defaultIssueStatus != null
    ? (statuses.find(s => s._id === project.defaultIssueStatus) ?? statuses[0])
    : statuses[0]

  // Find TaskType
  const kind = await client.findOne(task.default.class.TaskType,
    project.type != null ? { parent: project.type } : {})
  if (kind == null) {
    console.error('❌  Could not find a TaskType for this project.')
    await closeConnection()
    process.exit(1)
  }

  console.log(`📁  Project: ${project.name}`)
  console.log(`📊  Available statuses: ${statuses.map(s => s.name).join(', ')}`)
  console.log(`🎯  Default status: ${defaultStatus.name}\n`)

  // Import rows
  let created = 0
  let failed = 0

  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i]
    const num = i + 1

    process.stdout.write(`[${num}/${validRows.length}] Creating: "${row.title.slice(0, 60)}"... `)

    try {
      // Increment sequence
      const incResult = await client.updateDoc(
        tracker.default.class.Project,
        project.space,
        project._id,
        { $inc: { sequence: 1 } },
        true
      )
      const issueNumber = incResult?.object?.sequence ?? project.sequence + 1
      const identifier = `${project.identifier}-${issueNumber}`

      // Resolve status
      const statusName = (row.status || '').toLowerCase().trim()
      const status = statusName ? (statusMap.get(statusName) ?? defaultStatus) : defaultStatus

      // Compute rank
      const lastIssue = await client.findOne(
        tracker.default.class.Issue,
        { space: project._id },
        { sort: { rank: SortingOrder.Descending } }
      )
      const rank = makeRank(lastIssue?.rank, undefined)

      // Create issue
      const issueId = generateId()
      await client.addCollection(
        tracker.default.class.Issue,
        project._id,
        tracker.default.ids.NoParent,
        tracker.default.class.Issue,
        'subIssues',
        {
          title: row.title.trim(),
          description: null,
          status: status._id,
          priority: parsePriority(row.priority),
          number: issueNumber,
          identifier,
          rank,
          kind: kind._id,
          comments: 0,
          subIssues: 0,
          dueDate: row.duedate || row.dueDate
            ? new Date(row.duedate || row.dueDate).getTime()
            : null,
          assignee: null,
          component: null,
          milestone: null,
          parents: [],
          remainingTime: 0,
          estimation: 0,
          reportedTime: 0,
          reports: 0,
          childInfo: [],
          relations: []
        },
        issueId
      )

      console.log(`✅ ${identifier}`)
      created++
    } catch (err) {
      console.log(`❌ ERROR: ${err.message}`)
      failed++
    }
  }

  await closeConnection()

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`✅  Created: ${created}   ❌ Failed: ${failed}`)
  console.log(`${'─'.repeat(50)}\n`)
}

main().catch(err => {
  console.error('\n❌  Fatal error:', err.message)
  process.exit(1)
})
