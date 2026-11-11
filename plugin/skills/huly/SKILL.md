---
name: huly
description: How to work with Huly while coding, at the lowest token cost — follow the repo's Huly rules, find the project for the repo, pick up and hand back issues, keep status/component/milestone/PR links current, create issues without duplicates, turn plans and documents into epics, and pick the cheapest call for each question. Use whenever a task touches Huly (issues, epics, milestones, documents, inbox) or the user mentions an issue id like PROJ-12.
---

# Working with Huly

Keep Huly current as you work, in the same turn as the action. Every call costs a round trip and its output stays in context: **one call per question, one call per change.**

## 0. This repo's rules come first

- `CLAUDE.md`, `CLAUDE.local.md` or `AGENTS.md` may have a `## Huly` section (workspace, project, where new issues go, initiative, how token-saving). **It overrides everything below.** "Not used in this repository" = no Huly calls unless asked.
- No section and the user works with Huly here: offer `/huly:setup` once.
- Setting up or importing a project: [onboarding.md](onboarding.md). Using all of Huly (labels, templates, test management, documents, drive, custom fields, …) and which toolsets that needs: [features.md](features.md).

## 1. Know where you are — one call each

| Question | Call |
|---|---|
| Which project is this repo? | `find_project_for_repo` with `git remote get-url origin` (never guess a workspace) |
| My work today / since yesterday | `my_day` / `standup` |
| What needs my attention? | `triage_inbox` (small `limit`) |
| How is the project doing? | `project_report` |
| Everything about PROJ-12 | `get_issue_context` (just status/assignee: `get_issue`) |
| Find something | `search_issues`, `search` — not `list_issues status=all` |

Narrow lists with filters (`status`, `assignee`, `milestoneLabel`, `componentLabel`, `parentIdentifier`, `title`, `due: overdue`, `limit`). More questions with measured sizes: [costs.md](costs.md).

## 2. Pick up and hand back

- Branch names like `proj-12-short-title` carry the issue id; the session hook reports it.
- `start_work` = In Progress + assign + full context. Blocked by open issues → say so first. Parallel agents: `claimAs` / `claim_issue`; never `force` without the user.
- `finish_work` = comment + PR link + status. Summary must say what is **not** verified. The auto-created PR issue goes under the feature issue it implements.

| Moment | Status |
|---|---|
| Work starts | In Progress (`start_work`) |
| PR open | Review in progress (`finish_work`) |
| PR merged | Done / Merged — usually via GitHub sync |

## 3. Create — after a duplicate check, in one call

- `search_issues` first; comment on an existing issue instead of creating a near-duplicate.
- `create_issue` takes `componentLabel`, `milestoneLabel`, `assignee`, `statusName`, `priority`, `dueDate` — no follow-up `update_issue`. Every issue gets a component, and a milestone if it belongs to a release. Nothing fits → say so; don't create components/milestones silently.
- Plans → `create_issue_tree` (epic + sub-issues + `blockedBy`), dry run first, then once with `dryRun: false`.
- Spec or meeting notes in a Huly document → `issues_from_document` / `issues_from_meeting`; don't retype the tasks.
- Same change on many issues → `bulk_update_issues`.
- Bugs/TODOs you notice while working: follow the repo's initiative rule; without one, create the issue (after the duplicate check) and mention it in your reply.
- Milestones are releases, not phases; phases are epics. Never create Huly projects — the user does that.

## 4. Don't spend calls on checks the tools do

- Names (status, component, milestone, person) are validated before anything is written; a wrong name returns a clear error. Don't list "just to be sure".
- Unknown parameters are rejected with the valid list, nothing is done. Write tools report what changed — don't re-read to confirm.
- Independent reads go in one turn, in parallel. Issue ids and names work everywhere; no `_id` lookups.

## 5. Be careful with

- Bulk changes, `move_issue`, deletes: show what will change first.
- A change went wrong: `undo_changes` (dry run first) reverses your last changes through this server — don't repair by hand.
- GitHub-synced projects: every change appears on GitHub too; don't cross-post.
- `HULY_WRITE_PROJECTS` refusals: tell the user, don't work around them.
- Huly calls fail with login/connection errors: run `check_setup` and show the user what it says.
- A tool you need is missing: it is in a disabled toolset — `enable_toolsets` if available, otherwise tell the user which toolset to enable ([features.md](features.md)).
