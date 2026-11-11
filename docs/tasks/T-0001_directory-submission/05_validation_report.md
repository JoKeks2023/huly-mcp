# T-0001 — Checklist status

`claude plugin validate ./plugin --profile directory` on branch `feat/onboarding-experience`: **passed**, open findings below.

## Done in this branch

| Item | Result |
|---|---|
| `npx` launcher pinned to an exact version (ranges block) | `huly-mcp-selfhost@3.2.0`; test enforces exact = package version |
| README in the plugin folder, ≥ 40 words, install line | `plugin/README.md` |
| Disclose everything the plugin runs, sends, fetches | `plugin/README.md` → "What it runs", "Where data goes" |
| Credentials only via `userConfig` with `sensitive: true` | password and token are sensitive; no real secrets in the folder |
| License | `license: EPL-2.0` in `plugin.json` |
| Hook commands from `${CLAUDE_PLUGIN_ROOT}`, valid `hooks.json` | yes |
| Tool annotations (title, readOnlyHint, destructiveHint) | `HULY_ANNOTATIONS=1`, set in `plugin/.mcp.json` |
| `.DS_Store` | present on disk only, not committed (`.gitignore`) — not submitted |

## Open — needs Joris

1. **npm 3.2.0 must be published first.** The plugin starts exactly `huly-mcp-selfhost@3.2.0`; npm still has 3.1.0, so the plugin's server does not start until then (the previous `^3.2.0` had the same problem).
2. **Icon** — square PNG 512–2048 px, < 2 MB, at `plugin/.claude-plugin/icon.png`. It becomes the listing icon **only once** (first save in the portal). Candidate rendered from `site/favicon.svg` (1024 px), not committed — confirm or replace.
3. **Name** — `huly` is another company's product name; the review may hold it ("known brand"). Options: keep `huly` and explain it is a community plugin (README says so), or rename (e.g. `huly-mcp`) — renaming changes the command prefix `/huly:*` for existing users.
4. **Portal** (https://claude.ai/directory/manage): Submit new → Plugin bundle → repo `JoKeks2023/huly-mcp`, path `plugin`, branch `main` → Validate. Data handling: reads/writes personal data only in the user's own Huly instance; no other destinations; no retention by the plugin; not intended for under-18s. Contact e-mail + four acknowledgements. Webhook on push (default).
5. Expected reviewer holds (not blockers): "Runs a pinned npx package", "Scripts the validator couldn't follow" (the `.mjs` hooks).

## Not verified

- Loading in Cowork and Desktop chat (no test there).
- The security scan and human review only run after submission.
