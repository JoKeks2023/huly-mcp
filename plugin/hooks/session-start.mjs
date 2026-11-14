// SessionStart: tell Claude which GitHub repo and (from the branch name) which Huly issue this session is about.
import { readStdin, git, githubSlug, issueFromBranch, hulyRules, emit } from './lib.mjs'

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
const rules = hulyRules(git(cwd, ['rev-parse', '--show-toplevel']) ?? cwd)
if (rules === 'set') lines.push('Follow the "## Huly" section of CLAUDE.md/CLAUDE.local.md/AGENTS.md for how Huly is used here. Load the huly skill before your first Huly call.')
else lines.push('This repo has no Huly rules yet (no "## Huly" section in CLAUDE.md). If the user works with Huly here, offer /huly:setup once.')
emit('SessionStart', lines.join(' '))
