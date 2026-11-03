// PostToolUse(Bash): after `gh pr create` / `gh pr merge`, remind Claude to keep the Huly issue in sync.
import { readStdin, git, issueFromBranch, emit } from './lib.mjs'

const input = await readStdin()
const command = String(input.tool_input?.command ?? '')
const create = /\bgh\s+pr\s+create\b/.test(command)
const merge = /\bgh\s+pr\s+merge\b/.test(command)
if (!create && !merge) process.exit(0)

const output = `${input.tool_response?.stdout ?? ''}\n${input.tool_response?.stderr ?? ''}`
const url = /https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/pull\/\d+/.exec(output)?.[0]
const issue = issueFromBranch(git(input.cwd ?? process.cwd(), ['rev-parse', '--abbrev-ref', 'HEAD']))
const target = issue != null ? `Huly issue ${issue}` : 'the Huly issue this PR implements (if any)'

if (create && url != null) {
  emit('PostToolUse', `Huly plugin: PR ${url} was created. Link it to ${target}: call finish_work with pullRequest "${url}" and an honest summary (it sets status to review). The GitHub sync may need a minute before the PR is known to Huly; retry once if it is not found.`)
} else if (merge) {
  emit('PostToolUse', `Huly plugin: a PR was merged. If the GitHub sync does not move ${target} to Done/Merged by itself, update its status.`)
}
