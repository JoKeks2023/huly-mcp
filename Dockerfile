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

FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim
WORKDIR /app

# mcp-proxy (Python) bridges stdio <-> HTTP/SSE, same pattern used by other
# self-hosted MCP wrappers. Versions pinned deliberately.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --no-cache-dir --break-system-packages "mcp==1.29.0" "mcp-proxy==0.12.0"

COPY --from=builder /app/dist ./dist
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

RUN useradd -m -u 1000 app
USER app

EXPOSE 8000

ENTRYPOINT ["mcp-proxy", \
            "--host=0.0.0.0", \
            "--port=8000", \
            "--stateless", \
            "--pass-environment", \
            "--", \
            "node", "dist/index.js"]
