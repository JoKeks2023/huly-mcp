#!/usr/bin/env node
/**
 * One-time setup: authenticate via OTP and save your token to .env
 *
 * Usage:
 *   node scripts/setup.js
 *
 * What it does:
 *   1. Sends a one-time code to your email
 *   2. You paste the code
 *   3. Lists the workspaces your account can access (discovery test)
 *   4. Saves HULY_TOKEN to .env
 *
 * No workspace is configured: the MCP server discovers all workspaces of the
 * account at runtime and every tool takes a `workspace` argument.
 */

'use strict'

const fs = require('fs')
const path = require('path')
const readline = require('readline')

const { getClient } = require('@hcengineering/account-client')

const envFile = path.join(__dirname, '..', '.env')
const accountsUrl = process.env.HULY_ACCOUNTS_URL ?? 'https://account.huly.app'

function ask (question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()) }))
}

function writeEnv (token, accountsUrl) {
  const lines = [
    `HULY_TOKEN=${token}`,
    accountsUrl !== 'https://account.huly.app' ? `HULY_ACCOUNTS_URL=${accountsUrl}` : null
  ].filter(Boolean)

  // Merge with existing .env (don't overwrite unrelated vars)
  let existing = ''
  if (fs.existsSync(envFile)) {
    existing = fs.readFileSync(envFile, 'utf8')
  }

  const keep = existing.split('\n').filter(line => {
    const key = line.split('=')[0]
    return !['HULY_TOKEN', 'HULY_WORKSPACE', 'HULY_EMAIL', 'HULY_PASSWORD', 'HULY_ACCOUNTS_URL'].includes(key)
  })

  fs.writeFileSync(envFile, [...keep.filter(Boolean), ...lines].join('\n') + '\n')
}

async function main () {
  console.log('\n🔧  Huly MCP Setup\n')

  const email = await ask('  Email address (the one you use for huly.app): ')
  if (!email.includes('@')) { console.error('Invalid email.'); process.exit(1) }

  console.log(`\n  Sending OTP to ${email}...`)
  const unauthClient = getClient(accountsUrl)
  await unauthClient.loginOtp(email)
  console.log('  ✅ Code sent!\n')

  const code = await ask('  Enter the 6-digit code from your email: ')

  console.log('\n  Validating...')
  const loginInfo = await unauthClient.validateOtp(email, code.trim())

  if (!loginInfo?.token) {
    console.error('  ❌ Invalid or expired code. Run setup again.')
    process.exit(1)
  }

  // Discovery test: which workspaces can this account use?
  const authedClient = getClient(accountsUrl, loginInfo.token)
  const workspaces = await authedClient.getUserWorkspaces().catch(e => {
    console.error(`  ❌ Workspace discovery failed: ${e.message}`)
    process.exit(1)
  })

  if (workspaces.length === 0) {
    console.error('  ❌ This account has no accessible workspaces.')
    process.exit(1)
  }

  const hadWorkspace = fs.existsSync(envFile) && /^HULY_WORKSPACE=/m.test(fs.readFileSync(envFile, 'utf8'))
  writeEnv(loginInfo.token, accountsUrl)

  console.log(`\n  ✅ Setup complete! Token saved to .env`)
  console.log(`\n  Workspaces available to this account (${workspaces.length}):`)
  for (const ws of workspaces) {
    console.log(`     - ${ws.name ?? ws.url}  (slug: ${ws.url}, id: ${ws.uuid})${ws.isDisabled ? '  [disabled]' : ''}`)
  }
  if (hadWorkspace) {
    console.log('\n  ℹ️  Removed HULY_WORKSPACE from .env — the server now uses all workspaces above.')
    console.log('     Re-add it only if you want to restrict this server to a single workspace.')
  }
  console.log('\n  In your MCP client, pass the slug as `workspace`, e.g. list_projects(workspace="' + workspaces[0].url + '").\n')
}

main().catch(err => {
  console.error('\n❌ Setup failed:', err.message)
  process.exit(1)
})
