# huly-mcp

MCP server for [Huly](https://huly.app) (self-hosted + cloud) — connects Claude Desktop and any [MCP](https://modelcontextprotocol.io)-compatible client to your Huly workspaces. 227 tools in toolsets (`HULY_TOOLSETS`, default 99) plus a Claude Code plugin: agent workflow (issue context, start/finish work, plan → issue tree, claims), workspace discovery (one account, several workspaces), issues, projects, milestones, components, documents, labels, chat (channels/DMs), file attachments, custom issue statuses, organizations, and more.

Fork of [huly-mcp-sdk](https://github.com/varaprasadreddy9676/huly-mcp) with fixes for **self-hosted** (`huly-selfhost`) deployments — upstream's document/description writes are hardcoded against Huly Cloud's infrastructure and silently fail on self-hosted instances.

**Full docs, tool list, and source:** https://github.com/JoKeks2023/huly-mcp

---

## Quick start

This image wraps the MCP server with [`mcp-proxy`](https://github.com/sparfenyuk/mcp-proxy) to expose it over HTTP/SSE at `:8000/sse` — for network-reachable deployments, not local per-client stdio launches (see the GitHub README's "Installing this fork" section for that use case instead).

```bash
docker run --rm -p 8000:8000 \
  -e HULY_EMAIL=you@example.com \
  -e HULY_PASSWORD=yourpassword \
  jokeks2023/huly-mcp
```

The server discovers every workspace the account can access; tools take a `workspace` argument (see `list_workspaces`). Self-hosted Huly also needs `HULY_ACCOUNTS_URL` (login + discovery) and `HULY_FRONT_URL` (document content + file uploads):

```bash
docker run --rm -p 8000:8000 \
  -e HULY_EMAIL=you@example.com \
  -e HULY_PASSWORD=yourpassword \
  -e HULY_ACCOUNTS_URL=https://your-huly-instance.com/_accounts \
  -e HULY_FRONT_URL=https://your-huly-instance.com \
  jokeks2023/huly-mcp
```

Behind a reverse proxy or on a public hostname, add `-e MCP_ALLOWED_HOSTS=huly-mcp.example.com` (comma-separated; every Host name clients use). Without it only `localhost` is accepted, and other requests fail with `421 Invalid Host header`.

Or with Compose — see [`docker-compose.yml`](https://github.com/JoKeks2023/huly-mcp/blob/main/docker-compose.yml) and [`.env.example`](https://github.com/JoKeks2023/huly-mcp/blob/main/.env.example) in the repo.

## Tags

- `latest` — the most recent release
- `3`, `3.1`, `3.1.0` — a release line (`3` follows every 3.x release, `3.1` every 3.1.x patch) or one exact release
- `edge` — the most recent build from `main` (untested between releases)
- `<git-sha>` — pinned to a specific commit

Images are built for `linux/amd64` and `linux/arm64` (Apple Silicon, Raspberry Pi, ARM servers), with an SBOM and build provenance.

## Also on

- npm: [`huly-mcp-selfhost`](https://www.npmjs.com/package/huly-mcp-selfhost)
- GHCR: `ghcr.io/jokeks2023/huly-mcp` (same image, mirrored)

## License

[EPL-2.0](https://github.com/JoKeks2023/huly-mcp/blob/main/LICENSE)
