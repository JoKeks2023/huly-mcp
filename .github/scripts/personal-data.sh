#!/usr/bin/env bash
# Check for personal data in tracked files (the maintainer's rule before every public release):
# home paths, e-mail addresses, private IPs — plus private terms from the PERSONAL_DATA_PATTERNS
# secret (one regex per line), which must not be written into this public repo.
# Secrets and tokens are gitleaks' job (separate step).
set -uo pipefail
files=$(git ls-files | grep -vE '^package-lock\.json$|^\.github/scripts/personal-data\.sh$')
generic='/Users/[A-Za-z0-9._-]+|/home/[a-z][a-z0-9_-]*/|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\b(192\.168|10\.[0-9]{1,3}|172\.(1[6-9]|2[0-9]|3[01]))\.[0-9]{1,3}\.[0-9]{1,3}\b'
# Known harmless: placeholders, git remotes, attribution addresses.
allow='/home/me/|/home/build/|/Users/<name>|your@email\.com|you@example\.com|@example\.(com|org)|git@github\.com|noreply@anthropic\.com|users\.noreply\.github\.com'
hits=$(echo "$files" | xargs grep -nIE "$generic" 2>/dev/null | grep -vE "$allow" || true)
if [ -n "${PERSONAL_DATA_PATTERNS:-}" ]; then
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    # Report file:line only, never the matched private term itself.
    more=$(echo "$files" | xargs grep -nIiE -- "$p" 2>/dev/null | cut -d: -f1,2 | sed 's/$/: (private pattern)/' || true)
    [ -n "$more" ] && hits="$hits"$'\n'"$more"
  done <<< "$PERSONAL_DATA_PATTERNS"
else
  echo "::notice::PERSONAL_DATA_PATTERNS is not set (e.g. in forks) — only generic patterns were checked."
fi
hits=$(echo "$hits" | sed '/^$/d')
if [ -n "$hits" ]; then
  echo "::error::Possible personal data in tracked files:"
  echo "$hits" | cut -c1-200
  exit 1
fi
echo "No personal data found."
