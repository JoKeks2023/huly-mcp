#!/usr/bin/env bash
# Opens an issue with this title, or comments on the open one (so scheduled runs never pile up issues).
# Usage: report-issue.sh "<title>" <body-file> [label]
set -euo pipefail
title="$1"; body="$2"; label="${3:-}"
run="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"
printf '\n\n[Workflow run](%s)\n' "$run" >> "$body"
existing=$(gh issue list --state open --search "\"$title\" in:title" --json number,title --jq ".[] | select(.title == \"$title\") | .number" | head -1)
if [ -n "$existing" ]; then
  gh issue comment "$existing" --body-file "$body"
  echo "Commented on #$existing"
else
  if [ -n "$label" ]; then gh issue create --title "$title" --body-file "$body" --label "$label" || gh issue create --title "$title" --body-file "$body"
  else gh issue create --title "$title" --body-file "$body"; fi
fi
