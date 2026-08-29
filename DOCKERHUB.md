# huly-mcp

MCP server for [Huly](https://huly.app) (self-hosted + cloud) — connects Claude Desktop and any [MCP](https://modelcontextprotocol.io)-compatible client to your Huly workspace. 50 tools: issues, projects, milestones, components, documents, labels, chat (channels/DMs), file attachments, custom issue statuses, organizations, and more.

Fork of [huly-mcp-sdk](https://github.com/varaprasadreddy9676/huly-mcp) with fixes for **self-hosted** (`huly-selfhost`) deployments — upstream's document/description writes are hardcoded against Huly Cloud's infrastructure and silently fail on self-hosted instances.

**Full docs, tool list, and source:** https://github.com/JoKeks2023/huly-mcp

---

## Quick start

This image wraps the MCP server with [`mcp-proxy`](https://github.com/sparfenyuk/mcp-proxy) to expose it over HTTP/SSE at `:8000/sse` — for network-reachable deployments, not local per-client stdio launches (see the GitHub README's "Installing this fork" section for that use case instead).

```bash
docker run --rm -p 8000:8000 \
  -e HULY_WORKSPACE=myteam \
  -e HULY_EMAIL=you@example.com \
  -e HULY_PASSWORD=yourpassword \
  jokeks2023/huly-mcp
```

Self-hosted Huly also needs `HULY_ACCOUNTS_URL` and `HULY_FRONT_URL`:

```bash
docker run --rm -p 8000:8000 \
  -e HULY_WORKSPACE=myteam \
  -e HULY_EMAIL=you@example.com \
  -e HULY_PASSWORD=yourpassword \
  -e HULY_ACCOUNTS_URL=https://your-huly-instance.com/_accounts \
  -e HULY_FRONT_URL=https://your-huly-instance.com \
  jokeks2023/huly-mcp
```

Or with Compose — see [`docker-compose.yml`](https://github.com/JoKeks2023/huly-mcp/blob/main/docker-compose.yml) and [`.env.example`](https://github.com/JoKeks2023/huly-mcp/blob/main/.env.example) in the repo.

## Tags

- `latest` — most recent build from `main`
- `<git-sha>` — pinned to a specific commit

## Also on

- npm: [`huly-mcp-selfhost`](https://www.npmjs.com/package/huly-mcp-selfhost)
- GHCR: `ghcr.io/jokeks2023/huly-mcp` (same image, mirrored)

## License

[EPL-2.0](https://github.com/JoKeks2023/huly-mcp/blob/main/LICENSE)
