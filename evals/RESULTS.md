# Eval results

Model: Claude Haiku via `claude -p`, 12 tasks ([tasks.ts](tasks.ts)), 2 runs each, checked in Huly.
Conditions: **baseline** = MCP server only (npx, Claude Desktop, other clients); **skill** = the plugin's
skill available in the project; **forced** = the agent is told to load the skill first — what the plugin's
SessionStart hook now says in repositories that use Huly.

## What we learned (2026-11-13)

| Run | Change since the run before | baseline | skill | forced |
|---|---|--:|--:|--:|
| 1 | — (8 easy tasks, 1 run) | 8/8 | 8/8 | – |
| 2 | 4 harder tasks, 2 runs each | 19/24 | 18/24 | – |
| 3 | server instructions: "user starts work → start_work; side finding → sub-issue"; skill rewritten | 21/24 | 23/24 | 24/24 |
| 4 | `list_issues blocked`, hook loads the skill | 20/24 | – | 22/24 |

- **The skill is never loaded on its own** — 0 of 32 runs with Haiku, also not with a description tied to
  the tool names; Sonnet didn't load it either (and passed through the server instructions alone). So:
  the plugin's SessionStart hook now tells Claude to load it, and the rules that matter most are also in
  the server instructions, which every client sees.
- **With the skill loaded, Haiku solves the workflow tasks** that it fails without: picking up an issue when
  the user only says "I'm fixing X now" (t10: 0/2 → 2/2), and filing with component and milestone (t9).
  It costs more calls (3.7 vs 2.3 per task): the skill makes it check components/milestones and search before
  creating. Tokens per task 103k → 165k, almost all cached input (skill text).
- **Tool fixes found by the evals:**
  - `finish_work` failed when the PR was not synced to Huly yet → now hands back anyway, PR link in the comment.
  - `create_issue` needed a second call to make a sub-issue → `parentIdentifier`.
  - `list_issues status: "Blocked"` failed ("Blocked" is a relation, not a status) → `blocked: true` filter and
    an error that points to it; the overview task went from 6–7 calls to 2.
  - Hard-to-undo tools ask for confirmation; in a headless run nobody answers and the change is silently
    not made. The evals set `HULY_CONFIRM=off` (writes are limited to the eval project).
- **Still open:** t9 — "it's a backend problem" with a component named "zz-eval Backend" is found only
  sometimes; t4 (forced) once created a duplicate despite searching. Runs vary: 2 runs per task are a smoke
  signal, not a benchmark.
