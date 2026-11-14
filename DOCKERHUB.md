# huly-mcp — Huly for AI agents

MCP server for [Huly](https://huly.io), self-hosted or Huly Cloud: Claude and other AI agents work in your Huly workspaces — issues, epics, milestones, documents, chat, inbox, planner, test management and more. 232 tools in toolsets (`HULY_TOOLSETS`, default 99), built for agent workflows and for few tokens.

**This image is the team server:** one container, everyone logs in with their own Huly account.

- **Log in with Huly (OAuth)** — people add `https://<your host>/mcp` in Claude Code, Claude's custom connectors or another MCP client and log in in the browser (password, or a one-time e-mail code for Google/GitHub accounts). Stateless: nothing to store, survives restarts.
- **Fast** — persistent sessions; a call takes ~0.2 s, the first one included.
- **Agent workflows** — `my_day`, `standup`, `project_report`, `start_work` → `finish_work`, plans → epics, meeting notes → issues, `undo_changes`.
- **Few tokens** — measured 2.9× less text per answer and 13× smaller tool definitions than another popular Huly MCP server.
- **No telemetry.** It talks to your Huly server and nothing else.

**Full documentation, all tools, the Claude Code plugin and the command line:** https://github.com/JoKeks2023/huly-mcp

---

## Team server with "Log in with Huly"

```bash
docker run -d --name huly-mcp -p 8000:8000 \
  -e MCP_TRANSPORT=http \
  -e MCP_OAUTH_SECRET="$(openssl rand -hex 32)" \
  -e MCP_PUBLIC_URL=https://huly-mcp.example.com \
  -e MCP_ALLOWED_HOSTS=huly-mcp.example.com \
  -e HULY_ACCOUNTS_URL=https://huly.example.com/_accounts \
  -e HULY_FRONT_URL=https://huly.example.com \
  jokeks2023/huly-mcp
```

Put it behind your HTTPS reverse proxy at `MCP_PUBLIC_URL`. Keep `MCP_OAUTH_SECRET` fixed (e.g. in an env file) — changing it logs everyone out. Huly Cloud: leave out `HULY_ACCOUNTS_URL` and `HULY_FRONT_URL`.

Clients connect to `https://huly-mcp.example.com/mcp`:

```bash
claude mcp add --transport http huly https://huly-mcp.example.com/mcp
```

**Without OAuth**, clients can send their own login as headers (`X-Huly-Token`, or `X-Huly-Email` + `X-Huly-Password`; `X-Huly-Workspace` pins one workspace). One shared account for everyone: set `HULY_EMAIL` + `HULY_PASSWORD` (or `HULY_TOKEN`) **and** `MCP_AUTH_TOKEN` — clients then send `Authorization: Bearer <MCP_AUTH_TOKEN>`.

## Classic mode (mcp-proxy, HTTP/SSE)

Without `MCP_TRANSPORT=http` the image runs the server behind [`mcp-proxy`](https://github.com/sparfenyuk/mcp-proxy) at `:8000/sse` and `:8000/mcp` with the account from the environment — as in earlier versions:

```bash
docker run --rm -p 8000:8000 \
  -e HULY_EMAIL=you@example.com \
  -e HULY_PASSWORD=yourpassword \
  -e HULY_ACCOUNTS_URL=https://huly.example.com/_accounts \
  -e HULY_FRONT_URL=https://huly.example.com \
  jokeks2023/huly-mcp
```

Behind a reverse proxy or on a public hostname, add `-e MCP_ALLOWED_HOSTS=huly-mcp.example.com` (comma-separated; every host name clients use). Without it only `localhost` is accepted (`421 Invalid Host header`).

Compose: [`docker-compose.yml`](https://github.com/JoKeks2023/huly-mcp/blob/main/docker-compose.yml) and [`.env.example`](https://github.com/JoKeks2023/huly-mcp/blob/main/.env.example) in the repo.

## Settings

| Variable | Purpose |
|---|---|
| `MCP_TRANSPORT=http` | The server's own HTTP endpoint (`/mcp`, health check `/healthz`) instead of mcp-proxy |
| `MCP_OAUTH_SECRET`, `MCP_PUBLIC_URL` | Log in with Huly (OAuth); secret ≥ 32 characters, public URL with https |
| `MCP_AUTH_TOKEN` | Bearer token for every request; needed to use the server's own Huly login |
| `MCP_ALLOWED_HOSTS` | Host names clients use (DNS-rebinding protection) |
| `HULY_ACCOUNTS_URL`, `HULY_FRONT_URL` | Self-hosted Huly: login/discovery and document/file content |
| `HULY_TRANSACTOR_URL` | Server next to Huly: connect internally, e.g. `ws://huly/_transactor` |
| `HULY_EMAIL` + `HULY_PASSWORD` or `HULY_TOKEN` | The server's own account (classic mode, or shared behind `MCP_AUTH_TOKEN`) |
| `HULY_WORKSPACE` | Pin one workspace (fewer tokens) |
| `HULY_TOOLSETS` | Toolsets to load, or `all` |
| `HULY_WRITE_PROJECTS`, `HULY_AUDIT_LOG`, `HULY_CONFIRM` | Guard rails: writable projects, audit log, confirmation for risky tools |

All settings: [Configuration](https://github.com/JoKeks2023/huly-mcp#configuration).

## Tags

- `latest` — the most recent release
- `3`, `3.5`, `3.5.0` — a release line (`3` follows every 3.x release, `3.5` every 3.5.x patch) or one exact release
- `edge` — the most recent build from `main` (untested between releases)
- `<git-sha>` — pinned to a specific commit

Images for `linux/amd64` and `linux/arm64` (Apple Silicon, Raspberry Pi, ARM servers), with SBOM and build provenance. The server inside is one bundled file without runtime dependencies.

## Also on

- npm: [`huly-mcp-selfhost`](https://www.npmjs.com/package/huly-mcp-selfhost) — `npx huly-mcp-selfhost` for Claude Desktop, Cursor, VS Code, …
- Claude Code plugin: `/plugin marketplace add JoKeks2023/huly-mcp`
- GHCR: `ghcr.io/jokeks2023/huly-mcp` (same image, mirrored)

## License

[EPL-2.0](https://github.com/JoKeks2023/huly-mcp/blob/main/LICENSE). Not affiliated with Huly Labs.
