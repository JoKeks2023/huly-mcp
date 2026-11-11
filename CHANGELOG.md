# Changelog

All notable changes to [huly-mcp-selfhost](https://www.npmjs.com/package/huly-mcp-selfhost). Versions follow [semver](https://semver.org).

### Unreleased

- **Faster first call:** the server logs in and opens the workspace (when there is only one, e.g. pinned with `HULY_WORKSPACE`) in the background right after start-up. Measured on a self-hosted instance: first `list_issues` 4.4 s → 0.17 s; start-up itself unchanged. `HULY_PREWARM=0` turns it off; a failed login is reported by the first real call as before.
- **Fixed: MCP registry entry.** The `server.json` description was longer than the registry's 100 characters, so 3.3.0 was refused there; a test now checks the length and the release workflow warns when the registry refuses an entry.
- **Docs:** clearer positioning ("Huly for AI agents"), a table of measured token costs and a measured comparison with another popular Huly MCP server (2.9× less text per answer, 14× smaller tool definitions) in the README.

### 3.3.0 — 2026-11-11

- **Claude Code plugin: `/huly:setup`** — the agent asks once per repo how Huly is used there (role, where new issues go, initiative, how token-saving) and writes the answers as a `## Huly` section; every later session follows it. You choose where: `CLAUDE.md` (shared), `CLAUDE.local.md` (only you; added to `.gitignore` if needed) or split — shared rules in `CLAUDE.md`, initiative and efficiency in `CLAUDE.local.md`. The project and its GitHub sync are detected first, so only the questions that matter are asked; "Not now" writes nothing. Optional import: status set, components, milestones, TODO/FIXME proposals, architecture document. The session-start hook reads the rules from all three files and offers `/huly:setup` while a repo has none.
- **Feature guide: all of Huly for a software project** (`features.md` in the skill, resource `huly://guide/features`) — what each Huly feature is for in a repo (components, milestones, epics, labels + categories, status set, issue templates, test management and CI JUnit import, documents, chat, GitHub, time, planner, calendar, drive, custom fields, cards, products), the tools, when to propose it, and which toolsets must be enabled. `/huly:setup` offers the extras as imports and reports which toolsets to keep on. A test checks that every tool and toolset named in the guides exists.
- **One skill instead of two:** `huly-workflow` and `huly-efficient` are now the skill `huly` — a short core plus `costs.md` and `onboarding.md`, read only when needed. Fewer tokens, no duplicated rules.
- **Guides and setup for every MCP client:** resources `huly://guide/workflow`, `huly://guide/costs`, `huly://guide/onboarding` (the same files as the plugin skill) and the prompt `setup` — Claude Desktop, Cursor and others get the onboarding flow too; it gives you the rules to paste into your project instructions.
- **New: `HULY_ANNOTATIONS=1`** — MCP tool annotations: a title per tool, `readOnlyHint` for reads, `destructiveHint` for deletes, removals and bulk changes. Off by default because it adds ~16% to the tool list (default set: 36.5k → 42.6k chars); the Claude Code plugin turns it on.
- **Fixed: SSO token setup outside the repo.** `npx huly-mcp-selfhost setup` now runs the token wizard (before, it started the server — the plugin settings pointed to a command that did not exist). It asks for your Huly address (or `--url`), and outside a repo checkout prints the token and URLs to paste instead of writing a `.env` into the npm cache. One line reader for the whole run (piped input no longer loses lines); an unreachable address gets a clear error.
- **Plugin:** starts the npm package at exactly its own version (`@3.2.0`, was `^3.2.0`) — the Claude plugin directory does not accept ranges; `plugin/README.md` describes what the plugin runs and where data goes.
- **Docs:** new README (highlights and quick start first, links work on npmjs.com), the changelog moved to `CHANGELOG.md`, current npm description, keywords and homepage.
- **Build** clears `dist/` first, so no stale files end up in the package.

### 3.2.0 — 2026-11-11

- **New: `issues_from_document`** — spec → issues in one call: open checklist items of a Huly document (or, without a checklist, its sections) become sub-issues of an epic; checked items are skipped; the document is linked to the epic. Dry run by default.
- **New: `issues_from_meeting`** — meeting notes → issues in one call: action items (open checkboxes, `TODO:`/`Action:` lines, lists under "Action items"/"Next steps") with `@assignee` and due date taken from the line; dry run first, each new issue linked to the document.
- **`create_issue` takes `assignee`, `componentLabel` and `milestoneLabel`**, so a new issue no longer needs a second `update_issue` call. An unknown `statusName` is now an error (it used to fall back to the first status). Everything is checked before anything is written.
- **Unknown tool parameters are rejected instead of silently dropped.** Before, `update_issue {status: "Done"}` answered "No changes made". Now the call fails with the list of valid parameters and nothing is done. Common mix-ups are mapped automatically: `status`→`statusName`, `project`/`projectId`→`projectIdentifier`, `issue`/`issueId`/`id`→`identifier`, `component`→`componentLabel`, `milestone`→`milestoneLabel`.
- **`get_issue` is shorter:** empty fields (no milestone, 0 comments, …) are left out and the fields share one line.
- **Smaller tool list:** the `workspace` parameter no longer repeats its description in every tool (the server instructions explain it once). Default set 38.7k → 35.2k characters, all toolsets 88.8k → 80.3k.
- **New `HULY_TRANSACTOR_URL`:** a server running next to Huly (same Docker network) can reach the transactor internally, e.g. `ws://huly/_transactor`, instead of the public address — no detour through the uplink or a tunnel.
- **Claude Code plugin: new skill `huly-efficient`** — which Huly call answers which question with the least output (sizes measured on a real project), which writes need only one call, and which checks the tools already do. The `huly-workflow` skill points to it.
- **Claude Code plugin:** `/huly:standup` and `/huly:triage` (and the MCP prompts) now use the one-call tools `standup` and `triage_inbox`; new commands `/huly:day` (`my_day`) and `/huly:report` (`project_report`); new settings for a pinned workspace (`HULY_WORKSPACE`) and on-demand toolsets (`HULY_DYNAMIC_TOOLSETS`). The skill points to the overview tools and to `create_issue` with component/milestone.
- **Fixed: Huly client log lines on stdout.** `Client: onConnect 1` landed in the JSON-RPC stream; mcp-proxy logged "Failed to parse JSONRPC message". Such logs now go to stderr.
- **Fixed: session tokens in logs.** Huly's client logs its websocket URL including the workspace token (`client websocket error: … /_transactor/<token>`), which ended up in `docker compose logs`. Tokens in log output are now masked as `***`.
- **Fixed: `create_issue_tree` (and `issues_from_document`) left reused issues outside the epic.** A same-title issue that is reused now moves under the epic when it has no parent; one under another parent stays there, and the plan and result say so.
- **Fixed: blob requests without a timeout.** Reading document/description content and uploads could hang a tool call when the front service stalled. Reads now stop after 30 s, uploads after 2 min, with a clear error naming `HULY_FRONT_URL`.
- `create_issue_tree` passes component, milestone and assignee straight to `create_issue`, so a wrong name fails before the issue exists (before: the issue was created, then the update failed).
- Unknown-parameter error of tools without own parameters (e.g. `list_issue_statuses`) said "Valid: ."; it now says the tool takes no parameters besides `workspace`.
- README: context-cost table re-measured (the pinned saving is now ~10%, not 20%, since the `workspace` description was already shortened).
- CI: CodeQL Action v4; runs on `main` are no longer cancelled by the next push.

### 3.1.1 — 2026-11-04

- **Fixed: Docker image behind a reverse proxy.** The `mcp-proxy` update in 3.1.0 made the server reject every Host name except `localhost` (`421 Invalid Host header`). New variable `MCP_ALLOWED_HOSTS` (comma-separated) lists the host names clients use, e.g. `MCP_ALLOWED_HOSTS=huly-mcp.example.com`. Without it the container logs a warning. CI now tests allowed and rejected Host headers.
- Release workflow: when `npm publish` fails, the OIDC/auth lines of npm's debug log are shown (3.1.0 had to be published to npm by hand).

### 3.1.0 — 2026-11-04

First 3.x release on npm. 3.0.0 was only released on GitHub; everything from it is included here.

**One call instead of several**
- **New: `my_day`** (toolset `agent`, on by default) — "what's on today?" in one call: calendar, to-dos, my issues, reviews, unread inbox.
- **New: `standup`, `triage_inbox`, `release_notes`** — one call each instead of several: yesterday/today/blockers, the inbox with what changed since last read, and release notes from a milestone.
- **New: `project_report`** (toolset `agent`) — weekly report of a project: done, new, in progress, blocked, overdue, PRs, milestones, time logged.

**More of Huly**
- **New: test management, much more of it** — `import_test_results` and the CLI `huly-mcp junit` bring CI results (JUnit XML) into Huly as test runs; `get_test_report` shows failing, flaky, blocked and never-run cases over the latest runs; `create_issue_from_test_result` turns a failed test into a bug (steps and failure included, related to the test case); `create_test_cases` creates many cases at once; suites can be renamed, moved and deleted, runs renamed, dated and deleted, plans deleted, results assigned.
- **New: `start_process` / `cancel_execution`** — run a process on a card and cancel a running one. Starting works like Huly's "Run process" menu; Huly's process service then moves the execution on. Processes whose start asks for input in the app are refused, and so is a second run where the process forbids parallel runs. Cancelling asks first.
- `get_issue` names related non-issue documents (e.g. a test case) instead of showing a bare id.

**Changed behaviour**
- **Changed: `list_issues` lists open issues by default.** Pass `status: "all"` for every issue, or a status name. Long lists show `51–100 of 118` and page with `offset`. In a mature project this cuts the answer by ~80%.
- **Changed: `list_comments` returns the newest comments** (before: the oldest), still in chronological order. Comments over 1,500 characters are shortened with a visible marker; `full: true` shows them whole. Issue descriptions are never shortened, because `update_issue` replaces them.
- **Changed: Docker tags.** `latest` now means the latest *release* (before: the latest commit on `main`), and `main` builds are tagged `edge`. There are new tags `3` and `3.1` for release lines, and images are built for `linux/arm64` as well, with an SBOM and provenance.
- `list_labels`: dead code for the ignored `projectIdentifier` removed. No behaviour change.

**Fewer tokens**
- **Fewer tokens:**
  - With `HULY_WORKSPACE` set, tools take no `workspace` argument (−20% tool-list size). Changes still go to exactly that workspace.
  - Validation limits (`minLength`, `maximum` …) are no longer sent in tool schemas. They are still enforced, with a clear error.
  - `list_issues` uses one line per issue and leaves out "No priority".
  - `list_notifications` shows notification ids only with `ids: true`. Marking read by object (`PROJ-12`) does not need them.
- **New: load toolsets on demand** (`HULY_DYNAMIC_TOOLSETS=1`, opt-in): start small and let Claude load toolsets with `enable_toolsets`. With `agent,inbox` a session starts at ≈1.8k tokens. Not yet verified in Claude Desktop.
- Server instructions are 41 % shorter (1,463 → 858 chars). They now point to the one-call overviews (`my_day`, `standup`, `triage_inbox` …); hints that the tool descriptions already carry were dropped.
- Read tools describe `workspace` more briefly (the rule for omitting it is in the server instructions), which keeps the default set within its context budget.

**Security**
- **Security fixes from code scanning:**
  - Docker image: `mcp-proxy` 0.14.0 with `mcp` 1.30.0 (fixes 5 CVEs); npm is removed from the runtime image (23 alerts in npm's bundled packages); Debian security updates are applied at build time.
  - `uuid` is pinned to 11.1.1 via an npm override (a CVE in 8.3.2, pulled in by Huly's server client).
  - Code: entity decoding in `triage_inbox` no longer double-unescapes (`&amp;lt;` stays `&lt;`); JUnit comment removal is repeated until nothing is left; a check-then-read race in `huly-mcp-setup` is gone.

**CI and releases**
- **CI and automation:**
  - every PR is checked on three platforms, with a token report, a personal-data check, a Docker scan and CodeQL
  - releases publish themselves from a tag
  - a nightly live test runs against a sandbox workspace
  - weekly checks cover new Huly packages and Huly modules without tools
  - see [Development and CI](#development-and-ci)

### 3.0.0 — 2026-11-04

One large release instead of several small ones, built in stages (see [#11](https://github.com/JoKeks2023/huly-mcp/issues/11)).

Breaking:
- Tools are grouped into toolsets.
- `calendar`, `github`, `generic-write` and `tracker-admin` are not enabled by default.
- `HULY_TOOLSETS=all` enables everything.

**Toolsets and the core modules**
- **New: toolsets** (`HULY_TOOLSETS`) and slimmer tool schemas. The 64 tools of 2.2.0 now cost about 36 % fewer tokens.
- **New: inbox** — `list_notifications`, `mark_notifications_read`
- **New: activity** — `get_activity`
- **New: planner** — `list_todos`, `create_todo`, `update_todo`, `delete_todo`, `schedule_todo`
- **New: calendar** — `list_events`, `create_event`, `update_event`, `delete_event`
- **New: chat** — `list_thread`, `reply_to_message`, `update_message`, `delete_message`, `add_reaction`, `remove_reaction`, `pin_message`. `list_messages` now shows authors and message ids.
- **New: GitHub** — `list_pull_requests`, `get_pull_request`
- **New: persons** — `list_persons`, `get_person`, `create_person`, `update_person`, `add_contact_channel`, `remove_contact_channel`
- **New: generic access** — `list_classes`, `describe_class` and `query_documents` (secrets redacted). `generic_create`, `generic_update` and `generic_delete` are opt-in and run as a dry run by default.

**Agent workflow**
- **New: agent workflow** (toolset `agent`, on by default) — `get_issue_context`, `start_work`, `finish_work`, `create_issue_tree`, `changes_since`, `claim_issue`, `release_issue`, `find_project_for_repo`
- **New: MCP resources** (`huly://…/issue/…`, `huly://…/document/…`)
- **New: MCP prompts** (`start`, `finish`, `plan`, `triage`, `standup`)
- **New: guard rails** — `HULY_WRITE_PROJECTS` limits changes to the listed projects, and `HULY_AUDIT_LOG` records every change.
- **Changed: toolset `tracker-admin`.** These tools are no longer in the default set: `create_project`, `update_project`, `create_issue_status`, `update_label`, `delete_label`, `delete_milestone`, `delete_component`, `repair_parent_links`. Enable them with `HULY_TOOLSETS=…,tracker-admin` or `all`.

**Claude Code plugin**
- **New: Claude Code plugin** (`/plugin marketplace add JoKeks2023/huly-mcp`, `/plugin install huly@huly-mcp`). It bundles:
  - the MCP server with its settings
  - the `huly-workflow` skill
  - session-start and PR hooks
  - the commands `/huly:start`, `/huly:finish`, `/huly:plan`, `/huly:triage`, `/huly:standup`

**More of Huly**
- **New: fulltext search across everything** — `search` (issues, documents, messages, cards, files, persons …)
- **New: toolset `collaboration`** — followers of issues/documents, public guest links, document comments
- **New: toolset `cards`** — card types and tags, cards with content, nesting and field values
- **New: toolset `fields`** — custom fields on issues, project types, card types or any class, and their values
- **New: toolset `drive`** — drives, folders, versioned files (upload, download, move, restore)
- **New: toolset `templates`** — issue templates; new issue with sub-issues from a template
- **New: toolset `testing`** — test projects, suites, cases, plans, runs and results
- **New: toolset `products`** — products and versions (read-only)
- **New: label categories** (`tracker-admin`)
- **New: documents** — `list_documents` shows the whole tree; `update_document` renames and moves (also to another teamspace); new documents are placed after their siblings
- **New: MCP argument completions** for prompts and `huly://` resources (workspaces, projects, issue ids) and **resource subscriptions** (`notifications/resources/updated` when a subscribed issue or document changes)

**Business modules**
- **New: toolsets `members`, `recruiting`, `crm`, `hr`, `inventory`** — invitations and roles, vacancies/candidates/applications, leads/customers, departments and time off, inventory
- **New: message templates** (`templates`) and **project types with workflows** (`tracker-admin`)
- **New, read-only: `meetings`** (minutes, transcripts), **`qms`** (controlled documents, trainings), **`process`**, **`surveys`**
- Not included: Huly's Board module (hidden and off by default in Huly itself).

**Agents**
- **New: confirmation for risky tools** — deletes, bulk updates, moves, generic writes, revoking links and restoring file versions ask the user via MCP elicitation when the client supports it (`HULY_CONFIRM`). Declining changes nothing.
- **New: `huly-mcp watch`** — Huly hands work to an agent: issues with a label or assigned to the agent's own account are claimed, passed to `claude -p` (or any command) and released afterwards. Runs are unattended, so they default to `HULY_CONFIRM=strict`.

**Fixes**
- `create_teamspace`, `create_channel`, `start_direct_message` and `create_project` stored the user's social id as member/owner; Huly 0.7 expects the account id. Spaces created with earlier versions may list you twice as member and have no proper owner.
- Public links created on servers whose `FRONT_URL` is `localhost` are shown with `HULY_FRONT_URL` instead.
- Empty or unresolved `HULY_*` variables (for example plugin settings left blank) now count as not set.
- Nested tool errors no longer repeat the "Huly MCP:" prefix.

### 2.2.0 — planning, bulk edits, fixes for Huly 0.7

- **New: filters in `list_issues`** — milestone, component, label, assignee, parent (null = without / top-level)
- **New: `bulk_update_issues`, `move_issue`, `list_sub_issues`, `list_time_reports`**
- **New: `update_project`, `update_comment`, `update_label`, `delete_label`, `remove_relation`, `remove_blocked_by`**
- **New: `repair_parent_links`** — re-links sub-issues created by earlier versions (dry run by default)
- **More detail in `get_issue`** — assignee, milestone, component, labels, parent, blocked by, related
- **`list_members`** shows names
- **Fix: `set_parent`** now links like Huly itself (`attachedTo`). Before, sub-issues did not appear under their parent in Huly. Existing links: `repair_parent_links` or `set_parent` again
- **Fix: people lookup on Huly 0.7** — `log_time` failed ("Could not identify current user"), assigning by name (`assignee`, `lead`) never matched and comment authors showed as "Unknown". People are now resolved via the Employee mixin; names are shown as "First Last" and ambiguous names are rejected
- **Fix: bold/italic text** in issue, document and organization descriptions no longer breaks into separate lines
- **Fix: `update_issue`** accepts `componentLabel: null` (as documented) and rejects invalid due dates

### 2.1.0 — milestones & components, security updates

- **New: `get_milestone`, `update_milestone`, `delete_milestone`** — progress overview, edit name/date/status/description, delete with issues unassigned or moved via `moveIssuesTo`
- **New: `update_component`, `delete_component`** — edit name/description/lead, delete with issues unassigned or moved via `moveIssuesTo`
- **Changed: `list_components`** renders Markdown/ProseMirror descriptions as text
- **Security:** all open dependency advisories fixed — `@modelcontextprotocol/sdk` 1.32, `ws` 8.22, `zod` 4, `dompurify` 3.4.17 (override)

### 2.0.0 — multi-workspace

Breaking: tools that change data require `workspace`; `HULY_WORKSPACE` only restricts the server to one workspace.

- **New: multi-workspace support** — one account login, workspaces discovered via `getUserWorkspaces()`, one cached connection per workspace; `HULY_WORKSPACE` is no longer required (still honoured as an optional single-workspace restriction)
- **New: `list_workspaces`**
- **Changed: every tool takes `workspace`** — required for all tools that change data; reads may omit it only when exactly one workspace is available
- **New: `huly-mcp-selfhost` bin alias** — `npx huly-mcp-selfhost` now starts the server directly
- **Changed: `npm run setup`** no longer asks for a workspace; it lists the discovered workspaces instead
- **Changed: `scripts/import-csv.js`, `cleanup-issues.js`, `demo.js`** need `--workspace=<slug>` (or `HULY_WORKSPACE`)

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
