// Profiles: several fixed Huly logins on one HTTP server, each at its own path (/<name>/mcp).
// For teams that would otherwise run one container per person, e.g. behind a Cloudflare Tunnel.
//
//   MCP_PROFILES_FILE=/run/secrets/huly-profiles.json   (or MCP_PROFILES='{"…": …}')
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

/** Profiles from MCP_PROFILES_FILE or MCP_PROFILES; empty when neither is set. Throws with a clear message on mistakes. */
export function loadProfiles (env: NodeJS.ProcessEnv, read: (path: string) => string = (p) => readFileSync(p, 'utf8')): Map<string, Profile> {
  const file = (env.MCP_PROFILES_FILE ?? '').trim()
  const inline = (env.MCP_PROFILES ?? '').trim()
  if (file === '' && inline === '') return new Map()
  if (file !== '' && inline !== '') throw new Error('Set MCP_PROFILES_FILE or MCP_PROFILES, not both.')
  let raw: unknown
  try { raw = JSON.parse(file !== '' ? read(file) : inline) } catch (e) {
    throw new Error(`${file !== '' ? `MCP_PROFILES_FILE (${file})` : 'MCP_PROFILES'} is not valid JSON: ${(e as Error).message}`)
  }
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Profiles must be a JSON object: { "name": { "email": …, "password": …, "authToken": … } }.')
  const out = new Map<string, Profile>()
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
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
