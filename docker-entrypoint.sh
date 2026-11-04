#!/bin/sh
# Starts the MCP server behind mcp-proxy (HTTP/SSE on :8000).
#
# mcp-proxy only accepts requests whose Host header it trusts. Loopback (localhost) is always trusted;
# for a reverse proxy or a public hostname, list every Host authority clients use in MCP_ALLOWED_HOSTS,
# comma-separated, e.g. MCP_ALLOWED_HOSTS=huly-mcp.example.com,huly-mcp.example.com:443
set -eu

set -- --host=0.0.0.0 --port="${MCP_PORT:-8000}" --stateless --pass-environment
for host in $(printf '%s' "${MCP_ALLOWED_HOSTS:-}" | tr ',' ' '); do
  set -- "$@" --allowed-host "$host"
done
if [ -z "${MCP_ALLOWED_HOSTS:-}" ]; then
  echo "huly-mcp: MCP_ALLOWED_HOSTS is not set, so only requests to localhost are accepted." >&2
  echo "huly-mcp: behind a reverse proxy or on a public hostname, set MCP_ALLOWED_HOSTS=your.host.name (requests otherwise fail with 421 Invalid Host header)." >&2
fi

exec mcp-proxy "$@" -- node dist/index.js
