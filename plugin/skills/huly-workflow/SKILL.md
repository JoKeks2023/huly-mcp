---
name: huly-workflow
description: How to work with Huly issues while coding — find the Huly project for the current repo, pick up and hand back issues, keep status, component, milestone and PR links current, turn plans into epics, and avoid duplicates. Use whenever a task involves Huly issues, epics, milestones, PRs that belong to a Huly issue, or when the user mentions an issue id like PROJ-12.
---

# Working with Huly

Huly is the source of truth for what is being worked on. Keep it current as you work, in the same turn as the action — not on request.

## 0. Follow this repo's rules

- The repo's `CLAUDE.md` (or `AGENTS.md`) may have a `## Huly` section: workspace, project, where new issues go, how much initiative, how token-saving to be. **It overrides the defaults below.**
- No such section and the user works with Huly here: offer `/huly:setup` once — it asks the user and writes the section. "Not used in this repository" means: no Huly calls unless asked.
- Setting up or importing a project (components, milestones, status set, TODO scan, architecture doc): follow [onboarding.md](onboarding.md).

## 1. Know where you are

- **Project for this repo:** call `find_project_for_repo` with the git remote (`git remote get-url origin`). It returns the workspace and project key. If nothing is linked, ask the user which workspace/project to use — never guess a workspace.
- **Issue for this branch:** branch names like `proj-12-short-title` carry the issue id (`PROJ-12`). The session-start hook of this plugin reports it when it finds one.
- **Catching up — one call each:** `my_day` (my work today), `standup` (since the last working day), `triage_inbox` (unread with what changed), `project_report` (a project's state), `changes_since` (`24h`, `7d`, what others changed). Prefer these over assembling the picture from many list calls.
- **Cost:** for which call answers which question most cheaply, see the `huly-efficient` skill.

## 2. Pick up work

- `start_work` sets **In Progress**, assigns the issue to the current user and returns the full context (description, sub-issues, blockers, PRs, comments, suggested branch name). Read it before coding.
- If it is **blocked by** open issues, say so before starting.
- When other agents may work in parallel, pass `claimAs` (or call `claim_issue`). Respect claims of other agents; never `force` without the user's go.
- Use the suggested branch name so later steps can find the issue.

## 3. Create issues — only after a duplicate check

- Before creating anything, search: `search_issues` (content) and `list_issues` in the project. Reuse or comment on an existing issue instead of creating a near-duplicate.
- Every new issue gets a **component** and, if it belongs to a release, a **milestone** — pass `componentLabel` / `milestoneLabel` (and `assignee`) directly to `create_issue`, or use the fields in `create_issue_tree`. If nothing fits, say so in your reply instead of silently creating new components or milestones.
- Bugs or TODOs you notice while working: create an issue right away (after the duplicate check) and mention it in your reply.
- Larger plans become an **epic with sub-issues**: `create_issue_tree` with `dryRun: true` first, show the plan, create after the user confirms. Express order with `blockedBy`.
- A spec or meeting notes in a Huly document: `issues_from_document` (spec → epic + sub-issues) or `issues_from_meeting` (action items with assignee and due date). Both plan first (dry run) — no need to read the document and repeat every task.
- Milestones are releases or real delivery targets, not phases. Phases and work packages are epics.
- Never create Huly projects yourself — the user does that (it needs OAuth for the GitHub link).

## 4. Keep status current

| Moment | Status |
|--------|--------|
| You start working | In Progress (`start_work`) |
| PR is open | Review in progress (`finish_work`) |
| PR merged | Done / Merged — usually set by the GitHub sync |

Status goes in `statusName`. Use the project's actual status names (`list_issue_statuses`); an unknown name is an error — pick the closest existing one and say which.

## 5. Hand back

- `finish_work` with an honest summary: what changed, how it was verified, and what is **not** verified. Pass the PR (`#12`, URL or Huly id) so it is linked under the issue — Huly creates a tracking issue per synced PR, and it belongs under the feature issue it implements. Pure docs/cross-cutting PRs without a single feature issue stay unlinked.
- GitHub-linked projects sync both ways: an issue created in Huly also appears on GitHub and vice versa. Do not cross-post manually.

## 6. Be careful with

- Bulk changes (`bulk_update_issues`, `move_issue`, deletes): show what will change first.
- Projects synced with GitHub: changes become visible there too.
- `HULY_WRITE_PROJECTS` may limit where you can write; if a change is refused, tell the user instead of working around it.
