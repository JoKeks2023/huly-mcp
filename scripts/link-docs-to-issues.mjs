#!/usr/bin/env node
/**
 * Link EP1-EP4 documents to their corresponding epic issues via relations
 * Run: node --env-file=.env scripts/link-docs-to-issues.mjs
 */
import accountClientPkg from '@hcengineering/account-client'
import corePkg from '@hcengineering/core'
import serverClientPkg from '@hcengineering/server-client'
import trackerPkg from '@hcengineering/tracker'
import documentPkg from '@hcengineering/document'

const { getClient: getRawAccountClient } = accountClientPkg
const { TxOperations } = corePkg
const { createClient } = serverClientPkg
const tracker = trackerPkg.default ?? trackerPkg
const document = documentPkg.default ?? documentPkg

const ACCOUNTS_URL = process.env.HULY_ACCOUNTS_URL ?? 'https://account.huly.app'

async function connect () {
  const workspaceUrl = process.env.HULY_WORKSPACE
  const hulyToken = process.env.HULY_TOKEN
  if (!workspaceUrl || !hulyToken) throw new Error('HULY_WORKSPACE and HULY_TOKEN required')

  const authedClient = getRawAccountClient(ACCOUNTS_URL, hulyToken)
  const info = await authedClient.getLoginInfoByToken()
  if (!info) throw new Error('Token invalid')

  let socialId, endpoint, wsToken
  if ('endpoint' in info && info.endpoint) {
    socialId = info.socialId; endpoint = info.endpoint; wsToken = info.token
  } else {
    socialId = info.socialId
    const wsInfo = await authedClient.selectWorkspace(workspaceUrl, 'external')
    endpoint = wsInfo.endpoint; wsToken = wsInfo.token
  }

  const rawConnection = await createClient(endpoint, wsToken)
  const txClient = new TxOperations(rawConnection, socialId)
  return { txClient, rawConnection }
}

const LINKS = [
  { issue: 'MCARE-4', docId: '69b9a635cf60316d6ce21a50' }, // EP1
  { issue: 'MCARE-5', docId: '69b9a63bcf60316d6ce21a52' }, // EP2
  { issue: 'MCARE-6', docId: '69b9a640cf60316d6ce21a54' }, // EP3
  { issue: 'MCARE-7', docId: '69b9a645cf60316d6ce21a56' }, // EP4
]

const { txClient, rawConnection } = await connect()
console.log('Connected.')

for (const { issue: identifier, docId } of LINKS) {
  const issue = await txClient.findOne(tracker.class.Issue, { identifier })
  if (!issue) { console.log(`${identifier}: NOT FOUND`); continue }

  const doc = await txClient.findOne(document.class.Document, { _id: docId })
  if (!doc) { console.log(`${identifier}: document ${docId} NOT FOUND`); continue }

  // Build updated relations array (keep existing + add the document link)
  const existing = issue.relations ?? []
  const alreadyLinked = existing.some(r => r._id === docId)
  if (alreadyLinked) { console.log(`${identifier}: already linked`); continue }

  await txClient.updateDoc(tracker.class.Issue, issue.space, issue._id, {
    relations: [...existing, { _id: doc._id, _class: doc._class }]
  })

  console.log(`${identifier} ↔ "${doc.title}" ✅`)
}

await rawConnection.close()
console.log('Done.')
