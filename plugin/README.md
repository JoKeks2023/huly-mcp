# Huly for Claude Code

Work with [Huly](https://huly.io) — self-hosted or Huly Cloud — while you code: issues, epics, milestones, documents, chat, inbox and planner, through 200+ MCP tools. The plugin adds a skill that tells Claude how to use Huly with few tokens, `/huly:*` commands (setup, start, finish, plan, standup, triage, day, report) and two small hooks.

This is a community plugin. It is not made or endorsed by Huly Labs.

## Setup

```
/plugin marketplace add JoKeks2023/huly-mcp
/plugin install huly@huly-mcp
```

1. Fill in the plugin's settings (`/plugin` → huly → configure): e-mail + password, or a token for Google/GitHub accounts (`npx huly-mcp-selfhost setup` gets one). Self-hosted: also the Accounts URL and Front URL of your instance.
2. In a repository, run `/huly:setup`. Claude asks how Huly is used there (role, where new issues go, initiative, how token-saving), writes the answers as a short `## Huly` section to `CLAUDE.md` and/or `CLAUDE.local.md`, and can import the project (components, milestones, status set, TODO proposals, an architecture document).

## What it runs

- **MCP server:** `npx -y huly-mcp-selfhost@<version>` — the npm package [huly-mcp-selfhost](https://www.npmjs.com/package/huly-mcp-selfhost) at exactly the plugin's version, open source in this repository. `npx` downloads it from the npm registry on first start.
- **Hooks** (Node.js, local only, no network):
  - `SessionStart` — reads the git remote and branch name and checks whether `CLAUDE.md`/`CLAUDE.local.md`/`AGENTS.md` has a `## Huly` section, then tells Claude which repo and issue the session is about.
  - `PostToolUse` on Bash — after `gh pr create` / `gh pr merge`, reminds Claude to link the PR to its Huly issue and keep the status current.
- **Skill and commands:** Markdown instructions only.

## Where data goes

- The MCP server talks **only to the Huly instance you configure** (its accounts service, transactor and front service; Huly Cloud by default). It sends your login there and reads/writes the workspace data you ask Claude to work with.
- Nothing is sent anywhere else, with one exception you trigger yourself: the `check_setup` tool asks the npm registry for the latest version number (a plain GET, nothing about you is sent). The plugin has no telemetry and no server of its own.
- Credentials stay in Claude Code's plugin settings (password and token are stored as sensitive values). The server keeps a session token in memory only.
- Optional, off by default: `HULY_AUDIT_LOG` writes changes as JSON lines to a local file you choose; `HULY_FILE_ROOT` allows file uploads/downloads inside one local folder.

## Where it works

| Surface | What loads |
|---|---|
| Claude Code | everything |
| Cowork (session on your computer) | skill, commands, hooks; the MCP server only when its settings are filled in — Cowork does not ask for them |
| Claude chat (web, desktop, mobile) | skill and commands only — the Huly tools need Claude Code or Cowork |

Full documentation, all tools and the changelog: [README of the repository](https://github.com/JoKeks2023/huly-mcp#readme). License: EPL-2.0.
