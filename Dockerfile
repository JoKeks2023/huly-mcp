# huly-mcp-selfhost — MCP server for Huly, exposed over HTTP/SSE via mcp-proxy.
#
# Build:  docker build -t huly-mcp-selfhost .
# Run:    docker run --rm -p 8000:8000 --env-file .env huly-mcp-selfhost
#
# The server itself speaks stdio (standard MCP transport); mcp-proxy wraps it
# so it's reachable as a network service, e.g. behind a reverse proxy for
# remote MCP clients. For local-only stdio use (Claude Desktop config etc.),
# you don't need this image at all — see the main README's "Installing this
# fork" section.

# The build output (plain JS) is platform-independent: build natively, even for arm64 images.
FROM --platform=$BUILDPLATFORM node:26-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:26-slim
WORKDIR /app

# mcp-proxy (Python) bridges stdio <-> HTTP/SSE, same pattern used by other
# self-hosted MCP wrappers. Versions pinned deliberately.
# apt-get upgrade picks up Debian security fixes released after the base image was built.
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends python3 python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --no-cache-dir --break-system-packages "mcp==1.30.0" "mcp-proxy==0.14.0"

COPY --from=builder /app/dist ./dist
COPY package.json package-lock.json ./
# npm (and corepack) are only needed to install; removing them drops their bundled dependencies
# from the image, along with their security alerts.
RUN npm ci --omit=dev && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
              /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

COPY docker-entrypoint.sh ./

USER node

EXPOSE 8000

# mcp-proxy with --allowed-host entries from MCP_ALLOWED_HOSTS (see docker-entrypoint.sh).
ENTRYPOINT ["/app/docker-entrypoint.sh"]
