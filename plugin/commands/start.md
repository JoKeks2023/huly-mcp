---
description: Start working on a Huly issue (from the argument or the branch name)
argument-hint: "[PROJ-12]"
allowed-tools: Bash(git remote get-url:*), Bash(git branch --show-current)
---
Start work on a Huly issue.

- Issue: `$ARGUMENTS` (if empty, take it from the branch name)
- Branch and remote: run `git branch --show-current` and `git remote get-url origin`

Steps:
1. If no issue id is given and the branch has none, call `find_project_for_repo` with the remote and ask which issue to take (offer my open ones).
2. Call `start_work` for the issue. Read the returned context fully.
3. If it is blocked by open issues, stop and tell me.
4. If the current branch does not match, suggest switching to the suggested branch name.
5. Give me a short implementation plan.
