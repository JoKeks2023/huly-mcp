import { getClient as getRawAccountClient, type AccountClient } from '@hcengineering/account-client'
import { type Client, TxOperations, type PersonId, type WorkspaceInfoWithStatus } from '@hcengineering/core'
import { createClient } from '@hcengineering/server-client'

// Multi-workspace connection model
//
//   HULY_EMAIL + HULY_PASSWORD (or HULY_TOKEN)
//     → one account-level login (account token + socialId)
//     → getUserWorkspaces()           — discovery, account-level client
//     → selectWorkspace(slug)         — per workspace, on first use
//     → one cached WebSocket connection per workspace
//
// There is deliberately no "current workspace": every call names the
// workspace it wants. Omitting it only works when exactly one workspace is
// available (see resolveWorkspace), and mutating tools never omit it (their
// schemas require it).

export interface WorkspaceRef {
  uuid: string
  /** Workspace slug, as in huly.app/<slug>. Passed to selectWorkspace(). */
  url: string
  name: string
  mode?: string
  isDisabled?: boolean
}

export interface WorkspaceConnection {
  workspace: WorkspaceRef
  client: TxOperations
  /** Workspace-scoped account client (token carries the workspace) — e.g. getWorkspaceMembers(). */
  accountClient: AccountClient
  wsToken: string
  workspaceUuid: string
}

interface AccountSession {
  /** Account-level client — getUserWorkspaces() / selectWorkspace(). */
  accountClient: AccountClient
  socialId: PersonId
  /** Set when HULY_TOKEN is already workspace-scoped: that workspace needs no selectWorkspace(). */
  preselected?: { workspace: WorkspaceRef, endpoint: string, token: string }
}

interface OpenConnection {
  client: TxOperations
  close: () => Promise<void>
}

export interface ConnectionManagerOptions {
  accountsUrl: string
  email?: string
  password?: string
  token?: string
  /** Legacy HULY_WORKSPACE: restricts this server to that single workspace. */
  restrictTo?: string
  createAccountClient?: (accountsUrl: string, token?: string) => AccountClient
  openConnection?: (endpoint: string, token: string, socialId: PersonId) => Promise<OpenConnection>
}

async function defaultOpenConnection (endpoint: string, token: string, socialId: PersonId): Promise<OpenConnection> {
  const raw: Client = await createClient(endpoint, token)
  return { client: new TxOperations(raw, socialId), close: async () => await raw.close() }
}

function toRef (ws: WorkspaceInfoWithStatus): WorkspaceRef {
  return {
    uuid: String(ws.uuid),
    url: ws.url,
    name: ws.name ?? ws.url,
    mode: ws.mode != null ? String(ws.mode) : undefined,
    isDisabled: ws.isDisabled
  }
}

function describe (ws: WorkspaceRef): string {
  return ws.name !== ws.url ? `${ws.url} (${ws.name})` : ws.url
}

export class WorkspaceConnectionManager {
  private readonly createAccountClient: (accountsUrl: string, token?: string) => AccountClient
  private readonly openConnection: (endpoint: string, token: string, socialId: PersonId) => Promise<OpenConnection>
  private session: Promise<AccountSession> | null = null
  private workspaces: Promise<WorkspaceRef[]> | null = null
  // Bumped by closeAll() so calls that were in flight don't hand out or register connections afterwards.
  private generation = 0
  // Keyed by workspace UUID — never by user input, so "avms" and its UUID share one connection.
  private readonly connections = new Map<string, Promise<WorkspaceConnection & { close: () => Promise<void> }>>()

  constructor (private readonly opts: ConnectionManagerOptions) {
    this.createAccountClient = opts.createAccountClient ?? ((url, token) => getRawAccountClient(url, token))
    this.openConnection = opts.openConnection ?? defaultOpenConnection
  }

  /** All workspaces this account can use (after the optional legacy HULY_WORKSPACE restriction). */
  async listWorkspaces (): Promise<WorkspaceRef[]> {
    if (this.workspaces === null) {
      const pending = this.discover()
      this.workspaces = pending
      pending.catch(() => { if (this.workspaces === pending) this.workspaces = null })
    }
    return await this.workspaces
  }

