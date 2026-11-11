---
description: Set up Huly for this repo — ask how to use it, write the rules to CLAUDE.md or CLAUDE.local.md, optionally import the project
argument-hint: "[workspace]"
allowed-tools: Bash(git remote get-url:*), Bash(git tag:*), Bash(git shortlog:*), Bash(git check-ignore:*), Bash(ls:*)
---
Set up how Huly is used in this repository. Workspace hint: `$ARGUMENTS`.

Remote: !`git remote get-url origin 2>/dev/null || echo none`
Active contributors (90 days): !`git shortlog -sn --all --since=90.days`

The result is a short `## Huly` section that every later session follows without asking again. Keep it short — it is loaded into every session.

## 1. Find the project (no questions yet)

- Read `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`. If a `## Huly` section exists, show it and ask whether to change it instead of starting over.
- `find_project_for_repo` with the remote. It tells you the workspace, the project and whether it is **synced with GitHub**. If nothing is linked: `list_workspaces` (several → ask which), `list_projects`, see whether one obviously fits.
- **Never create a Huly project yourself** — the user does that in Huly (the GitHub link needs OAuth there). If none fits, suggest a short key from the repo name (e.g. `SERV` for "server"), ask the user to create it, and continue after they confirm.
- If the Huly tools fail (not configured, auth error): stop and point to the plugin settings (`/plugin` → huly → configure); SSO accounts get a token with `npx huly-mcp-selfhost setup`.

## 2. Ask — one AskUserQuestion call, four questions

Use what step 1 found to pick the recommendation: put it first and mark it "(Recommended)". Don't ask what you already know (sync, project).

1. **Role of Huly here** — Huly leads (with GitHub sync if the project has it) · Overview only (read, don't change) · Not used in this repo · Not now (ask again later).
2. **Where new issues go** — if synced or the repo is on GitHub: Code bugs/TODOs → GitHub, product/architecture → Huly · Everything in Huly · Only when I ask. Without GitHub: Everything in Huly · Only when I ask.
3. **Initiative** — Create issues for bugs found while working and keep status current without asking · Propose first, act after OK · Only on explicit request.
4. **Where to save the rules** —
   - Split: shared rules in `CLAUDE.md`, my preferences (initiative, efficiency) in `CLAUDE.local.md` — recommend when several people are active (ignore bots; one person under two git names counts once).
   - All in `CLAUDE.md` (shared with everyone in the repo) — recommend for a solo repo.
   - All in `CLAUDE.local.md` (only me, not committed).

"Not now": write nothing, say `/huly:setup` can be run any time, stop. "Not used": write only `## Huly\nNot used in this repository.` to `CLAUDE.md` and stop.

## 3. Ask — one AskUserQuestion call, two questions

1. **Efficiency** — Normal · Token-saving: one-call overviews only, no re-reads, comments only when handing back · Minimal: no Huly calls unless needed for the task, status changes bundled at the end.
2. **What to import** (multiSelect; offer only what applies, see the skill's onboarding guide for how; no "nothing" option — selecting none means no import):
   - Components from the repo's modules/packages (paths in the description)
   - Milestones from releases/tags (real delivery targets, not phases)
   - Status set aligned to: Backlog, Todo, In Progress, Done, Canceled, Review in progress, Merged
   - TODO/FIXME comments as a **proposal list** (issues only after the user picks)
   - Architecture/status document as a Huly document
   - Labels for kinds of work (bug, feature, tech debt, …), with categories
   - Issue templates for repeating checklists (release, bug report)
   - Test management: test project with suites mirroring the test folders; CI JUnit import step
   - Document structure: teamspace with Architecture / Decisions / Runbooks
   - Open GitHub issues — **only point them out**, never import on your own

   More than 4 options don't fit one question: put the basics (components, milestones, status set, TODO/FIXME) in one multiSelect and the extras (architecture document, labels, templates, tests, document structure) in a second. For what each extra needs see the skill's `features.md`.

## 4. Write the rules

Show the text, write after the user agrees. Shared part (fill in, drop lines that don't apply):

```markdown
## Huly

- Workspace `<slug>`, project **<KEY>** (GitHub sync: <yes/no>). Role: <answer>.
- New issues: <answer>. Before creating: duplicate check (`search_issues`).
- Every new issue: component and, if it belongs to a release, milestone. Nothing fits → say so, don't create new ones silently.
- Status: In Progress when work starts (`start_work`), Review in progress when the PR is open (`finish_work`), <synced: Done/Merged via sync | not synced: Done after the merge — set it yourself>.
- PRs (synced only): the auto-created PR issue goes under the feature issue (`set_parent`).
```

Personal part — in the same section if everything goes to one file, otherwise its own `## Huly` section in `CLAUDE.local.md`:

```markdown
- Initiative: <answer>.
- Efficiency: <answer>.
```

When writing `CLAUDE.local.md`:
- Check `git check-ignore -q CLAUDE.local.md`; if it is not ignored, add it to `.gitignore` (say so).
- If the repo's instructions live in `AGENTS.md` and there is no `CLAUDE.md`: warn that Claude Code stops reading `AGENTS.md` once a `CLAUDE.local.md` exists, and offer to put everything in `AGENTS.md` instead.

## 5. Import

Do the selected imports in this order: status set → components → labels → milestones → documents (architecture first) → templates → test management → TODO/FIXME proposals → open GitHub issues (report only). If a needed tool is missing, its toolset is disabled: `enable_toolsets`, or tell the user which toolsets to add (`/plugin` → huly → configure → Toolsets) and continue with the rest. Use dry runs where tools have them and show what will be created before writing.

End with a short report: which toolsets to keep enabled for this project, where the rules were written, what was created (ids), what was skipped and why, which proposals (dates, keys) to confirm, and what the user still has to do in Huly.
