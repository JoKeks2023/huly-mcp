// Components/milestones by name: exact first, then a unique partial match; else the candidates.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import tracker from '@hcengineering/tracker'
import { findByLabel } from '../src/utils/labels'

const client = {
  findAll: async (_cls: string, q: any) => [
    { _id: 'c1', space: 'p', label: 'API Backend' },
    { _id: 'c2', space: 'p', label: 'Web Frontend' },
    { _id: 'c3', space: 'p', label: 'Mobile Frontend' },
    { _id: 'c4', space: 'p', label: 'Docs' }
  ].filter((d) => d.space === q.space)
}

test('findByLabel: exact (any case), unique partial, ambiguous and unknown with candidates', async () => {
  assert.equal((await findByLabel(client, 'component', 'p', 'docs'))._id, 'c4')
  assert.equal((await findByLabel(client, 'component', 'p', 'backend'))._id, 'c1')
  await assert.rejects(findByLabel(client, 'component', 'p', 'frontend', 'PROJ'), /'frontend' matches several in project PROJ: Web Frontend, Mobile Frontend/)
  await assert.rejects(findByLabel(client, 'milestone', 'p', 'zzz'), /Milestone 'zzz' not found in this project\. Available: API Backend/)
  void tracker
})