  /**
   * Resolve user input (slug, name or UUID; case-insensitive) to a workspace.
   * Without input, succeeds only if exactly one workspace is available.
   */
  async resolveWorkspace (input?: string): Promise<WorkspaceRef> {
    let available = await this.listWorkspaces()

    if (input != null && input.trim() === '') {
      // Blank is not "omitted" — never let it fall through to a default workspace.
      throw new Error('Workspace must not be empty (see list_workspaces).')
    }
    if (input == null) {
      if (available.length === 1) return available[0]
      if (available.length === 0) throw new Error('No Huly workspaces are accessible with these credentials.')
      throw new Error(
        `Multiple workspaces available — pass 'workspace' explicitly (see list_workspaces). Available: ${available.map(describe).join(', ')}`
      )
    }

    let match = this.match(available, input)
    if (match === undefined) {
      // The account may have joined a workspace since discovery — refresh once.
      this.workspaces = null
      available = await this.listWorkspaces()
      match = this.match(available, input)
    }
    if (match === undefined) {
      throw new Error(`Unknown workspace '${input}'. Available: ${available.map(describe).join(', ') || '(none)'}`)
    }
    return match
  }

  /** Cached connection for the given workspace (see resolveWorkspace for the input rules). */
  async getWorkspace (input?: string): Promise<WorkspaceConnection> {
    const generation = this.generation
    const ws = await this.resolveWorkspace(input)
    if (generation !== this.generation) throw new Error('Huly connections were closed.')
    let pending = this.connections.get(ws.uuid)
    if (pending === undefined) {
      pending = this.connect(ws)
      this.connections.set(ws.uuid, pending)
      const current = pending
      current.catch(() => { if (this.connections.get(ws.uuid) === current) this.connections.delete(ws.uuid) })
    }
    const { close, ...conn } = await pending
    if (generation !== this.generation) throw new Error('Huly connections were closed.')
    return conn
  }

  async closeAll (): Promise<void> {
    this.generation++
    const pending = [...this.connections.values()]
    this.connections.clear()
    this.workspaces = null
    this.session = null
    const results = await Promise.allSettled(pending)
    await Promise.allSettled(results.map(async (r) => { if (r.status === 'fulfilled') await r.value.close() }))
  }

  private match (available: WorkspaceRef[], input: string): WorkspaceRef | undefined {
    const needle = input.trim().toLowerCase()
    const byId = available.find((w) => w.uuid.toLowerCase() === needle || w.url.toLowerCase() === needle)
    if (byId !== undefined) return byId
    const byName = available.filter((w) => w.name.toLowerCase() === needle)
    if (byName.length > 1) {
      throw new Error(`Workspace name '${input}' is ambiguous — use the slug or ID instead: ${byName.map((w) => `${w.url} / ${w.uuid}`).join(', ')}`)
    }
    return byName[0]
  }

  private async getSession (): Promise<AccountSession> {
    if (this.session === null) {
      const pending = this.login()
      this.session = pending
      pending.catch(() => { if (this.session === pending) this.session = null })
    }
    return await this.session
  }

  private async login (): Promise<AccountSession> {
    const { accountsUrl, email, password, token } = this.opts

    if (token != null && token !== '') {
      // Token auth — for SSO accounts (Google/GitHub login on huly.app).
      const accountClient = this.createAccountClient(accountsUrl, token)
      const info = await accountClient.getLoginInfoByToken()
      if (info == null) {
        throw new Error('HULY_TOKEN is invalid or expired. Please get a fresh token (npm run setup).')
      }
      if (!('socialId' in info) || info.socialId == null) {
        throw new Error('Token auth: no socialId returned for HULY_TOKEN.')
      }
      const session: AccountSession = { accountClient, socialId: info.socialId }
      if ('endpoint' in info && info.endpoint != null && info.token != null) {
        // Workspace-scoped token: its own workspace is usable directly.
        session.preselected = {
          workspace: { uuid: String(info.workspace), url: info.workspaceUrl, name: info.workspaceUrl },
          endpoint: info.endpoint,
          token: info.token
        }
      }
      return session
    }

    if (email == null || email === '' || password == null || password === '') {
      throw new Error('Missing credentials. Provide HULY_TOKEN (for SSO accounts) or both HULY_EMAIL and HULY_PASSWORD.')
    }
    const loginInfo = await this.createAccountClient(accountsUrl).login(email, password)
    if (loginInfo.token == null) throw new Error('Login failed: no token returned. Check credentials.')
    if (loginInfo.socialId == null) throw new Error('Login failed: no socialId returned.')
    return { accountClient: this.createAccountClient(accountsUrl, loginInfo.token), socialId: loginInfo.socialId }
  }

