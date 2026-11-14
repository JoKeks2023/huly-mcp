# Bringing a project into Huly

How to set up or import a repository's project in Huly. `/huly:setup` asks the user which of these steps to do; never do more than was chosen.

## Ground rules

- **Projects are created by the user**, in Huly (the GitHub link needs OAuth there). You suggest the key: short, from the repo or app name (`SERV` for a server, `PLAY` for a player app).
- **Propose, then write.** Show what you will create (names, descriptions, dates) and write after the user agrees.
- **Check before creating:** `list_components`, `list_milestones`, `search_issues` — reuse what exists.
- Synced projects (GitHub ↔ Huly) show every change on both sides. An issue created in Huly also appears on GitHub; don't create it twice.

## Status set

Align to: Backlog, Todo, In Progress, Done, Canceled, Review in progress, Merged. Statuses are allowed **per project type and task type**: GitHub sync often creates "Review in progress" and "Merged" for pull requests only, so issues cannot use them yet. `create_issue_status` with `projectIdentifier` adds a missing status to the project's issue workflow (and reuses an existing one of that name) — it changes the project type, so every project of that type gets it: say so before. Don't delete or rename existing statuses without asking.

## Components = areas of the code

- One per module/package/target, plus usually one for build & release (CI, signing, store/distribution) and `Product` for decisions without a code location.
- The description names the paths: `Sources/Player/, Tests/PlayerTests/`.
- Find them from the repo layout (`ls`, package manifests, workspace files), not from guesses.

## Milestones = releases or real delivery targets

- E.g. `v1.0 MVP`, `v0.1 TestFlight internal`, version ranges — **not** phases like `M0`/`M1`.
- Existing tags/releases (`git tag`) show the naming. Give each a target date; if no real date is known, propose one and **tell the user it is a proposal**.
- Phases and larger work packages are **epics** (issue + sub-issues via `create_issue_tree` or `set_parent`), not milestones.

## Existing issues

- After components and milestones exist, assign open issues to them (`bulk_update_issues` per component/milestone, after showing the mapping).
- Open GitHub issues of a freshly linked repo: **don't touch or import them**. Report how many there are and ask how to handle them.

## TODO/FIXME scan

- `grep -rn -E "TODO|FIXME"` over the source (skip vendored/generated code).
- Present a **proposal list** (file:line, text, suggested title, component). Create issues only for the items the user picks — in GitHub or Huly according to the repo's "where new issues go" rule. Duplicate check first.

## Architecture/status document

One Huly document as the entry point (`create_document` + `update_document` with Markdown), in the project's teamspace (ask which one, or suggest creating one named after the project):

- What it is (2–3 sentences)
- Stack and structure (modules ↔ components)
- How to build, test, release
- Known issues / open construction sites
- Links: repo, CI, deployments

Keep it factual and short; it is read by people and agents alike.

## Beyond the basics

Labels, issue templates, test management (incl. CI JUnit import), document structure, channel, drive, custom fields, cards: see [features.md](features.md) — what each is for, the tools, and which toolsets must be enabled.

## Report

End with: what was created (ids/names), what was skipped and why, which proposals (dates, keys) the user should confirm, and what they still have to do in Huly (e.g. create the project, link GitHub).
