// timesheet: one week by day and project, totals, gaps on past workdays.
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import tracker from '@hcengineering/tracker'
import contact from '@hcengineering/contact'
import { setConnectionManager } from '../src/connection'
import { timesheet, weekStart } from '../src/tools/log-time'
import { createFakeEnv, PERSONAL } from './helpers'

const W = 'jokeks2023'
const MON = weekStart(new Date(2026, 10, 4)) // week of Wed 2026-11-04
const H = 3_600_000
beforeEach(() => {
  setConnectionManager(createFakeEnv({
    workspaces: [PERSONAL],
    data: {
      [W]: [
        { _id: 'me', _class: contact.class.Person, name: 'Keks,Jo' },
        { _id: 'social-id', _class: contact.class.SocialIdentity, attachedTo: 'me' },
        { _id: 'p-a', _class: tracker.class.Project, identifier: 'WEB' },
        { _id: 'p-b', _class: tracker.class.Project, identifier: 'API' },
        { _id: 'i-1', _class: tracker.class.Issue, space: 'p-a', identifier: 'WEB-1' },
        { _id: 'i-2', _class: tracker.class.Issue, space: 'p-b', identifier: 'API-1' },
        { _id: 't1', _class: tracker.class.TimeSpendReport, attachedTo: 'i-1', employee: 'me', date: MON + 9 * H, value: 5 },
        { _id: 't2', _class: tracker.class.TimeSpendReport, attachedTo: 'i-2', employee: 'me', date: MON + 10 * H, value: 3 },
        { _id: 't3', _class: tracker.class.TimeSpendReport, attachedTo: 'i-2', employee: 'me', date: MON + 24 * H + 9 * H, value: 2.5 },
        { _id: 't4', _class: tracker.class.TimeSpendReport, attachedTo: 'i-1', employee: 'me', date: MON - 24 * H, value: 9 }
      ]
    }
  }).manager)
})
afterEach(() => { setConnectionManager(null) })

test('timesheet: Monday-based week, rows per project, totals; earlier weeks ignored; gaps on workdays', async () => {
  assert.equal(new Date(MON).getDay(), 1)
  const out = (await timesheet({ workspace: W, week: '2026-11-04' } as any)).content[0].text
  assert.match(out, /## Timesheet 2026-11-02 – 2026-11-08 — Jo Keks\n\n\| Project \| Mon 11-02 \|/)
  assert.match(out, /\| API \| 3 \| 2\.5 \| · \| · \| · \| · \| · \| \*\*5\.5\*\* \|/)
  assert.match(out, /\| WEB \| 5 \| · \|/)
  assert.match(out, /\| \*\*Total\*\* \| \*\*8\*\* \| \*\*2\.5\*\* \|/)
  assert.match(out, /\*\*Gaps:\*\* Tue 11-03 \(2\.5h of 8h\), Wed 11-04 \(0h of 8h\), Thu 11-05 \(0h of 8h\), Fri 11-06 \(0h of 8h\)/)
  assert.doesNotMatch(out, /\b9\b/, 'the Sunday before belongs to the previous week')
})
