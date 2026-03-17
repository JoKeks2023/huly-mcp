#!/usr/bin/env node
/**
 * Delete the ASCII art comments from the 4 epic issues (MCARE-4..7)
 * Run: node --env-file=.env scripts/clean-comments.mjs
 */
import accountClientPkg from '@hcengineering/account-client'
import corePkg from '@hcengineering/core'
import serverClientPkg from '@hcengineering/server-client'
import trackerPkg from '@hcengineering/tracker'
import chunterPkg from '@hcengineering/chunter'

const { getClient: getRawAccountClient } = accountClientPkg
const { TxOperations } = corePkg
const { createClient } = serverClientPkg
const tracker = trackerPkg.default ?? trackerPkg
const chunter = chunterPkg.default ?? chunterPkg

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

const { txClient, rawConnection } = await connect()
console.log('Connected.')

const EPICS = ['MCARE-4', 'MCARE-5', 'MCARE-6', 'MCARE-7']

for (const identifier of EPICS) {
  const issue = await txClient.findOne(tracker.class.Issue, { identifier })
  if (!issue) { console.log(`${identifier}: NOT FOUND`); continue }

  const comments = await txClient.findAll(chunter.class.ChatMessage, { attachedTo: issue._id })
  if (comments.length === 0) { console.log(`${identifier}: no comments`); continue }

  for (const comment of comments) {
    await txClient.removeCollection(
      chunter.class.ChatMessage,
      issue.space,
      comment._id,
      issue._id,
      tracker.class.Issue,
      'comments'
    )
    console.log(`${identifier}: deleted comment ${comment._id}`)
  }
}

await rawConnection.close()
console.log('Done.')
