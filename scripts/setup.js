#!/usr/bin/env node
/**
 * One-time setup for SSO accounts (Google/GitHub): log in with a one-time code and get a token.
 *
 * Usage:
 *   npx huly-mcp-selfhost setup              (anywhere — prints the token to paste into your client)
 *   npm run setup                            (in a checkout of this repo — also saves it to .env)
 *   ... setup --url https://huly.example.com (self-hosted; or set HULY_ACCOUNTS_URL)
 *
 * What it does:
 *   1. Asks for your Huly address (empty = Huly Cloud) unless HULY_ACCOUNTS_URL / --url is given
 *   2. Sends a one-time code to your email; you paste the code
 *   3. Lists the workspaces your account can access (discovery test)
 *   4. In a repo checkout: saves HULY_TOKEN to .env. Otherwise: prints what to put where.
 */

'use strict'

const fs = require('fs')
const path = require('path')
const readline = require('readline')

const { getClient } = require('@hcengineering/account-client')

const CLOUD_ACCOUNTS = 'https://account.huly.app'
const root = path.join(__dirname, '..')
const envFile = path.join(root, '.env')
// Started via npx the package sits in the npm cache: a .env there would be lost and never read.
const isCheckout = fs.existsSync(path.join(root, '.git'))

// One interface for the whole run: a new one per question would drop lines already buffered (piped input).
let rl
const lines = []
const waiting = []
function ask (question) {
  if (rl == null) {
    rl = readline.createInterface({ input: process.stdin })
    rl.on('line', line => { const next = waiting.shift(); if (next != null) next(line.trim()); else lines.push(line.trim()) })
    rl.on('close', () => { while (waiting.length > 0) waiting.shift()('') })
  }
  process.stdout.write(question)
  if (lines.length > 0) return Promise.resolve(lines.shift())
  return new Promise(resolve => waiting.push(resolve))
}

/** "https://huly.example.com", ".../_accounts" or empty (cloud) → { accounts, front } */
function resolveUrls (input) {
  const value = (input ?? '').trim().replace(/\/+$/, '')
  if (value === '' || /(^|\/\/)(app\.)?huly\.app$/.test(value) || value === CLOUD_ACCOUNTS) return { accounts: CLOUD_ACCOUNTS, front: undefined }
  if (!/^https?:\/\//.test(value)) throw new Error(`Not a URL: ${value} (expected e.g. https://huly.example.com)`)
  if (value.endsWith('/_accounts')) return { accounts: value, front: value.slice(0, -'/_accounts'.length) }
  return { accounts: `${value}/_accounts`, front: value }
}

function urlArg (argv) {
  const i = argv.indexOf('--url')
  if (i >= 0) return argv[i + 1] ?? ''
  const eq = argv.find(a => a.startsWith('--url='))
  return eq != null ? eq.slice('--url='.length) : undefined
}

function writeEnv (token, urls) {
  const lines = [
    `HULY_TOKEN=${token}`,
    urls.accounts !== CLOUD_ACCOUNTS ? `HULY_ACCOUNTS_URL=${urls.accounts}` : null
  ].filter(Boolean)

  // Merge with existing .env (don't overwrite unrelated vars)
  let existing = ''
  try {
    existing = fs.readFileSync(envFile, 'utf8')
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }

  const keep = existing.split('\n').filter(line => {
    const key = line.split('=')[0]
    return !['HULY_TOKEN', 'HULY_WORKSPACE', 'HULY_EMAIL', 'HULY_PASSWORD', 'HULY_ACCOUNTS_URL'].includes(key)
  })

  fs.writeFileSync(envFile, [...keep.filter(Boolean), ...lines].join('\n') + '\n')
  return /^HULY_WORKSPACE=/m.test(existing)
}

function printConfig (token, urls) {
  console.log('\n  Put these values into your MCP client:')
  console.log('     Claude Code plugin: /plugin → huly → configure (fields "Huly token", "Accounts URL", "Front URL")')
  console.log('     Other clients: the "env" block of the huly server\n')
  console.log(`     HULY_TOKEN=${token}`)
  if (urls.accounts !== CLOUD_ACCOUNTS) {
    console.log(`     HULY_ACCOUNTS_URL=${urls.accounts}`)
    console.log(`     HULY_FRONT_URL=${urls.front}`)
  }
  console.log('\n  Keep the token secret — it logs in as you.')
}

async function main () {
  console.log('\n🔧  Huly MCP Setup\n')

  const fromEnv = (process.env.HULY_ACCOUNTS_URL ?? '').trim()
  const given = urlArg(process.argv.slice(2)) ?? (fromEnv !== '' ? fromEnv : undefined)
  const urls = resolveUrls(given ?? await ask('  Huly address (empty = Huly Cloud, e.g. https://huly.example.com): '))
  if (urls.accounts !== CLOUD_ACCOUNTS) console.log(`  Accounts service: ${urls.accounts}`)

  const email = await ask('  Email address of your Huly account: ')
  if (!email.includes('@')) { console.error('Invalid email.'); process.exit(1) }

  console.log(`\n  Sending a one-time code to ${email}...`)
  const unauthClient = getClient(urls.accounts)
  await unauthClient.loginOtp(email).catch(e => {
    const cause = e.cause?.code ?? e.message
    throw new Error(`Could not reach the Huly accounts service at ${urls.accounts} (${cause}). Check the address — self-hosted: your Huly URL, e.g. https://huly.example.com`)
  })
  console.log('  ✅ Code sent!\n')

  const code = await ask('  Enter the 6-digit code from your email: ')

  console.log('\n  Validating...')
  const loginInfo = await unauthClient.validateOtp(email, code.trim())

  if (!loginInfo?.token) {
    console.error('  ❌ Invalid or expired code. Run setup again.')
    process.exit(1)
  }

  // Discovery test: which workspaces can this account use?
  const authedClient = getClient(urls.accounts, loginInfo.token)
  const workspaces = await authedClient.getUserWorkspaces().catch(e => {
    console.error(`  ❌ Workspace discovery failed: ${e.message}`)
    process.exit(1)
  })

  if (workspaces.length === 0) {
    console.error('  ❌ This account has no accessible workspaces.')
    process.exit(1)
  }

  console.log(`\n  ✅ Logged in. Workspaces available to this account (${workspaces.length}):`)
  for (const ws of workspaces) {
    console.log(`     - ${ws.name ?? ws.url}  (slug: ${ws.url})${ws.isDisabled ? '  [disabled]' : ''}`)
  }

  if (isCheckout) {
    const hadWorkspace = writeEnv(loginInfo.token, urls)
    console.log('\n  Token saved to .env')
    if (hadWorkspace) {
      console.log('  ℹ️  Removed HULY_WORKSPACE from .env — the server now uses all workspaces above.')
      console.log('     Re-add it only if you want to restrict this server to a single workspace.')
    }
  } else {
    printConfig(loginInfo.token, urls)
  }
  console.log('\n  Optional: pin one workspace with HULY_WORKSPACE (a slug above) — fewer tokens per session.\n')
}

module.exports = { resolveUrls, urlArg }

if (require.main === module || process.env.HULY_SETUP_RUN === '1') {
  main().then(() => rl?.close()).catch(err => {
    console.error('\n❌ Setup failed:', err.message)
    process.exit(1)
  })
}
