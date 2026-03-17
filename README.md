# huly-mcp-sdk

> The most complete MCP server for [Huly](https://huly.app) — the open-source project management platform.

Connects **Claude Desktop** (and any [MCP](https://modelcontextprotocol.io)-compatible client) directly to your Huly workspace. Manage projects, issues, milestones, components, documents, labels, and more — all via natural language.

---

## Tools (31 total)

| Category | Tool | Description |
|----------|------|-------------|
| **Projects** | `list_projects` | List all projects in the workspace |
| | `get_project` | Get project details + available statuses |
| | `create_project` | Create a new tracker project with a unique identifier |
| **Issues** | `list_issues` | List issues with optional status / priority filters |
| | `get_issue` | Get full details of an issue (e.g. `PROJ-42`) |
| | `create_issue` | Create a new issue |
| | `update_issue` | Update title, status, priority, assignee, due date, component, milestone |
| | `delete_issue` | Permanently delete an issue by identifier |
| **Comments** | `add_comment` | Add a comment to an issue |
| | `list_comments` | List all comments on an issue |
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
| | `list_documents` | List documents in a teamspace |
| | `get_document` | Get document metadata + content (see [Document content](#document-content)) |
| | `create_document` | Create a new document in a teamspace |
| **Search** | `search_issues` | Full-text search across all issues |

---

## Requirements

- Node.js >= 20
- A Huly account — [huly.app](https://huly.app) (cloud) or self-hosted

---

## Quick Start

### 1. Install via npx (easiest)

```bash
npx huly-mcp-sdk setup
```

This runs the interactive setup wizard — sends a one-time code to your email (works for Google/GitHub SSO accounts too) and writes your `.env` file automatically.

**Your workspace slug** is the part of your Huly URL after the domain: `huly.app/`**`myteam`** → slug is `myteam`.

### 2. Configure Claude Desktop

Add this to your Claude Desktop config:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "huly": {
      "command": "npx",
      "args": ["huly-mcp-sdk"],
      "env": {
        "HULY_TOKEN": "paste-token-here",
        "HULY_WORKSPACE": "your-workspace-slug"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

> **Alternative (clone & build):**
> ```bash
> git clone https://github.com/varaprasadreddy9676/huly-mcp.git
> cd huly-mcp && npm install && npm run build
> ```
> Then use `"command": "node", "args": ["/absolute/path/to/huly-mcp/dist/index.js"]` in your config.

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
- *"Log 1 hour on PROJ-55 — Fixed bug in login form"*

**Documents:**
- *"List all documents in the Engineering teamspace"*
- *"Create a document called 'API Design' in the Engineering teamspace"*
- *"Get the content of document abc123"*

---

## Document Content

Document content in Huly is stored in a collaborative editing layer (not inline in the database). `get_document` always returns full metadata. To also fetch and read the **text content**, set the optional `HULY_FRONT_URL` env var:

```json
"env": {
  "HULY_TOKEN": "...",
  "HULY_WORKSPACE": "myteam",
  "HULY_FRONT_URL": "https://front.huly.app"
}
```

For **self-hosted** Huly, set `HULY_FRONT_URL` to your own front service URL (e.g. `http://localhost:8083`).

Without `HULY_FRONT_URL`, `get_document` still returns the title, teamspace, comments, snapshots count, and the blob reference ID.

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

Create a `.env` file in the project root:

**Option A — Token (recommended for all account types):**

```bash
HULY_WORKSPACE=your-workspace-slug
HULY_TOKEN=your-token-here
```

To get a token: go to [huly.app](https://huly.app) → open browser DevTools → Application → Local Storage → `https://huly.app` → copy the `token` value.

> Tokens expire after some time. If you get an auth error, run `npx huly-mcp-sdk setup` again or refresh the token from DevTools.

**Option B — Email + password:**

Only works if you have a password set on your account (Profile → Security → Change password).

```bash
HULY_EMAIL=your@email.com
HULY_PASSWORD=yourpassword
HULY_WORKSPACE=your-workspace-slug
```

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

## Links

- npm: https://www.npmjs.com/package/huly-mcp-sdk
- GitHub: https://github.com/varaprasadreddy9676/huly-mcp
- MCP Registry: https://registry.modelcontextprotocol.io (search "huly-mcp")

---

## License

[Eclipse Public License 2.0](https://www.eclipse.org/legal/epl-2.0/)
