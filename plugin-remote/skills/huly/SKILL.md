---
name: huly
description: Keeps Huly (issues, epics, milestones, components, documents, inbox) in step with the code — finds the issue, picks it up, tracks side findings, hands it back with the PR, plans epics, and answers status questions in one call each. Use for any Huly request or Huly issue id (PROJ-12), and whenever coding work starts, finishes or opens a PR in a repository that uses Huly.
---

# Working with Huly

The Huly tools come from this plugin's MCP server. Keep Huly current **in the same turn** as the work, with as few calls as possible: one call per question, one call per change.

## Rules that come first

1. The repo's `CLAUDE.md`, `CLAUDE.local.md` or `AGENTS.md` may have a `## Huly` section (workspace, project, where new issues go, how much initiative). **It overrides this skill.** "Not used in this repository" → no Huly calls unless asked.
2. No such section but the user works with Huly here → offer `/huly-remote:setup` once.
3. Unsure which workspace or project → `find_project_for_repo` with the git remote, or ask. Never guess a workspace for a change.

## The coding workflow

Recognize the moment — act on it even when the user only tells you, without asking:

| The user says … | Do |
|---|---|
| "I'm working on / fixing / starting X now" | `start_work` on X's issue |
| "I noticed Y while doing X" | `create_issue` for Y with `parentIdentifier` = X's issue |
| "X is done, PR is …" | `finish_work` with the PR |
| "plan X", "break X down" | `create_issue_tree` (dry run, then real) |

Copy the checklist that fits and tick it off as you go.

**Start work on an issue**
```
- [ ] Find it: the id from the user or the branch (proj-12-…); otherwise search_issues with words from the request
- [ ] start_work PROJ-12 → In Progress, assigned to me, full context (description, sub-issues, blockers, PRs)
- [ ] Open blockers in the context? Tell the user before coding
- [ ] Branch name carries the id: proj-12-short-title
- [ ] The user asked to note something ("starting with X") → add_comment
```

**While working**
```
- [ ] Side finding (bug, missing test, TODO) that belongs to this work → search_issues first, then
      create_issue with parentIdentifier: PROJ-12 (one call, sub-issue)
- [ ] Unrelated finding → follow the repo's "where new issues go" rule; without one, create_issue and mention it
- [ ] Scope grows beyond ~3 steps → propose an epic (create_issue_tree, see "Plan")
```

**Pull request and hand-back**
```
- [ ] PR title or body contains the issue id (PROJ-12) so GitHub sync links them
- [ ] finish_work PROJ-12 with summary + pullRequest (URL or #number) → comment, PR linked, review status
      ("Review in progress" where the project's issue workflow has it — otherwise the status stays and the answer says so)
      The summary says what is NOT verified. A PR that is not synced yet is fine: the link goes into the comment.
- [ ] After merge: Done / Merged usually arrives through GitHub sync — check, don't double-set
```

**Plan a feature**
```
- [ ] search_issues for existing work (reuse, don't duplicate)
- [ ] create_issue_tree: epic + sub-issues, order via blockedBy ("B only after A" → B blockedBy A)
- [ ] Dry run first, show the plan; then the same call once with dryRun: false
- [ ] Spec or meeting notes already in a Huly document → issues_from_document / issues_from_meeting
```

## One call per question

| Question | Call |
|---|---|
| Everything about PROJ-12 (what does it ask for?) | `get_issue_context` |
| Just status or assignee of PROJ-12 | `get_issue` |
| How is the project doing — overdue, blocked, done | `project_report` |
| My day / since yesterday / what needs me | `my_day` / `standup` / `triage_inbox` |
| Which issues match X | `search_issues`, or `list_issues` with `title`, `status`, `assignee`, `milestoneLabel`, `componentLabel`, `due: overdue` |
| What's in a release | `release_notes` |

Measured sizes and more pairs: [costs.md](costs.md).

## One call per change

- **New issue with everything at once:** `create_issue` takes `priority`, `dueDate`, `assignee`, `statusName`, `componentLabel`, `milestoneLabel`, `parentIdentifier`. No follow-up `update_issue`, no re-read to confirm — the answer says what was set.
- **Same change on several issues:** `bulk_update_issues` with all ids, not N × `update_issue`.
- **Before creating:** `search_issues` once. An issue for the same thing exists → update or comment on it instead.
- Every new issue gets a component, and a milestone if it belongs to a release. Nothing fits → say so; don't create components or milestones unasked.

## When a call fails

- **"… not found. Available: …"** → pick from the list in the error and retry once; don't list statuses or components beforehand "to be sure".
- **"Unknown parameter(s) … Valid: …"** → nothing was done; retry with a valid name.
- **Login or connection errors** → `check_setup`, then tell the user what it says.
- **Refused by `HULY_WRITE_PROJECTS`** or declined by the user → stop and tell the user; don't work around it.
- **A change was wrong** → `undo_changes` (dry run first), not manual repair.
- **A tool is missing** → it is in a disabled toolset: `enable_toolsets` if offered, otherwise name the toolset ([features.md](features.md)).

## Careful with

- Deletes, `move_issue` and bulk changes: show what will change first.
- GitHub-synced projects: every change also appears on GitHub; don't cross-post.
- Milestones are releases, phases are epics. Huly projects are created by the user, never by you.

## More

- Setting up or importing a project (statuses, components, milestones, TODO scan): [onboarding.md](onboarding.md)
- All of Huly — labels, templates, test management, documents, drive, custom fields — and which toolsets they need: [features.md](features.md)
