# Installing huly-mcp-selfhost (for AI agents)

An MCP server for [Huly](https://huly.io) — self-hosted or Huly Cloud. It runs locally over stdio via `npx`; no build step, no other dependencies (one bundled file, Node.js ≥ 20).

## 1. Ask the user for their Huly login

- **Huly Cloud** (huly.app): e-mail and password of their Huly account.
- **Self-hosted Huly**: additionally the address of their instance, e.g. `https://huly.example.com`.
- Accounts that log in with Google/GitHub have no password: they run `npx huly-mcp-selfhost setup` in a terminal (it e-mails a one-time code) and give you the printed `HULY_TOKEN` instead.
- Optional: the workspace they mainly use (slug from the URL `…/workbench/<slug>`) — pinning it makes every tool smaller.

Never guess credentials or invent an instance URL.

## 2. Add the server to the MCP settings

```json
{
  "mcpServers": {
    "huly": {
      "command": "npx",
      "args": ["-y", "huly-mcp-selfhost"],
      "env": {
        "HULY_EMAIL": "<their e-mail>",
        "HULY_PASSWORD": "<their password>"
      }
    }
  }
}
```

- Token instead of password: replace both with `"HULY_TOKEN": "<token>"`.
- Self-hosted: add `"HULY_ACCOUNTS_URL": "https://huly.example.com/_accounts"` and `"HULY_FRONT_URL": "https://huly.example.com"`.
- One workspace: add `"HULY_WORKSPACE": "<slug>"`.

## 3. Check it works

Call the `check_setup` tool: it reports the version, whether the login worked, the workspaces found and whether the front URL (self-hosted) is reachable — without printing secrets. Then `list_workspaces` and, for example, `my_day`.

## Notes

- Changes always name their workspace; risky tools (deletes, bulk changes) ask first.
- A change was wrong: `undo_changes` (dry run first).
- More tools (test management, drive, templates, …) are in toolsets: set `"HULY_TOOLSETS": "all"` or a comma-separated list.
- Full documentation: https://github.com/JoKeks2023/huly-mcp
