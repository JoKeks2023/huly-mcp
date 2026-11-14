// test_coverage, link_test_case, release_check over issues linked to test cases (Related).
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import tracker from '@hcengineering/tracker'
import task from '@hcengineering/task'
import { setConnectionManager } from '../src/connection'
import { testCoverage, linkTestCase, releaseCheck } from '../src/tools/coverage'
import { TM } from '../src/tools/testing'
import { createFakeEnv, PERSONAL } from './helpers'

const W = 'jokeks2023'
const DAY = 86_400_000
let env: ReturnType<typeof createFakeEnv>
const issue = (n: number, status: string, more: Record<string, unknown> = {}): any => ({ _id: `i-${n}`, _class: tracker.class.Issue, space: 'p-1', identifier: `PROJ-${n}`, title: `Issue ${n}`, status, milestone: 'ms-1', rank: String(n), ...more })
beforeEach(() => {
  env = createFakeEnv({
    workspaces: [PERSONAL],
    data: {
      [W]: [
        { _id: 'p-1', _class: tracker.class.Project, identifier: 'PROJ', name: 'Proj', space: 'p-1' },
        { _id: 'ms-1', _class: tracker.class.Milestone, space: 'p-1', label: 'v1.0', targetDate: Date.now() - DAY, status: 1 },
        { _id: 'st-open', _class: tracker.class.IssueStatus, name: 'Todo', category: task.statusCategory.ToDo },
        { _id: 'st-done', _class: tracker.class.IssueStatus, name: 'Done', category: task.statusCategory.Won },
        issue(1, 'st-done', { relations: [{ _id: 'tc-1', _class: TM.Case }] }),
        issue(2, 'st-done'),
        issue(3, 'st-open', { relations: [{ _id: 'tc-2', _class: TM.Case }], blockedBy: [{ _id: 'i-9', _class: tracker.class.Issue }] }),
        { _id: 'i-9', _class: tracker.class.Issue, space: 'p-1', identifier: 'PROJ-9', title: 'Blocker', status: 'st-open' },
        { _id: 'tc-1', _class: TM.Case, name: 'Login works' },
        { _id: 'tc-2', _class: TM.Case, name: 'Export works' },
        { _id: 'r-1', _class: TM.Result, testCase: 'tc-1', status: 3, modifiedOn: Date.now() - DAY },
        { _id: 'r-0', _class: TM.Result, testCase: 'tc-1', status: 2, modifiedOn: Date.now() - 3 * DAY }
      ]
    }
  })
  setConnectionManager(env.manager)
})
afterEach(() => { setConnectionManager(null) })
const text = (r: any): string => r.content[0].text

test('test_coverage: covered vs not, latest result per case, never run', async () => {
  const out = text(await testCoverage({ workspace: W, projectIdentifier: 'PROJ', milestoneLabel: 'v1' } as any))
  assert.match(out, /2\/3 issues have test cases · 1 failing · 1 never run/)
  assert.match(out, /Without test cases \(1\)\n- \*\*PROJ-2\*\*/)
  assert.match(out, /PROJ-1\*\* Issue 1 — ❌ Login works \(Failed/)
  assert.match(out, /PROJ-3\*\* Issue 3 — ⚪ Export works \(never run\)/)
})

test('release_check: not ready with reasons; warnings for untested and overdue', async () => {
  const out = text(await releaseCheck({ workspace: W, projectIdentifier: 'PROJ', milestoneLabel: 'v1.0' } as any))
  assert.match(out, /❌ Not ready:\*\* 1 open issue\(s\), 1 blocked, 1 failing test\(s\) · also 1 done issue\(s\) without test cases, 1 linked test case\(s\) never run, target date .* has passed/)
  assert.match(out, /PROJ-3\*\* waits for PROJ-9/)
})

test('link_test_case: by name, no duplicates', async () => {
  assert.match(text(await linkTestCase({ workspace: W, identifier: 'PROJ-2', testCase: 'login works' } as any)), /PROJ-2\*\* ↔ test case "Login works"/)
  assert.match(text(await linkTestCase({ workspace: W, identifier: 'PROJ-1', testCase: 'tc-1' } as any)), /already linked/)
})
