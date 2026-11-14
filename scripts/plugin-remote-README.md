# huly-remote — Huly for Claude Code through your team server

The same skill, hooks and `/huly-remote:*` commands as the `huly` plugin, but **no server runs on your
computer**: Claude Code connects over HTTP to the huly-mcp team server your team runs, and you log in
with your own Huly account in the browser (OAuth). Your Huly password never reaches this computer.

## Install

```
/plugin marketplace add JoKeks2023/huly-mcp
/plugin install huly-remote@huly-mcp
```

Enter your team server's MCP endpoint when asked (e.g. `https://huly-mcp.example.com/mcp`), then run
`/mcp` → huly → Authenticate to log in with Huly.

Setting up the team server (Docker, `MCP_TRANSPORT=http`, `MCP_OAUTH_SECRET`, `MCP_PUBLIC_URL`): see
[Team server over HTTP](https://github.com/JoKeks2023/huly-mcp#team-server-over-http).

Install either `huly` (local server) or `huly-remote`, not both.

## What it runs

- **MCP server:** none locally — an HTTP connection to the URL you configured.
- **Hooks** (Node.js, local only, no network): on session start, reads the git remote and branch and
  points Claude to the repository's Huly rules; after `gh pr create` / `gh pr merge`, reminds Claude to
  link the PR to its issue.
- **Skill and commands:** Markdown instructions only.

## Where data goes

Only to your team server, which talks to your Huly. No telemetry.
