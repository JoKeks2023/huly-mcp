# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report them privately through GitHub: **[Report a vulnerability](https://github.com/JoKeks2023/huly-mcp/security/advisories/new)** (Security tab → "Report a vulnerability").

A useful report includes:
- what an attacker can do and under which conditions (e.g. a malicious issue title, a crafted document, a compromised MCP client)
- steps to reproduce, ideally against a throwaway Huly workspace
- the affected version (`npm ls huly-mcp-selfhost`, the version in your MCP client config, or the Docker image tag)

You can expect:
- an acknowledgement within **7 days**
- an assessment and a plan within **14 days**
- a fix released as a patch version, with a GitHub Security Advisory that credits you (unless you prefer not to be named)

This is a one-person project, so these are best-effort targets. Coordinated disclosure is appreciated: please give a fix a chance to ship before you publish details.

## Supported versions

| Version | Supported |
|---|---|
| 3.x (latest minor) | ✅ security fixes |
| 2.x and older | ❌ please upgrade |

## Scope

**In scope:** this repository, meaning the MCP server, the `huly-mcp` CLI (`watch`, `junit`), the Claude Code plugin, the Docker image and the release pipeline. Examples:
- credentials or tokens leaking into logs, tool output, URLs or the audit log
- a way around `HULY_WRITE_PROJECTS`, `HULY_CONFIRM`, `HULY_FILE_ROOT` or the dry-run and `confirm` defaults of `generic-write`
- reading or writing local files outside `HULY_FILE_ROOT`
- prompt injection through Huly content (issue titles, comments, documents) that makes the server itself do something it should not, for example shell injection in `huly-mcp watch`
- vulnerabilities in the published npm package or Docker image

**Out of scope:**
- vulnerabilities in Huly itself. Please report those to [hcengineering/platform](https://github.com/hcengineering/platform/security).
- what an AI model decides to do with tools the user has enabled. Limit that with toolsets, `HULY_WRITE_PROJECTS` and `HULY_CONFIRM`.
- findings that need an already compromised machine or MCP client configuration

## How the server protects you

- **Credentials** come only from the environment: `HULY_EMAIL`/`HULY_PASSWORD` or `HULY_TOKEN`. They are never part of tool output. Workspace tokens are sent in the `Authorization` header, never in URLs.
- **Changes need an explicit workspace.** Every tool that changes data requires the `workspace` argument, unless the server is pinned with `HULY_WORKSPACE`.
- **Guard rails for agents:**
  - `HULY_WRITE_PROJECTS` limits which projects can be changed.
  - `HULY_CONFIRM` asks a human before deletes and other risky tools.
  - `HULY_AUDIT_LOG` records every change.
  - Generic writes are dry runs by default.
- **Local files** are off unless `HULY_FILE_ROOT` names a folder. Paths, symlinks included, cannot leave it.
- **`huly-mcp watch`** runs your command without a shell. Issue titles are passed as arguments, so they cannot inject shell commands.

## How the project is checked

Every pull request and release runs:
- CodeQL
- gitleaks (the full history)
- a personal-data check
- Trivy on the Docker image
- Dependabot updates

npm releases are published from GitHub Actions with **provenance** (npm Trusted Publishing), so you can verify that a version was built from this repository:

```bash
npm audit signatures
```
