import { test } from 'node:test'
import assert from 'node:assert/strict'
import { redactSecrets } from '../src/utils/redact'

// Built at runtime so secret scanners do not flag a fake token as a leak.
const b64 = (o: object): string => Buffer.from(JSON.stringify(o)).toString('base64url')
const token = [b64({ typ: 'JWT', alg: 'HS256' }), b64({ account: 'abc' }), 'c2lnbmF0dXJlLXZhbHVl'].join('.')

test('redactSecrets masks JWTs in strings and errors, leaves the rest', () => {
  assert.equal(redactSecrets(`client websocket error: 2 wss://h/_transactor/${token} ws-1 acc-1`), 'client websocket error: 2 wss://h/_transactor/*** ws-1 acc-1')
  const err = redactSecrets(new Error(`failed ${token}`)) as Error
  assert.equal(err.message, 'failed ***')
  assert.doesNotMatch(err.stack ?? '', /eyJ0eX/)
  assert.equal(redactSecrets(42), 42)
  assert.equal(redactSecrets('Client: onConnect 1'), 'Client: onConnect 1')
})
