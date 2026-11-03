// Clients such as Claude Code plugins pass every configured variable, also the ones the user
// left empty (or as an unresolved "${…}" placeholder). Treat those as not set, so defaults apply.
export function normalizeEnv (env: NodeJS.ProcessEnv = process.env): void {
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith('HULY_') || value == null) continue
    const v = value.trim()
    if (v === '' || /^\$\{[^}]*\}$/.test(v)) delete env[key]
    else if (v !== value) env[key] = v
  }
}
