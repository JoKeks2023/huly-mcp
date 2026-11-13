# Agent evals

A small model (Haiku by default) solves typical Huly tasks through this MCP server — once without
and once with the plugin's skill. Success is checked **in Huly**, not in the answer text; tool calls,
tool errors, tokens and cost are recorded per run.

```bash
npm run build
npx tsx evals/run.ts                        # all tasks, baseline + skill, Haiku, 1 run each
npx tsx evals/run.ts --reps 3 --model sonnet
npx tsx evals/run.ts --only t5,t10 --conditions skill
```

- **Login:** `.env` (`HULY_EMAIL`/`HULY_PASSWORD` or `HULY_TOKEN`, `HULY_ACCOUNTS_URL`, `HULY_FRONT_URL`).
- **Where:** `EVAL_WORKSPACE` (default `jokeks2023`) and a throwaway project `EVAL_PROJECT` (default `TSK`).
  The agent can only write there (`HULY_WRITE_PROJECTS`). Everything created during a run is deleted
  before and after each task (titles `zz-eval …`, and every issue created since the run started).
- **Agent:** `claude -p` with only this MCP server (`--strict-mcp-config`), no shell or file tools, and the
  skill copied into the project's `.claude/skills/` for the `skill` condition. Claude Code still loads the
  user's global `CLAUDE.md`; the eval's system prompt tells the agent to ignore personal Huly rules, and both
  conditions run the same way.
- **Results:** `evals/results/<date>-<model>.json` (not committed); the summary table is printed at the end.

Tasks are in [tasks.ts](tasks.ts): each has a setup, a prompt in plain words (no tool names) and a check.
