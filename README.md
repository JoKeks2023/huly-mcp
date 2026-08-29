# huly-mcp-sdk (self-hosted fork)

> The most complete MCP server for [Huly](https://huly.app) — the open-source project management platform.

Connects **Claude Desktop** (and any [MCP](https://modelcontextprotocol.io)-compatible client) directly to your Huly workspace. Manage projects, issues, milestones, components, documents, labels, chat, attachments, organizations, and more — all via natural language.

## About this fork

This is a fork of [varaprasadreddy9676/huly-mcp](https://github.com/varaprasadreddy9676/huly-mcp), built out for a **self-hosted** (`huly-selfhost`) deployment and extended well past the upstream tool set. **Not published to npm** — see [Installing this fork](#installing-this-fork) below.

**Fixed vs. upstream:**
- **Self-hosted document/description writes.** Upstream's `update_document` (and, by extension, any issue description) is hardcoded against Huly Cloud's "datalake" microservice at `dl-eu.huly.app`, which `huly-selfhost` doesn't run. This fork auto-detects self-hosted deployments via `HULY_FRONT_URL` and uploads through `front`'s own `/files` contract instead — falls back to the original Cloud behavior when `HULY_FRONT_URL` is unset. See [`src/utils/storage.ts`](src/utils/storage.ts).
- **`description` on `create_issue`/`update_issue`.** Missing entirely upstream — issue descriptions are `MarkupBlobRef`s, same storage mechanism as document content, so this needed the same fix.

**New tool categories** (upstream had 36 tools across Projects/Issues/Comments/Time/Labels/Relations/Members/Milestones/Components/Documents/Search; this fork adds 14 more):
- **Chat** — `list_channels`, `create_channel`, `start_direct_message`, `send_message`, `list_messages`
- **Attachments** — `attach_file`, `list_attachments`, `delete_attachment` (generic files on issues, any content type)
- **Issue Statuses** — `list_issue_statuses`, `create_issue_status` (custom workflow states)
- **Organizations** — `list_organizations`, `get_organization`, `create_organization`, `update_organization`

**Investigated and deliberately not built:** Calendar (not a native event system in Huly — it's a Google Calendar sync bridge requiring infra this fork doesn't assume you're running) and Drive/HR/Recruiting/CRM-Leads/Board (blocked by an [upstream npm packaging bug](https://github.com/hcengineering/platform/issues/10881) — `@hcengineering/*` packages published `0.7.411`+ ship without their `types/` directory, and these modules have no earlier version to pin around it).

---

## Tools (50 total)

| Category | Tool | Description |
|----------|------|-------------|
| **Projects** | `list_projects` | List all projects in the workspace |
| | `get_project` | Get project details + available statuses |
| | `create_project` | Create a new tracker project with a unique identifier |
| **Issues** | `list_issues` | List issues with optional status / priority filters |
| | `get_issue` | Get full details of an issue (e.g. `PROJ-42`) |
| | `create_issue` | Create a new issue (with optional Markdown description) |
| | `update_issue` | Update title, description, status, priority, assignee, due date, component, milestone |
| | `delete_issue` | Permanently delete an issue by identifier |
| **Comments** | `add_comment` | Add a comment to an issue |
| | `list_comments` | List all comments on an issue (includes IDs for `delete_comment`) |
| | `delete_comment` | Delete a specific comment by ID |
| **Time Tracking** | `log_time` | Log hours spent on an issue |
| **Labels** | `list_labels` | List all labels with color + usage count |
| | `create_label` | Create a new label with an optional hex color |
| | `add_label` | Add a label to an issue (auto-creates if it doesn't exist) |
| | `remove_label` | Remove a label from an issue |
| **Relations** | `add_relation` | Mark two issues as related (bidirectional) |
| | `add_blocked_by` | Mark an issue as blocked by another issue |
| | `set_parent` | Set or clear the parent epic of an issue |
| **Members** | `list_members` | List workspace members |
| **Milestones** | `list_milestones` | List milestones for a project |
| | `create_milestone` | Create a milestone with a target date and status |
| **Components** | `list_components` | List components (sub-areas) in a project |
| | `create_component` | Create a new component with optional lead |
| **Documents** | `list_teamspaces` | List document teamspaces |
| | `create_teamspace` | Create a new teamspace (top-level document folder) |
| | `list_documents` | List documents in a teamspace |
| | `delete_document` | Permanently delete a document by ID |
| | `get_document` | Get document metadata + content |
| | `create_document` | Create a new document in a teamspace |
| | `update_document` | Write Markdown content to a document — Mermaid diagrams render natively |
| | `link_document` | Link a document to an issue — appears in the Relations panel |
| **Search** | `search_issues` | Full-text search across all issues |
| **Chat** | `list_channels` | List all channels in the workspace |
| | `create_channel` | Create a new channel |
| | `start_direct_message` | Start (or find) a 1:1 direct message with a workspace member |
| | `send_message` | Send a message to a channel or direct message |
| | `list_messages` | List messages in a channel or direct message |
| **Attachments** | `attach_file` | Attach a file to an issue (base64-encoded content) |
| | `list_attachments` | List files attached to an issue |
| | `delete_attachment` | Delete a file attachment from an issue |
| **Issue Statuses** | `list_issue_statuses` | List all issue statuses (workflow states), grouped by phase |
| | `create_issue_status` | Create a new issue status — available in every project immediately |
| **Organizations** | `list_organizations` | List all organizations (companies) in the workspace |
| | `get_organization` | Get details of an organization, including description |
| | `create_organization` | Create a new organization (company contact) |
| | `update_organization` | Set the description of an organization from Markdown |

---

## Requirements

- Node.js >= 20
- A Huly account — [huly.app](https://huly.app) (cloud) or self-hosted

---

## Installing this fork

This fork is published separately as **[`huly-mcp-selfhost`](https://www.npmjs.com/package/huly-mcp-selfhost)** — `npx huly-mcp-sdk` still resolves to the *original* upstream package, not this one. Three ways to run it:

### npm / npx

In any client config below, use `huly-mcp-selfhost` instead of `huly-mcp-sdk`:

```json
"command": "npx",
"args": ["huly-mcp-selfhost"]
```

### Clone and build

```bash
git clone https://github.com/JoKeks2023/huly-mcp.git
cd huly-mcp
npm install
npm run build
```

```json
"command": "node",
"args": ["/absolute/path/to/huly-mcp/dist/index.js"]
```

### Docker (network-reachable server, not local stdio)

For deployments where the MCP server needs to be reachable over the network (behind a reverse proxy, remote MCP clients, etc.) rather than launched locally per-client, a prebuilt image is published to GHCR on every push to `main`:

```bash
docker pull ghcr.io/jokeks2023/huly-mcp-selfhost:latest
```

Or with Compose — copy `.env.example` to `.env`, fill in your credentials, then:

```bash
docker compose up -d
```

The container wraps the server with [`mcp-proxy`](https://github.com/sparfenyuk/mcp-proxy) to expose it over HTTP/SSE at `:8000/sse`, since standard MCP stdio transport can't be reached over a network directly. See [`Dockerfile`](Dockerfile) / [`docker-compose.yml`](docker-compose.yml).

---

**Your workspace slug** is the part of your Huly URL after the domain: `huly.app/`**`myteam`** → slug is `myteam` (self-hosted: the `url` field of your workspace, e.g. `https://your-instance.com/workbench/`**`myteam`**).

---

## Compatible Clients

The same MCP server works across all major AI coding tools. Pick your client, then swap the `npx`/`args` for the local build per [Installing this fork](#installing-this-fork) above.

> **Auth note:** All config examples below use `HULY_TOKEN`. If you have issues with token expiry, use email + password instead — just replace the `env` block with:
> ```json
> "HULY_EMAIL": "your@email.com",
> "HULY_PASSWORD": "yourpassword",
> "HULY_WORKSPACE": "your-workspace-slug"
> ```
> See [Manual Auth](#manual-auth) for details on both options.

---

### Claude Desktop

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "huly": {
      "command": "npx",
      "args": ["huly-mcp-sdk"],
      "env": {
        "HULY_TOKEN": "your-token",
        "HULY_WORKSPACE": "your-workspace-slug"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

---

### Claude Code (CLI)

```bash
claude mcp add huly -e HULY_TOKEN=your-token -e HULY_WORKSPACE=your-slug -- npx huly-mcp-sdk
```

Or scope it to a single project only:

```bash
claude mcp add huly --scope project -e HULY_TOKEN=your-token -e HULY_WORKSPACE=your-slug -- npx huly-mcp-sdk
```

Verify it's connected: `claude mcp list`

---

### Cursor

Create or edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "huly": {
      "command": "npx",
      "args": ["huly-mcp-sdk"],
      "env": {
        "HULY_TOKEN": "your-token",
        "HULY_WORKSPACE": "your-workspace-slug"
      }
    }
  }
}
```

Restart Cursor. The tools appear in the Agent panel under MCP.

---

### Windsurf (Codeium)

Create or edit `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "huly": {
      "command": "npx",
      "args": ["huly-mcp-sdk"],
      "env": {
        "HULY_TOKEN": "your-token",
        "HULY_WORKSPACE": "your-workspace-slug"
      }
    }
  }
}
```

Restart Windsurf. MCP tools are available to the Cascade AI panel.

---

### VS Code — Cline extension

1. Install the [Cline extension](https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev)
2. Open Cline settings → **MCP Servers** → **Edit MCP Settings**
3. Add:

```json
{
  "huly": {
    "command": "npx",
    "args": ["huly-mcp-sdk"],
    "env": {
      "HULY_TOKEN": "your-token",
      "HULY_WORKSPACE": "your-workspace-slug"
    }
  }
}
```

---

### VS Code — Continue extension

1. Install the [Continue extension](https://marketplace.visualstudio.com/items?itemName=Continue.continue)
2. Edit `~/.continue/config.json` and add to the `mcpServers` array:

```json
{
  "mcpServers": [
    {
      "name": "huly",
      "command": "npx",
      "args": ["huly-mcp-sdk"],
      "env": {
        "HULY_TOKEN": "your-token",
        "HULY_WORKSPACE": "your-workspace-slug"
      }
    }
  ]
}
```

---

### Zed

Edit `~/.config/zed/settings.json` and add a `context_servers` entry:

```json
{
  "context_servers": {
    "huly": {
      "command": {
        "path": "npx",
        "args": ["huly-mcp-sdk"],
        "env": {
          "HULY_TOKEN": "your-token",
          "HULY_WORKSPACE": "your-workspace-slug"
        }
      }
    }
  }
}
```

---

### OpenAI Codex CLI

Edit `~/.codex/config.json` and add to `mcpServers`:

```json
{
  "mcpServers": {
    "huly": {
      "type": "stdio",
      "command": "npx",
      "args": ["huly-mcp-sdk"],
      "env": {
        "HULY_TOKEN": "your-token",
        "HULY_WORKSPACE": "your-workspace-slug"
      }
    }
  }
}
```

---

### Any other MCP-compatible client

The server uses standard **stdio transport**. If your tool supports MCP, the config pattern is always the same:

- **command:** `node`
- **args:** `["/absolute/path/to/huly-mcp/dist/index.js"]` (see [Installing this fork](#installing-this-fork))
- **env:** `HULY_TOKEN` + `HULY_WORKSPACE` (or `HULY_EMAIL`/`HULY_PASSWORD`; self-hosted also needs `HULY_ACCOUNTS_URL` + `HULY_FRONT_URL`, see [Manual Auth](#manual-auth))

Consult your tool's MCP documentation for the exact config file location.

---

<img width="932" height="401" alt="image" src="https://github.com/user-attachments/assets/0f9d9a74-ca1e-4884-bd6a-918c0fb8ddbd" />

## Example Prompts

**Projects & issues:**
- *"Create a new project called 'Mobile App' with identifier MOBILE"*
- *"List all in-progress issues in the PROJ project"*
- *"Create a high-priority issue in PROJ titled 'Fix login timeout'"*
- *"Update PROJ-42 status to Done, assign it to Sarah, and move it to the Auth component"*
- *"Search for issues related to authentication"*
- *"Add a comment to PROJ-15 saying the fix is deployed"*
- *"List all comments on PROJ-42 to see the discussion"*

**Milestones & components:**
- *"Create a milestone 'v2.0 Launch' in PROJ with target date 2026-06-01"*
- *"List milestones for the PROJ project"*
- *"Create a component called 'Auth' in PROJ"*
- *"List all components in PROJ"*

**Labels & relations:**
- *"Add the label 'bug' to PROJ-42"*
- *"Create a label called 'backend' with color #3b82f6"*
- *"Mark PROJ-55 as blocked by PROJ-12"*
- *"Set PROJ-42 as a subtask of PROJ-5"*

**Time tracking:**
- *"Log 2.5 hours on PROJ-42 for the database refactor"*

**Documents:**
- *"List all documents in the Engineering teamspace"*
- *"Create a document called 'API Design' in the Engineering teamspace"*
- *"Update the API Design document with this Markdown: ..."*
- *"Add a Mermaid architecture diagram to the EP1 document"*
- *"Link document abc123 to issue PROJ-42"*
- *"Delete the second comment on PROJ-15"*

---

## Document Content

### Reading: `get_document`

`get_document` always returns full metadata (title, teamspace, comments, snapshots). To also fetch and display the **text content**, set the optional `HULY_FRONT_URL` env var:

```json
"env": {
  "HULY_TOKEN": "...",
  "HULY_WORKSPACE": "myteam",
  "HULY_FRONT_URL": "https://front.huly.app"
}
```

For **self-hosted** Huly, set `HULY_FRONT_URL` to your own front service URL (e.g. `http://localhost:8083`).

### Writing: `update_document`

`update_document` accepts a `documentId` and a `markdown` string and writes rich structured content directly to the document — no manual editing required.

> **Self-hosted note:** Document content (and, as of this fork, issue descriptions —
> see below) is stored as a `MarkupBlobRef` blob. Huly Cloud uploads these through a
> dedicated "datalake" microservice at a fixed URL; `huly-selfhost` (v0.7.x) does not
> run that service — blob storage goes through `front`'s own, older `/files` endpoint
> instead. **If `HULY_FRONT_URL` is set, this fork uploads through that self-hosted
> contract automatically; if it's unset, it falls back to Huly Cloud's datalake** (the
> original, upstream behavior). No separate flag needed — `HULY_FRONT_URL` doubles as
> the self-host/cloud switch for both reading and writing.

**Supported Markdown:**

| Element | Syntax |
|---------|--------|
| Headings | `#`, `##`, `###` |
| Bold / inline code | `**bold**`, `` `code` `` |
| Paragraphs | plain text |
| Bullet lists | `- item` |
| Pipe tables | `\| col \| col \|` |
| Code blocks | ` ```lang ` |
| **Mermaid diagrams** | ` ```mermaid ` — stored as Huly's native `mermaid` node type so diagrams render as interactive visuals in the editor |

**Example:**

```
update_document({
  documentId: "abc123",
  markdown: `# Service Flow\n\n` +
    `## Architecture\n\n` +
    "```mermaid\n" +
    "flowchart TD\n" +
    "  A([User]) --> B[Browse Catalogue]\n" +
    "  B --> C[Pay via Razorpay]\n" +
    "  C --> D[Order Confirmed]\n" +
    "```\n\n" +
    "## Business Rules\n\n" +
    "- Payment required before confirmation\n" +
    "- All orders synced to HIS\n"
})
```

The Mermaid block renders as a live interactive diagram in Huly's document editor — not as a code block.

---

## Bulk CSV Import

Import many issues at once from a CSV file — useful for migrating from other tools:

```bash
node scripts/import-csv.js tasks.csv PROJ
```

**CSV format:**

```csv
title,priority,status,dueDate
Fix login bug,High,In Progress,2025-04-01
Add dark mode,Medium,,
Improve performance,Urgent,,2025-05-01
```

Required column: `title`. Optional: `priority` (Urgent/High/Medium/Low), `status` (must match a status name in the project), `dueDate` (YYYY-MM-DD).

---

## Manual Auth

Create a `.env` file in the project root (or pass via `env` in your client config):

**Option A — Email + password (recommended):**

Works if you have a password set on your Huly account (Profile → Security → Change password).

```bash
HULY_EMAIL=your@email.com
HULY_PASSWORD=yourpassword
HULY_WORKSPACE=your-workspace-slug
```

**Option B — Token:**

```bash
HULY_WORKSPACE=your-workspace-slug
HULY_TOKEN=your-token-here
```

To get a token: go to [huly.app](https://huly.app) → open browser DevTools → Application → Local Storage → `https://huly.app` → copy the `token` value.

> Tokens expire after some time. If you get an auth error, switch to email + password auth or refresh the token from DevTools.

**Self-hosted Huly:**

```bash
HULY_ACCOUNTS_URL=https://your-huly-instance.com/account
HULY_FRONT_URL=https://your-huly-instance.com
```

---

## Architecture

- **Single long-lived WebSocket connection** — connects once per process via `@hcengineering/server-client`, not per tool call (model load takes 1–3 s, so this keeps tools fast)
- **Lazy init** — connects on the first tool call so auth errors surface clearly in Claude
- **Dual auth** — OTP token (works for Google/GitHub SSO) or email + password
- **Stdio transport** — standard MCP transport compatible with Claude Desktop and any MCP client

---

## Changelog

### Fork — self-hosted support, chat, attachments, statuses, organizations
- **Fix: self-hosted document/description writes** — auto-detects `huly-selfhost` via `HULY_FRONT_URL` and uploads through `front`'s `/files` contract instead of Huly Cloud's datalake, which self-hosted doesn't run
- **New: `description` on `create_issue`/`update_issue`** — was missing entirely upstream
- **New: Chat** — `list_channels`, `create_channel`, `start_direct_message`, `send_message`, `list_messages`
- **New: Attachments** — `attach_file`, `list_attachments`, `delete_attachment`
- **New: Issue Statuses** — `list_issue_statuses`, `create_issue_status`
- **New: Organizations** — `list_organizations`, `get_organization`, `create_organization`, `update_organization`
- See [About this fork](#about-this-fork) for details and what was investigated but not built

### v0.5.6 — delete_document
- **New: `delete_document`** — permanently delete a document by ID

### v0.5.5 — create_teamspace
- **New: `create_teamspace`** — create a new document teamspace (top-level folder for organising documents by project or team)

### v0.5.2 — delete_comment + link_document
- **New: `delete_comment`** — delete a specific comment from an issue by ID; `list_comments` now includes comment IDs in its output
- **New: `link_document`** — link a Huly document to an issue; the document appears in the Relations panel on the issue

### v0.5.0 — Document Writing + Bug Fixes
- **New: `update_document`** — write Markdown to any Huly document programmatically; `\`\`\`mermaid` blocks use Huly's native node type and render as interactive diagrams
- **Fix: `IssueStatus` queries** — statuses are stored globally in Huly (`core:space:Model`), not per-project; removed incorrect space filter that caused *"no statuses found"* errors on `create_issue`, `update_issue`, and `list_issues`
- **Fix: `create_project`** — sets `members: [currentUser]` so newly created projects are immediately visible in the Huly UI

### v0.4.0
- `log_time`, `list_comments`, component/milestone assignment on `update_issue`

### v0.3.1
- `get_document`, `create_document`

### v0.3.0
- `create_project`, `create_milestone`, assignee support on issues

---

## Links

- This fork: https://github.com/JoKeks2023/huly-mcp
- Upstream: https://github.com/varaprasadreddy9676/huly-mcp ([npm](https://www.npmjs.com/package/huly-mcp-sdk), [MCP Registry](https://registry.modelcontextprotocol.io) — neither reflects this fork's changes)
- Missing `.d.ts` in `@hcengineering/*` 0.7.411+: https://github.com/hcengineering/platform/issues/10881

---

## License

[Eclipse Public License 2.0](https://www.eclipse.org/legal/epl-2.0/)