  private async discover (): Promise<WorkspaceRef[]> {
    const session = await this.getSession()
    let all: WorkspaceRef[]
    try {
      all = (await session.accountClient.getUserWorkspaces()).map(toRef)
    } catch (err) {
      // A workspace-scoped HULY_TOKEN may not be allowed to enumerate — fall back to its own workspace.
      if (session.preselected === undefined) throw err
      all = [session.preselected.workspace]
    }

    const restrictTo = this.opts.restrictTo
    if (restrictTo == null || restrictTo === '') return all
    const pinned = this.match(all, restrictTo)
    if (pinned === undefined) {
      throw new Error(`HULY_WORKSPACE='${restrictTo}' is not accessible. Available: ${all.map(describe).join(', ') || '(none)'}`)
    }
    return [pinned]
  }

  private async connect (ws: WorkspaceRef): Promise<WorkspaceConnection & { close: () => Promise<void> }> {
    const session = await this.getSession()

    let endpoint: string
    let wsToken: string
    let workspaceUuid: string
    if (session.preselected !== undefined && session.preselected.workspace.uuid === ws.uuid) {
      ({ endpoint, token: wsToken } = session.preselected)
      workspaceUuid = ws.uuid
    } else {
      const wsInfo = await session.accountClient.selectWorkspace(ws.url, 'external')
      if (wsInfo?.endpoint == null || wsInfo.token == null) {
        throw new Error(`Workspace '${ws.url}' not found or not accessible.`)
      }
      if (wsInfo.workspace != null && String(wsInfo.workspace) !== ws.uuid) {
        throw new Error(`selectWorkspace('${ws.url}') returned workspace ${String(wsInfo.workspace)}, expected ${ws.uuid}.`)
      }
      endpoint = wsInfo.endpoint
      wsToken = wsInfo.token
      workspaceUuid = String(wsInfo.workspace ?? ws.uuid)
    }

    const { client, close } = await this.openConnection(endpoint, wsToken, session.socialId)
    return {
      workspace: ws,
      client,
      accountClient: this.createAccountClient(this.opts.accountsUrl, wsToken),
      wsToken,
      workspaceUuid,
      close
    }
  }
}

// ── Process-wide manager (configured from env) ──────────────────────────────

let manager: WorkspaceConnectionManager | null = null

export function getConnectionManager (): WorkspaceConnectionManager {
  if (manager === null) {
    manager = new WorkspaceConnectionManager({
      accountsUrl: process.env.HULY_ACCOUNTS_URL ?? 'https://account.huly.app',
      email: process.env.HULY_EMAIL,
      password: process.env.HULY_PASSWORD,
      token: process.env.HULY_TOKEN,
      restrictTo: process.env.HULY_WORKSPACE
    })
  }
  return manager
}

/** Replace the process-wide manager (tests). */
export function setConnectionManager (next: WorkspaceConnectionManager | null): void {
  manager = next
}

export async function listWorkspaces (): Promise<WorkspaceRef[]> {
  return await getConnectionManager().listWorkspaces()
}

export async function getWorkspace (workspace?: string): Promise<WorkspaceConnection> {
  return await getConnectionManager().getWorkspace(workspace)
}

export async function getConnection (workspace?: string): Promise<TxOperations> {
  return (await getWorkspace(workspace)).client
}

export async function getAccountClient (workspace?: string): Promise<AccountClient> {
  return (await getWorkspace(workspace)).accountClient
}

export async function getWorkspaceInfo (workspace?: string): Promise<{ wsToken: string, workspaceUuid: string }> {
  const { wsToken, workspaceUuid } = await getWorkspace(workspace)
  return { wsToken, workspaceUuid }
}

export async function closeConnection (): Promise<void> {
  if (manager !== null) await manager.closeAll()
}
