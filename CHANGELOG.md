# Changelog

All notable changes to [huly-mcp-selfhost](https://www.npmjs.com/package/huly-mcp-selfhost). Versions follow [semver](https://semver.org).

### Unreleased

- **Team server: several fixed accounts in one container (profiles).** `MCP_PROFILES_FILE` (or `MCP_PROFILES`) lists logins; each gets its own path `/<name>/mcp` — easy to route through a Cloudflare Tunnel — and its own bearer token (`"public": true` only when the path is protected elsewhere). Per profile: token or e-mail + password, a pinned workspace, toolsets. One Huly connection per profile, opened at start-up; sessions cannot cross paths.
- **New plugin `huly-remote`** for teams with a huly-mcp server: the same skill, hooks and commands, but nothing runs on your computer — Claude Code connects to the server URL you enter and you log in with your Huly account in the browser (OAuth). `/plugin install huly-remote@huly-mcp`. Generated from `plugin/` (`npm run plugin:remote`), checked in CI.

### 4.0.0 — 2026-11-14

Everything that was left in the backlog, in one release. **Breaking:** Node.js 22 or newer (the Claude Code plugin, the Claude Desktop extension and the Docker image bring their own). Highlights: set a whole workspace up from Claude (`admin`), know whether a release is ready (`release_check`), a weekly timesheet, instant resource subscriptions, components and milestones by partial name.

- **Breaking: Node.js 22 or newer.** Node 20 reached end of life; the package now requires `>=22` (CI tests 22, 24 and 26; the Docker image runs Node 26). `check_setup` warns on older versions. The Claude Desktop extension and the Claude Code plugin use the Node.js their app brings.
- **`timesheet`** — one week of logged hours by day and project, with totals; past workdays below the expected hours (default 8) are marked as gaps; `everyone` shows a row per person. In the default toolset.
- **Release readiness and test coverage** (toolset `testing`): `release_check` answers "can we ship this milestone?" in one call — open and blocked issues, open PRs, failing or blocked tests, done issues without tests, linked tests never run, target date — with a verdict and the reasons. `test_coverage` lists which issues of a project or milestone have test cases and the latest result of each; `link_test_case` links a case to an issue (Related).
- **New toolset `admin` — set a workspace up like with `gh api`:**
  - `list_modules` / `set_module`: switch Huly's apps (HR, CRM, training, …) on or off for everyone, as Settings → Configure does.
  - `update_workspace_settings`: workspace name, read-only guests, guest sign-up, password expiry.
  - `get_my_profile` / `update_my_profile`: name, bio, city, country, website, social links, public profile; login identities.
  - `create_workspace`, and `setup_workspace`: one template switches modules, adds issue statuses to the workflow, creates projects with components and milestones, and teamspaces — dry run first, existing items are reused.
  - `huly_api`: the account service directly — read methods freely, write methods as dry run unless `dryRun: false`, then with confirmation. Deleting workspaces or accounts, logins, passwords and secrets are not reachable; tokens in answers are redacted.
- **Components and milestones by partial name** — "Backend" finds "API Backend" when that is the only match; an ambiguous name lists the candidates, an unknown one the available names (all tools that take `componentLabel` / `milestoneLabel`).
- **Resource subscriptions are instant** — a subscribed issue or document (or a comment, sub-issue or file on it) changed by anyone is reported within a second, from Huly's own change events, instead of up to 30 s later by polling. A slow poll (5 min, `HULY_SUBSCRIBE_POLL_MS`) stays as a safety net.
- **`create_issue` points out a missing component or milestone** when the project has components or open milestones, with their names — one cheap correction instead of an unsorted issue.
- Module review: request, rating, emoji, export, support and communication get no tools for now (no data in a real workspace, no agent use); listed with reasons in `.github/huly-modules-ignore.txt`, so the weekly module check stays quiet.

### 3.8.0 — 2026-11-14

- **Fixed: issue statuses that the issue's workflow does not allow were set anyway.** Statuses are workspace-wide, but each project type allows some per task type — Huly's GitHub sync, for example, adds "Review in progress" and "Merged" for pull requests only. `update_issue`, `bulk_update_issues`, `create_issue`, `start_work` and `finish_work` took the first status with the name, and Huly later reset such issues to Backlog. Now only allowed statuses are accepted; otherwise the error names the ones that work. `finish_work` hands back anyway and says when there is no review status for issues.
- **`create_issue_status` adds the status to the issue workflow** of a project type (`projectIdentifier`, default: all tracker project types) and reuses an existing status of that name — before, it only created the status document, which no issue could use.
- **Trainings can be written** (toolset `qms`): `create_training` makes a draft `TR-n` with questions in one call — single choice, multiple choice, ordering; with `correct` they are scored, without they are open (e.g. feedback); `add_training_questions` for drafts; `release_training` (archives the earlier released revision and releases the questions, like Huly's "Release"); `assign_training` to people with due date and max attempts (released trainings only); `cancel_training_request`. `get_training` shows assignment ids. Same data as Huly's own UI; verified live (create → release → assign → results → cancel), test data removed.
- **Fixed: `get_training` showed the correct order of ordering questions wrong** — Huly stores each option's position, the output read it as an index.

### 3.7.1 — 2026-11-14

- **Team server (OAuth): the token key is derived from `MCP_OAUTH_SECRET` with scrypt** instead of a single SHA-256 — a passphrase used as secret no longer makes guessing it from a stolen token cheap. **Everyone logs in once more after the update** (existing tokens were sealed with the old key).
- **Team server: rate limits per client IP** — `/oauth/login` 30 per minute (on top of the per-failure throttle), `/mcp` 600 per minute; standard `RateLimit` headers, 429 when exceeded.
- **Docker image on Node 26** (the current LTS) instead of 22.
- Community files: [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), a pull-request template and [ACCESSIBILITY.md](ACCESSIBILITY.md); the website passes an axe-core check (contrast, keyboard access to scrollable code, tap targets).
- CI warns when the nightly live test is skipped because its sandbox secrets are missing.
- Code scanning no longer scans the plugin's bundled server (its source in `src/` is scanned); 436 of 447 alerts came from third-party code in that build.

### 3.7.0 — 2026-11-14

- **Agent evals** (`evals/`, `npm run evals`): Haiku solves 12 typical Huly tasks through the server, with and without the skill; success is checked in Huly, calls/tokens/cost recorded. Findings and numbers: `evals/RESULTS.md`.
- **Skill rewritten** along Anthropic's skill guidelines: description says what and when; checklists for the coding workflow (start → side findings → PR and hand-back → plan); a table that maps what the user says to the call ("I'm fixing X now" → `start_work`); what to do when a call fails. The plugin's SessionStart hook now tells Claude to load the skill — in the evals Haiku never loaded it on its own, and with it loaded it solved the workflow tasks it failed without.
- **Server instructions** (all clients): when the user says they start or work on an issue → `start_work`; a side finding → sub-issue.
- **`create_issue` takes `parentIdentifier`** — a sub-issue in one call.
- **`list_issues` takes `blocked: true`** — issues waiting for an open blocker. `status: "Blocked"` (not a status in Huly) now says so and lists the real statuses.
- **Fixed: `finish_work` failed when the PR was not synced to Huly yet** (sync takes a minute; projects without sync never have it). It now hands back anyway — summary with the PR link, status — and says to run it again later to put the PR under the issue.
- **Clearer choice between similar tools** — `get_issue` / `get_issue_context` / `get_activity`, `search` / `search_issues`, `my_day` / `standup` / `triage_inbox` / `project_report`, `claim_issue` / `start_work` each name the sibling to use instead (from Glama's tool-quality review).
- **`update_organization`** changes name and city too, not only the description.
- **Claude plugin directory:** the slash commands no longer run inline shell (`!`…``); they tell Claude which git commands to run. The directory's validator refused inline programs such as `--jq` there.
- **About twice as fast.** Statuses, people, projects, milestones, components and labels are kept per connection and dropped the moment Huly reports a change to them — Huly pushes every change in the workspace to the connection, also those made by other people (verified live: a component added from another session was visible on the next call). Never older than 10 minutes either way; `HULY_CACHE=0` turns it off. Measured on nine typical calls (warm connection, median of 3): 3.8 s → 1.9 s in total; `standup` 1.1 s → 0.44 s, `my_day` 0.83 s → 0.24 s, `project_report` 0.32 s → 0.16 s, `list_milestones` 108 ms → 1 ms.
- `my_day` labels its inbox items with one query per class instead of one per item (10 → 1 queries); `triage_inbox` no longer loads each object twice.

### 3.6.2 — 2026-11-12

- **Claude plugin: the server ships inside the plugin** — `node ${CLAUDE_PLUGIN_ROOT}/server/index.js` instead of `npx huly-mcp-selfhost@…`. The Claude plugin directory blocks a server that the start command downloads and runs. The file is the bundled build of the release (readable, not minified, the same as in the npm package); the release checks that it matches its own build. Starts faster and works offline. Guides are read from the plugin's skill files, the version is built in.

### 3.6.1 — 2026-11-12

- **Claude plugin directory: the plugin passes its settings the way the directory requires** — as `CLAUDE_PLUGIN_OPTION_HULY_*` (e.g. `CLAUDE_PLUGIN_OPTION_HULY_EMAIL`) instead of `HULY_*` with `${user_config.…}` in the npx command, which the directory's validator blocked. The server reads those names as the matching `HULY_*` setting (an explicit `HULY_*` value still wins) and, started as a plugin, turns tool annotations on. Nothing changes for other setups.

### 3.6.0 — 2026-11-12

- **New: Claude Desktop extension** — `huly-mcp-selfhost.mcpb` on every GitHub release: double-click, enter your Huly login in Claude Desktop's form (password and token go to the system keychain), done — no Node.js, no JSON. Built from the same bundled server; the release smoke-tests it before attaching it.
- **Clearer tool descriptions** for the tools rated weakest by Glama's Tool Definition Quality Score (`list_todos`, `search`, `create_document`, `delete_comment`, …): verb first, the key default or side effect, the tool to use instead. +732 characters in the default tool list (+1.9 %). `create_document` now points to `update_document` for the body.
- **`changes_since` is shorter** — fields set when an issue was created count as "new", and when one person made every change the name appears once in the heading (−14 % measured on 14 days of changes).
- **`triage_inbox`**: a comment that appears on several items (bots commenting on every PR) is shown once in full; GitHub-synced accounts are named by their login (`dependabot[bot] (GitHub)`) instead of "Unknown".
- **Aliases per tool**: `update_milestone`/`get_milestone` accept `milestoneLabel` for `label`, `update_component` accepts `componentLabel` — the names other tools use.
- **Release workflow** waits up to 15 minutes for npm before the MCP registry publish and retries it (3.5.1 needed a manual re-run).
- Website and README: navigation with jump links, back-to-top links, plugin icon for the Claude directory.
- Issue forms (bug report asks for `check_setup` output), questions in GitHub Discussions, private security reports.

### 3.5.1 — 2026-11-11

- **Fixed: `resources/list` failed without a usable login** — it tried to list your open issues and errored when the login was missing or wrong (e.g. in an inspector or a client not set up yet). Now the guides are listed and issues are simply left out. Found through Glama's inspection.
- **Release workflow** waits until npm shows the new version before registering it with the MCP registry (3.5.0 was refused once because npm was a few seconds behind).
- npm and registry descriptions: 227 tools.

### 3.5.0 — 2026-11-11

- **Fixed: MCP registry name** — the registry namespace is case-sensitive and must match the GitHub owner: `io.github.JoKeks2023/huly-mcp-selfhost` (was lowercase, refused with 403). A test checks it.
- **Fixed: `check_setup` in HTTP/OAuth sessions** reported "No credentials" — it read the server's environment instead of the session's own login. Found while testing OAuth from Claude Code.
- **Install size: 126 MB → 4.3 MB.** The package is now one bundled, readable file (`dist/index.js`, esbuild, not minified) with no runtime dependencies — the first `npx huly-mcp-selfhost` downloads 900 kB instead of ~180 packages. Verified from a clean install of the packed tarball: MCP over stdio, CLI, reads (issues, documents via the front service, reports, search, inbox, drive), writes with undo, HTTP with header login and OAuth. `huly-mcp-setup` still works (now a small wrapper for `huly-mcp setup`).
- **Fixed: `create_issue_tree` dropped the epic's component, milestone and status** — the epic only took title, description, priority and labels; anything else was silently ignored (and the dry run did not show it). The epic now takes `componentLabel`, `milestoneLabel`, `assignee` and `statusName` (children get `statusName` too), the top-level `componentLabel`/`milestoneLabel` defaults apply to the epic as well, and the dry run lists them.
- **Fixed: unknown fields in nested objects are rejected instead of dropped** — in `create_issue_tree`, issue templates, test cases, persons, inventory variants and generic writes. A test keeps every tool that way.
- **New: log in with Huly (OAuth)** — with `MCP_OAUTH_SECRET` and `MCP_PUBLIC_URL`, the HTTP server is an OAuth 2.1 server: people add `…/mcp` in Claude Code, Claude's custom connectors or another OAuth-capable client and log in in the browser with their own Huly account (password, or a one-time e-mail code for Google/GitHub accounts). Stateless (AES-256-GCM sealed registrations, codes and tokens — no database, survives restarts); the password is never stored; 1-hour access tokens, rotating 30-day refresh tokens, login throttling, PKCE and client registration from the MCP SDK. Verified live against a self-hosted Huly, including Claude Code's own OAuth flow (client registration, browser login, tools as that person).
- **New: `undo_changes`** — undo your last changes made through this server, newest first: created objects are removed, changed fields get their old values, deleted objects come back with the same id and data (verified live: an issue deleted and restored with its description). Dry run by default; an object someone else changed since is skipped and named (`force` overrides). Works for every write tool without per-tool code — writes are recorded as their reverse while a tool runs; issue counters are never wound back. History per process (stdio) or per session (HTTP), last 50 changes.
- **New: command line for every tool** — `huly-mcp <tool> --param value` (or `npx huly-mcp-selfhost …`): `tools` to search, `help <tool>` with types, allowed values and defaults generated from the same schemas the MCP server uses; values read by type, lists by repeating a flag, JSON for nested values, `--input`/`--json`, `--<param>-file`; a positional value for tools with one required parameter; the same write scope, audit log and confirmation (hard-to-undo tools ask in a terminal, scripts need `--yes`); `--format json`; exit codes 0/1/2 with "did you mean" hints; bash/zsh completion for tools, options and values. Verified live (read, JSON output, create with a description from a file, guarded delete).

### 3.4.0 — 2026-11-11

- **New: team server over HTTP** — `huly-mcp-selfhost http` (Docker: `MCP_TRANSPORT=http`) serves MCP at `/mcp` with persistent sessions instead of a proxy. Every client can bring its own Huly login (`X-Huly-Token` or `X-Huly-Email`/`X-Huly-Password`, optional `X-Huly-Workspace`), so one server works for a whole team and each person acts as themselves. The server's own login is only used behind `MCP_AUTH_TOKEN`. Measured: first call of a session ~0.2 s.
- **New: `check_setup`** — one call that diagnoses the setup: version and newer releases, login (incl. API-token expiry), workspaces, front URL, active settings; never prints secrets.
- **New: `manage_notifications`** — for one object: pin/unpin, hide/unhide, mark unread, unarchive, follow/unfollow. Verified live.
- **Huly API tokens** (Settings → API tokens) work as `HULY_TOKEN`: the server stays in the token's workspace, checks the expiry before connecting and explains expired or revoked tokens. Built from Huly's source; not yet tested against a live server that issues such tokens.
- **`list_issues`: two new filters** — `title` (title contains text, case-insensitive) and `due` (`overdue`, `set`, `none`). Both run as one query on the server and combine with all other filters. Verified live on a self-hosted instance.
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
