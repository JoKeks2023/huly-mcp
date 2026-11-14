---
description: Go through unread Huly notifications and suggest actions
argument-hint: "[workspace]"
---
Triage my Huly inbox (workspace: `$ARGUMENTS`, ask if empty and there are several).

Call `triage_inbox` once — it returns each unread item with what changed since I last read it. Group by urgency and suggest one action per item (reply, start work, delegate, mark read). Change nothing until I pick; `mark_notifications_read` only for the items I choose.
