# All of Huly for a software project

How to put a project **completely** into Huly — not just issues. For each feature: what it is for in a repo, the tools, and when to propose it. Propose, then write; check what exists first (`list_*`); never create projects yourself.

## Toolsets: load what the project uses

Many features below are **not in the default toolset**. A tool that is missing is in a disabled toolset:

- **On-demand server** (`HULY_DYNAMIC_TOOLSETS=1`): call `enable_toolsets` with the names, e.g. `["testing", "templates"]`.
- **Otherwise**: tell the user which toolsets to add to `HULY_TOOLSETS` (Claude Code plugin: `/plugin` → huly → configure → Toolsets), e.g. `agent,tracker,documents,chat,inbox,planner,testing,templates,tracker-admin`. Takes effect after reconnecting the server (`/mcp`).

Default: `agent, tracker, documents, chat, contacts, inbox, activity, planner, generic`. Extra: `tracker-admin` (label categories, statuses, project settings), `templates`, `testing`, `qms` (trainings, controlled documents), `admin` (modules, workspace settings, profile, new workspaces, `huly_api`), `github`, `drive`, `calendar`, `collaboration` (doc comments, sharing), `fields` (custom fields), `cards`, `products`.

## Map: what goes where

| In the repo / team | In Huly | Tools (toolset) | Propose when |
|---|---|---|---|
| Modules, packages, targets | **Components** — description names the paths | `create_component`, `update_component` (tracker) | onboarding; a new top-level folder appears |
| Releases, tags, deadlines | **Milestones** with target date and status | `create_milestone`, `update_milestone`, `release_notes` (tracker, agent) | onboarding; a tag is pushed → set it Completed, create the next |
| Phases, features, big refactors | **Epics** = issue + sub-issues, order via blocked-by | `create_issue_tree`, `set_parent`, `add_blocked_by` (agent, tracker) | a plan has more than ~3 steps |
| Kind of work (bug, feature, tech debt, docs) | **Labels**, grouped in label **categories** | `create_label`, `add_label`, `create_label_category`, `set_label_category` (tracker, tracker-admin) | onboarding, when the team distinguishes work types; filter with `list_issues labelName` |
| Workflow | **Status set**, per project type | `list_issue_statuses` (tracker), `create_issue_status` (tracker-admin) | onboarding |
| Recurring work: release checklist, bug report, onboarding a dev | **Issue templates** with sub-issues | `create_issue_template`, `create_issue_from_template` (templates) | the same checklist is typed a second time |
| Onboarding and knowledge checks (how we release, security basics) | **Trainings**: draft `TR-n` with scored questions → release → assign to people with due date; results per person | `create_training` (questions inline), `release_training`, `assign_training`, `get_training` (qms) | new team members, compliance, a runbook people must know |
| Tests (unit, e2e, manual QA) | **Test management**: test project → suites (mirror test folders) → cases → plans → runs | `create_test_project`, `create_test_suite`, `create_test_cases`, `create_test_plan`, `create_test_run`, `set_test_result` (testing) | the repo has tests or a QA checklist |
| CI test results | **Test runs from JUnit XML**; flaky/failing report; bugs from failures | `import_test_results`, CLI `npx huly-mcp-selfhost junit <xml> --project <name>` in CI, `get_test_report`, `create_issue_from_test_result`, `test_coverage`, `link_test_case`, `release_check` (testing) | CI writes JUnit XML (Jest/Vitest reporter, `pytest --junitxml`, Gradle, Maven, go-junit-report) |
| README depth: architecture, ADRs, runbooks, specs | **Documents** in a project teamspace, nested; linked to issues | `create_teamspace`, `create_document` (`parentId` for nesting), `update_document`, `link_document` (documents) | onboarding: one teamspace per project with "Architecture", "Decisions", "Runbooks"; a spec → `issues_from_document` |
| Design reviews, comments on docs | **Document comments**, collaborators, public links | `add_document_comment`, `add_collaborator`, `create_public_link` (collaboration) | a document needs review or must be shared outside |
| Meeting notes | Document → issues with assignee and date | `issues_from_meeting` (agent) | notes have action items |
| Team chat about the project | **Channel** per project; threads per topic | `create_channel`, `send_message`, `reply_to_message` (chat) | onboarding, if the team chats in Huly |
| Pull requests | **GitHub integration** (sync is set up by the user in Huly) | `list_pull_requests`, `get_pull_request` (github) | project is GitHub-synced; review status in reports |
| Effort | **Time reports** per issue | `log_time`, `list_time_reports` (tracker) | the team tracks time (ask once) |
| Personal planning | **To-dos and time blocks** in the planner | `create_todo` (with `issue`), `schedule_todo` (planner) | the user plans their day in Huly |
| Release dates, demos, freezes | **Calendar events** | `create_event` (calendar) | a milestone has a fixed event |
| Binaries, designs, exports, recordings | **Drive** folders and versioned files | `create_drive`, `create_folder`, `upload_file` (drive) | assets live outside git |
| Extra issue data (customer, risk, platform) | **Custom fields** on issues or a project type | `create_custom_field`, `set_custom_fields` (fields) | the team keeps such data in titles or labels today |
| Records that are not tasks (ADR register, customers, devices) | **Cards** with card types | `list_card_types`, `create_card` (cards) | a list of things, not of work |
| Shipped products and versions | **Products** (read) | `list_products`, `get_product` (products) | only to read existing product data |
| The workspace itself: which apps, name, guest access, your profile; a new workspace from a template | **Administration** (Settings) | `list_modules`, `set_module`, `update_workspace_settings`, `update_my_profile`, `create_workspace`, `setup_workspace` (dry run first), `huly_api` for other account-service calls (admin) | setting a workspace up; a module the project needs is off (e.g. training, hr) |
| Anything without a tool | Any Huly class | `list_classes`, `describe_class`, `query_documents` (generic); writes: `generic_*` with dry run (generic-write) | last resort — specific tools are cheaper |

## Order for a full setup

1. Status set → components → labels (+ categories) → milestones.
2. Teamspace + documents (architecture first) → link them to epics.
3. Existing work: epics/issues, assign components and milestones.
4. Templates for checklists that repeat (release, bug report).
5. Test project mirroring the test folders; CI JUnit import (give the user the CI step, don't edit CI without OK).
6. Channel, drive, custom fields, cards — only if the team works that way.

Report at the end: what exists now, what was skipped, which toolsets the user should keep enabled.
