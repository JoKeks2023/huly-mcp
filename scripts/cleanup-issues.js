#!/usr/bin/env node
/**
 * Delete a range of issues from a Huly project.
 *
 * Usage:
 *   node scripts/cleanup-issues.js <project> <start> <end> [--confirm]
 *
 * Example (dry run — shows what would be deleted):
 *   node scripts/cleanup-issues.js VISIO 59 68 --workspace=myteam
 *
 * Example (actually delete):
 *   node scripts/cleanup-issues.js VISIO 59 68 --workspace=myteam --confirm
 *
 * Auth is read from .env (HULY_TOKEN, or HULY_EMAIL + HULY_PASSWORD). The target
 * workspace is required: --workspace=<slug> (or HULY_WORKSPACE).
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

// Load compiled modules
const distDir = path.join(__dirname, '..', 'dist')
if (!fs.existsSync(path.join(distDir, 'connection.js'))) {
  console.error('❌  dist/ not found. Run `npm run build` first.')
  process.exit(1)
}
const { getConnection, closeConnection } = require(path.join(distDir, 'connection'))
const tracker = require('@hcengineering/tracker')

// Parse args
const args = process.argv.slice(2)
const confirm = args.includes('--confirm')
const positional = args.filter(a => !a.startsWith('--'))

const [projectIdentifier, startStr, endStr] = positional
if (!projectIdentifier || !startStr || !endStr) {
  console.error('Usage: node scripts/cleanup-issues.js <project> <start> <end> --workspace=<slug> [--confirm]')
  console.error('Example: node scripts/cleanup-issues.js VISIO 59 68 --workspace=myteam --confirm')
  process.exit(1)
}

const start = parseInt(startStr, 10)
const end = parseInt(endStr, 10)
if (isNaN(start) || isNaN(end) || start > end) {
  console.error('❌  start and end must be valid numbers with start <= end')
  process.exit(1)
}

async function main () {
  const identifiers = []
  for (let n = start; n <= end; n++) {
    identifiers.push(`${projectIdentifier}-${n}`)
  }

  console.log(`\n🔍  Huly Issue Cleanup`)
  console.log(`    Project:  ${projectIdentifier}`)
  console.log(`    Range:    ${projectIdentifier}-${start} → ${projectIdentifier}-${end} (${identifiers.length} issues)`)
  console.log(`    Mode:     ${confirm ? '⚠️  DELETING for real' : '👁  DRY RUN (pass --confirm to delete)'}\n`)

  console.log('🔌  Connecting to Huly...')
  const client = await getConnection(workspace)
  console.log('✅  Connected.\n')

  // Find all issues in the range
  const issues = await client.findAll(
    tracker.default.class.Issue,
    { identifier: { $in: identifiers } }
  )

  if (issues.length === 0) {
    console.log('✅  No matching issues found — nothing to delete.')
    await closeConnection()
    return
  }

  console.log(`Found ${issues.length} issue(s) to delete:\n`)
  for (const issue of issues) {
    console.log(`  • ${issue.identifier}  "${issue.title}"`)
  }
  console.log()

  if (!confirm) {
    console.log('ℹ️  This was a DRY RUN. To actually delete, run:')
    console.log(`   node scripts/cleanup-issues.js ${projectIdentifier} ${start} ${end} --confirm\n`)
    await closeConnection()
    return
  }

  // Delete
  let deleted = 0
  let failed = 0

  for (const issue of issues) {
    process.stdout.write(`  Deleting ${issue.identifier}... `)
    try {
      await client.removeCollection(
        tracker.default.class.Issue,
        issue.space,
        issue._id,
        issue.attachedTo,
        issue.attachedToClass,
        issue.collection
      )
      console.log('✅')
      deleted++
    } catch (err) {
      console.log(`❌ ${err.message}`)
      failed++
    }
  }

  await closeConnection()

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`✅  Deleted: ${deleted}   ❌ Failed: ${failed}`)
  console.log(`${'─'.repeat(50)}\n`)
}

main().catch(err => {
  console.error('\n❌  Fatal error:', err.message)
  process.exit(1)
})
