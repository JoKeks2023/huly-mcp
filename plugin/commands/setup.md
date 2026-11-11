---
description: Set up Huly for this repo — ask how to use it, write the rules to CLAUDE.md, optionally import the project
argument-hint: "[workspace]"
allowed-tools: Bash(git remote get-url:*), Bash(git tag:*), Bash(ls:*)
---
Set up how Huly is used in this repository. Workspace hint: `$ARGUMENTS`.

Remote: !`git remote get-url origin 2>/dev/null || echo none`

The result is a short `## Huly` section in the repo's `CLAUDE.md`, so every later session follows the same rules without asking again. Keep it short — `CLAUDE.md` is loaded into every session.

## 1. Find the project (no questions yet)

- Read `CLAUDE.md` / `AGENTS.md`. If a `## Huly` section exists, show it and ask whether to change it instead of starting over.
- `find_project_for_repo` with the remote. If nothing is linked: `list_workspaces` (ask which one if there are several), `list_projects`, and see whether one obviously fits.
- **Never create a Huly project yourself** — the user does that in Huly (the GitHub link needs OAuth there). If none fits, suggest a short key from the repo name (e.g. `SERV` for "server"), ask the user to create it, and continue after they confirm.

## 2. Ask — one AskUserQuestion call, four questions

Put the recommended option first and mark it "(Recommended)".

1. **Role of Huly here** — Huly leads, synced with GitHub (issues and PRs on both sides) · Huly leads, no GitHub sync · Overview only (read, don't change) · Not used in this repo.
2. **Where new issues go** — Code bugs/TODOs → GitHub, product/architecture → Huly (if synced) · Everything in Huly · Everything in GitHub · Only when I ask.
3. **Initiative** — Create issues for bugs found while working and keep status current without asking · Propose first, act after OK · Only on explicit request.
4. **Efficiency** — Normal · Token-saving: one-call overviews only, no re-reads, comments only when handing back · Minimal: no Huly calls unless needed for the task, status changes bundled at the end.

If the answer to 1 is "Not used", write only `## Huly\nNot used in this repository.` and stop.

## 3. Ask what to import — one AskUserQuestion call, multiSelect

Offer only what applies (see the onboarding guide of the `huly-workflow` skill for how each is done):

- Components from the repo's modules/packages (with paths in the description)
- Milestones from releases/tags (real delivery targets, not phases)
- Status set aligned to: Backlog, Todo, In Progress, Done, Canceled, Review in progress, Merged
- TODO/FIXME comments as a **proposal list** (issues only after the user picks)
- Architecture/status document as a Huly document (stack, structure, known issues)
- Open GitHub issues — **only point them out**, ask how to handle them; never import on your own

## 4. Write the rules

Show the section, write it after the user agrees. Template (fill in, drop lines that don't apply):

```markdown
## Huly

- Workspace `<slug>`, project **<KEY>** (<GitHub sync: yes/no>). Role: <answer 1>.
- New issues: <answer 2>. Before creating: duplicate check (`search_issues`).
- Every new issue: component and, if it belongs to a release, milestone. Nothing fits → say so, don't create new ones silently.
- Initiative: <answer 3>.
- Status: In Progress when work starts (`start_work`), Review in progress when the PR is open (`finish_work`), Done/Merged via sync.
- PRs: the auto-created PR issue goes under the feature issue (`set_parent`).
- Efficiency: <answer 4>. Cheapest calls: see skill `huly-efficient`.
```

## 5. Import

Do the selected imports in this order: status set → components → milestones → architecture document → TODO/FIXME proposals → open GitHub issues (report only). Use dry runs where tools have them and show what will be created before writing. End with a short report: what was created (ids), what was skipped and why, what the user still has to do in Huly.
