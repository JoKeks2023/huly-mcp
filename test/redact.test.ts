import { test } from 'node:test'
import assert from 'node:assert/strict'
import { redactSecrets } from '../src/utils/redact'

const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhY2NvdW50IjoiYWJjIn0.c2lnbmF0dXJlLXZhbHVl'

test('redactSecrets masks JWTs in strings and errors, leaves the rest', () => {
  assert.equal(redactSecrets(`client websocket error: 2 wss://h/_transactor/${token} ws-1 acc-1`), 'client websocket error: 2 wss://h/_transactor/*** ws-1 acc-1')
  const err = redactSecrets(new Error(`failed ${token}`)) as Error
  assert.equal(err.message, 'failed ***')
  assert.doesNotMatch(err.stack ?? '', /eyJ0eX/)
  assert.equal(redactSecrets(42), 42)
  assert.equal(redactSecrets('Client: onConnect 1'), 'Client: onConnect 1')
})
