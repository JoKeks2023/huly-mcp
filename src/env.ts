// Clients such as Claude Code plugins pass every configured variable, also the ones the user
// left empty (or as an unresolved "${…}" placeholder). Treat those as not set, so defaults apply.
//
// The Claude plugin directory only accepts plugin options under their own names
// (CLAUDE_PLUGIN_OPTION_<KEY>, e.g. CLAUDE_PLUGIN_OPTION_HULY_EMAIL for the option huly_email),
// so those are read as the matching HULY_* setting. An explicit HULY_* value wins.
// Started as a plugin, tool annotations are on unless HULY_ANNOTATIONS says otherwise.
const OPTION = 'CLAUDE_PLUGIN_OPTION_'

const unset = (v: string | undefined): boolean => v == null || v.trim() === '' || /^\$\{[^}]*\}$/.test(v.trim())

export function normalizeEnv (env: NodeJS.ProcessEnv = process.env): void {
  let plugin = false
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith(`${OPTION}HULY_`)) continue
    plugin = true
    const target = key.slice(OPTION.length)
    if (!unset(value) && unset(env[target])) env[target] = value
  }
  if (plugin && unset(env.HULY_ANNOTATIONS)) env.HULY_ANNOTATIONS = '1'
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith('HULY_') || value == null) continue
    const v = value.trim()
    if (unset(v)) delete env[key]
    else if (v !== value) env[key] = v
  }
}
