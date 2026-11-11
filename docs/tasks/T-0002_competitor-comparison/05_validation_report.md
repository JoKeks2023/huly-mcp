# T-0002 — Comparison with dearlordylord/huly-mcp (`@firfi/huly-mcp` 0.56.0)

Measured 2026-11-11 on the same self-hosted Huly (workspace jokeks2023), both servers over stdio from the same machine, read-only calls only. Our side: `huly-mcp-selfhost` 3.3.0 (local build), pinned workspace. Scripts: `.live/firfi-list.mts`, `.live/compare.mts` (not committed).

## Reach

| | theirs | ours |
|---|--:|--:|
| npm downloads (30 days) | 3,869 | 481 |
| GitHub stars / forks | 64 / 26 | — |
| MCP registry | listed since 0.1.7, ~25 versions | not listed (first attempt 3.3.0 refused: description > 100 chars) |
| Also | website, Glama listing, CLI package `@firfi/huly-cli` | website, Docker image, Claude Code plugin |

## Context cost of the tool list

| Mode | theirs | ours |
|---|--:|--:|
| All tools as native tools | 607 tools, **2,590,883 chars** (output schemas included; `list_issues` alone 11.4k) | 224 tools, 81,637 chars |
| What Claude Desktop / Cursor get by default | 6 proxy tools, 26,701 chars — every operation then needs `search_tools` (~5.8k chars output) → `get_tool_schema` → `invoke_tool` | 96 tools, 36,527 chars, each callable directly |
| Smallest sensible setup | `TOOLSETS=issues,projects,comments,milestones,documents,search`: 73 tools, 313,683 chars | `HULY_TOOLSETS=agent,inbox` + dynamic: ≈6k chars |

## Same question, output size (chars of text the model reads) and time

| Question | theirs | ours |
|---|--:|--:|
| Open issues of a project (23 open, limit 50) | 19,449 (+ the same again as structuredContent) — includes done issues, no "open" default | **1,965** |
| 10 issues, warm | 4,047 | **982** |
| One issue | 585 (needs `project` and `identifier`) | **318** |
| Projects | 1,041 | 550 |
| Components | 692 | 1,302 (ours includes descriptions/paths) |
| Milestones | 377 | 162 |
| Teamspaces | 988 | 673 |
| Search | 404 | 152 |
| **First call after start** | ~0.6 s (connects during start-up) | **4.6–12.3 s** (lazy login + workspace connect) |
| Later calls | 0.07–0.8 s | 0.1–1.4 s |

## Features

- **Theirs only:** ~2.7× more tools — boards, approvals, virtual office, views, preferences, sequences, much finer attachment/notification/space administration; a full CLI with the same operations; HTTP transport with endpoint bearer token and per-request Huly credentials (`x-huly-*` headers → several users per server); managed API tokens (workspace-bound, expiring, revocable) as preferred auth; diagnostics tool; richer `list_issues` filters (title/description search, `hasDueDate`, `isTopLevel`, creator, …).
- **Ours only:** agent layer — `my_day`, `standup`, `project_report`, `release_notes`, `get_issue_context`, `start_work`/`finish_work`, `create_issue_tree`, `issues_from_document`/`issues_from_meeting`, `changes_since`, claims, `find_project_for_repo`, `huly-mcp watch`, JUnit CLI; Claude Code plugin (skill, hooks, `/huly:*`, `/huly:setup`), guides as resources, `setup` prompt; one login → all workspaces; confirmation for risky tools (elicitation), write scope, audit log; compact Markdown outputs, open-issues default.

## Where we lose today

1. **Reach** — not in the MCP registry, no Glama, few downloads.
2. **First call is slow** (4.6–12 s).
3. **Breadth** — 224 vs 607 tools.
4. **Team/hosted use** — no per-user credentials over HTTP.
5. **Auth** — managed API tokens not documented/tested.
6. **No CLI.**

## Where we win today

1. **Tokens per answer** — 4–10× less output for the common reads.
2. **Directly usable tools** in Desktop/Cursor without a 3-step proxy dance.
3. **Agent workflows and the Claude Code plugin** — nothing comparable there.
