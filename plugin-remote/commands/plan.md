---
description: Turn a goal or plan into a Huly epic with sub-issues
argument-hint: "<goal or plan>"
allowed-tools: Bash(git remote get-url:*)
---
Turn this into a Huly epic with sub-issues:

$ARGUMENTS

First run `git remote get-url origin` for the remote.

1. `find_project_for_repo` for the remote (ask me if none is linked).
2. `list_components` and `list_milestones`; pick fitting ones per child, say so if nothing fits.
3. Check for duplicates (`search_issues`).
4. `create_issue_tree` with `dryRun: true`, show me the plan, create only after I confirm.
