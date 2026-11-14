// Profiles: several fixed Huly logins on one HTTP server, each at its own path (/<name>/mcp).
// For teams that would otherwise run one container per person, e.g. behind a Cloudflare Tunnel.
//
// In .env, one variable per field:
//   MCP_PROFILE_JORIS_EMAIL=joris@example.com
//   MCP_PROFILE_JORIS_PASSWORD=…
//   MCP_PROFILE_JORIS_AUTH_TOKEN=long-random-string        → /joris/mcp
//   MCP_PROFILE_ANNA_TOKEN=<Huly API token>
//   MCP_PROFILE_ANNA_WORKSPACE=acme / _TOOLSETS=… / _PUBLIC=true
//
// Or as JSON: MCP_PROFILES_FILE=/run/secrets/huly-profiles.json   (or MCP_PROFILES='{"…": …}')
//   {
//     "joris": { "email": "joris@example.com", "password": "…", "authToken": "long-random-string" },
//     "anna":  { "token": "<Huly API token>", "workspace": "acme", "toolsets": "tracker,documents", "authToken": "…" },
//     "ci":    { "token": "…", "public": true }      ← only behind Cloudflare Access or similar
//   }
//
// Each profile needs its own bearer token (clients send `Authorization: Bearer <authToken>`), unless
// it is explicitly "public": true — whoever reaches the path then works as that person.
import { readFileSync } from 'node:fs'
import { z } from 'zod'

export const ProfileSchema = z.strictObject({
  email: z.string().min(3).optional(),
  password: z.string().min(1).optional(),
  token: z.string().min(10).optional(),
  workspace: z.string().min(1).optional().describe('Pin one workspace'),
  toolsets: z.string().min(1).optional().describe('Like HULY_TOOLSETS'),
  authToken: z.string().min(16).optional().describe('Bearer token clients must send'),
  public: z.boolean().optional().describe('No bearer token (protect the path elsewhere)')
})
export type Profile = z.infer<typeof ProfileSchema>

const NAME = /^[a-z0-9][a-z0-9_-]{0,39}$/

// Longest suffix first: _AUTH_TOKEN before _TOKEN.
const ENV_FIELDS: Array<[string, keyof Profile]> = [
  ['AUTH_TOKEN', 'authToken'], ['PASSWORD', 'password'], ['EMAIL', 'email'], ['TOKEN', 'token'],
  ['WORKSPACE', 'workspace'], ['TOOLSETS', 'toolsets'], ['PUBLIC', 'public']
]

/** MCP_PROFILE_<NAME>_<FIELD> variables, grouped by profile name (lowercased). Empty values are ignored. */
function profilesFromVars (env: NodeJS.ProcessEnv): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {}
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith('MCP_PROFILE_') || value == null || value.trim() === '') continue
    const rest = key.slice('MCP_PROFILE_'.length)
    const field = ENV_FIELDS.find(([suffix]) => rest.endsWith(`_${suffix}`) && rest.length > suffix.length + 1)
    if (field == null) throw new Error(`${key}: unknown field — use MCP_PROFILE_<NAME>_${ENV_FIELDS.map(([s]) => s).join('|')}.`)
    const name = rest.slice(0, rest.length - field[0].length - 1).toLowerCase()
    const v = value.trim()
    if (field[1] === 'public') {
      if (!['true', '1', 'yes', 'false', '0', 'no'].includes(v.toLowerCase())) throw new Error(`${key}: use true or false.`)
      if (['false', '0', 'no'].includes(v.toLowerCase())) continue
    }
    ;(out[name] ??= {})[field[1]] = field[1] === 'public' ? true : v
  }
  return out
}

/** Profiles from MCP_PROFILE_<NAME>_<FIELD> variables plus MCP_PROFILES_FILE or MCP_PROFILES; empty when none is set. Throws with a clear message on mistakes. */
export function loadProfiles (env: NodeJS.ProcessEnv, read: (path: string) => string = (p) => readFileSync(p, 'utf8')): Map<string, Profile> {
  const file = (env.MCP_PROFILES_FILE ?? '').trim()
  const inline = (env.MCP_PROFILES ?? '').trim()
  if (file !== '' && inline !== '') throw new Error('Set MCP_PROFILES_FILE or MCP_PROFILES, not both.')
  let raw: unknown = {}
  if (file !== '' || inline !== '') {
    try { raw = JSON.parse(file !== '' ? read(file) : inline) } catch (e) {
      throw new Error(`${file !== '' ? `MCP_PROFILES_FILE (${file})` : 'MCP_PROFILES'} is not valid JSON: ${(e as Error).message}`)
    }
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Profiles must be a JSON object: { "name": { "email": …, "password": …, "authToken": … } }.')
  }
  const fromVars = profilesFromVars(env)
  for (const name of Object.keys(fromVars)) {
    if (Object.hasOwn(raw as object, name)) throw new Error(`Profile '${name}' is defined twice (MCP_PROFILE_${name.toUpperCase()}_* and the JSON) — keep one.`)
  }
  const out = new Map<string, Profile>()
  for (const [name, value] of Object.entries({ ...(raw as Record<string, unknown>), ...fromVars })) {
    if (!NAME.test(name)) throw new Error(`Profile name '${name}': use lowercase letters, digits, - and _ (it becomes the path /${name}/mcp).`)
    const parsed = ProfileSchema.safeParse(value)
    if (!parsed.success) throw new Error(`Profile '${name}': ${parsed.error.issues.map((i) => `${i.path.join('.') || 'value'} ${i.message}`).join('; ')}.`)
    const p = parsed.data
    if (p.token == null && (p.email == null || p.password == null)) throw new Error(`Profile '${name}': give "token", or "email" and "password".`)
    if (p.authToken == null && p.public !== true) throw new Error(`Profile '${name}': set "authToken" (at least 16 characters) — or "public": true if the path is protected elsewhere (e.g. Cloudflare Access).`)
    if (p.authToken != null && p.public === true) throw new Error(`Profile '${name}': "authToken" and "public": true exclude each other.`)
    out.set(name, p)
  }
  return out
}
