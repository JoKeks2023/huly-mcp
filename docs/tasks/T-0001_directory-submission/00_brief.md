# T-0001 — Claude directory: submit the plugin

Huly issue: HULY-61 (epic HULY-55). Sources, read 2026-11-11: claude.com/docs `directory/publish`, `connectors/building/submission`, `connectors/building/review-criteria`, `plugins/platform-support`, `plugins/pre-submission-checklist`, `plugins/submit`.

## What can be listed

- **Plugin bundle** (this repo, folder `plugin/`) — possible now. Anyone on a paid Claude plan submits at https://claude.ai/directory/manage. Automatic validation + security scan, then a person reviews the first listing.
- **Remote MCP connector** (Claude and ChatGPT directories) — needs a hosted HTTPS server with OAuth 2.0 and a populated test account; per-user URLs ("URL pattern") are only published with the Verified label. That is the multi-account / "log in with Huly" work — a separate epic, not this task.
- Desktop extensions (`.mcpb`) are no longer accepted; local servers go into a plugin bundle.

## Where the plugin works

| Surface | Loads |
|---|---|
| Claude Code | everything |
| Cowork (local session) | skill, commands, hooks; MCP server only if every `${user_config.*}` it references has a value — Cowork does not prompt |
| Chat (web/desktop/mobile) | skill and commands only, no MCP server, no hooks |
