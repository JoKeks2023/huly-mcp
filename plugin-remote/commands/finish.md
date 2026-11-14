---
description: Hand a Huly issue back — summary, PR link, status to review
argument-hint: "[PROJ-12] [PR #/URL]"
allowed-tools: Bash(git branch --show-current), Bash(git log:*), Bash(gh pr view:*)
---
Finish the Huly issue I worked on.

- Arguments: `$ARGUMENTS`
- Branch and its PR: run `git branch --show-current` and `gh pr view --json url` (no PR → none)

Steps:
1. Determine the issue (argument, else branch name) and the PR (argument, else the PR above).
2. Write an honest summary: what changed, how it was verified, what is not verified.
3. Call `finish_work` with that summary and the PR.
