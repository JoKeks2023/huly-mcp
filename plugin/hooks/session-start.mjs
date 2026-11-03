// SessionStart: tell Claude which GitHub repo and (from the branch name) which Huly issue this session is about.
import { readStdin, git, githubSlug, issueFromBranch, emit } from './lib.mjs'

const input = await readStdin()
const cwd = input.cwd ?? process.cwd()
const slug = githubSlug(git(cwd, ['remote', 'get-url', 'origin']))
if (slug == null) process.exit(0)
const branch = git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
const issue = issueFromBranch(branch)

const lines = [`Huly plugin: this repo is GitHub ${slug}${branch != null ? `, branch ${branch}` : ''}.`]
lines.push(issue != null
  ? `The branch name points to Huly issue ${issue}. Before working on it, load it with get_issue_context (or start_work).`
  : 'To find its Huly workspace and project, call find_project_for_repo when Huly is relevant.')
emit('SessionStart', lines.join(' '))
