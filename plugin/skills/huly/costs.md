# Huly calls by cost

Every Huly call costs a round trip and its output stays in context. Aim for **one call per question** and **one call per change**. Sizes below are measured on a real project (≈50 issues); 1k chars ≈ 300 tokens.

## Reading: question → call

| Question | Call | Size | Instead of |
|---|---|--:|---|
| What's on today for me? | `my_day` | ~1.2k | calendar + to-dos + my issues + inbox |
| Standup | `standup` | small | `changes_since` + `list_issues` per project |
| How is project X doing? | `project_report` | ~2.7k | `list_issues status=all` (~4k for 50) + milestones + PRs |
| Everything about PROJ-12 before working on it | `get_issue_context` | ~1.3k | `get_issue` + `list_sub_issues` + `list_comments` + relations (4+ calls) |
| Status/assignee of PROJ-12 | `get_issue` | ~0.4k | `get_issue_context` |
| What changed? | `changes_since` with `projectIdentifiers` and a short `since` | — | whole workspace for 7d: ~8k |
| Inbox housekeeping for one object (pin, hide, unread, follow) | `manage_notifications` | small | several updates |
| What needs my attention? | `triage_inbox` with a small `limit` | ~4k at 10 | `list_notifications` + `get_issue` per item |
| What's in release v1.2? | `release_notes` | ~2k | `list_issues milestoneLabel=…` + reading every issue |
| Find issues about X | `search_issues` | ~2k | `list_issues status=all` and scanning |
| Find anything (docs, chat, issues) | `search` | ~2.5k | several list calls |

**Narrow lists with filters, not by reading them:** `list_issues` takes `status` (`open` default, `all`, or a name), `assignee` (`null` = unassigned), `milestoneLabel`, `componentLabel`, `labelName`, `parentIdentifier` (`null` = top level), `title` (contains text), `due` (`overdue`, `set`, `none`) and `limit`.

**Avoid** `query_documents` / generic tools when a specific tool exists: one issue there is ~1.8k raw fields vs ~0.4k from `get_issue`. Use them only for classes without a tool.

## Writing: one call per change

- **New issue with everything:** `create_issue` takes `statusName`, `priority`, `assignee`, `componentLabel`, `milestoneLabel`, `dueDate`, `parentIdentifier` (sub-issue) — no follow-up `update_issue` or `set_parent`.
- **Many issues:** `create_issue_tree` (epic + children + blockers), dry run first.
- **From a document:** `issues_from_document` (spec → epic + sub-issues) or `issues_from_meeting` (action items with `@assignee` and dates). Do not read the document and retype the tasks.
- **Same change on many issues:** `bulk_update_issues` instead of N × `update_issue`.
- **Picking up / handing back work:** `start_work` (status + assign + context) and `finish_work` (comment + PR link + status) instead of 3–4 separate calls.

## Don't spend calls on checks the tools already do

- Names (status, component, milestone, person) are validated **before anything is written**; a wrong name returns an error that says what is wrong. Try with the name first — don't list statuses or components "just to be sure".
- Unknown or misspelled parameters are rejected with the list of valid ones and nothing is done; common aliases (`status`, `project`, `issueId`, `component`, `milestone`) are mapped automatically.
- Write tools return what changed (`changed: status, assignee`). Don't re-read the issue to confirm.
- Dry runs (`create_issue_tree`, `issues_from_*`, generic writes) show the full plan — show it to the user, then run once with `dryRun: false`.

## Round trips

- Independent reads (e.g. `get_issue_context` for two issues) go in **one turn in parallel**.
- Pass `workspace` explicitly when there are several; a pinned server (`HULY_WORKSPACE`) needs none.
- Issue ids (`PROJ-12`) and names work everywhere — don't look up internal `_id`s first.

## Setup that saves tokens before the first call

- `HULY_WORKSPACE` pins one workspace: the `workspace` argument disappears from every tool (~10% smaller tool list).
- `HULY_TOOLSETS` with only what you use (default set ≈ 36k chars; `all` ≈ 82k). With `HULY_DYNAMIC_TOOLSETS=1` more toolsets load on demand via `enable_toolsets`.
