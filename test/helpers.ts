// In-memory fakes for the Huly account service and workspace connections.
// Nothing here talks to a real Huly server.

import { WorkspaceConnectionManager, type ConnectionManagerOptions } from '../src/connection'

export interface FakeWorkspace {
  uuid: string
  url: string
  name: string
}

export interface FakeDoc { _id: string, _class: string, space?: string, [key: string]: unknown }

export interface Mutation { op: string, _class: string, space?: string, attachedTo?: string, data?: unknown }

/** Minimal stand-in for TxOperations: equality queries over an in-memory doc list. */
export class FakeTxClient {
  readonly mutations: Mutation[] = []
  closed = false
  constructor (readonly label: string, readonly docs: FakeDoc[], readonly user = 'social-id') {}

  private matches (doc: FakeDoc, _class: string, query: Record<string, unknown>): boolean {
    if (doc._class !== _class) return false
    return Object.entries(query).every(([k, v]) => doc[k] === v)
  }

  async findAll (_class: string, query: Record<string, unknown> = {}): Promise<FakeDoc[]> {
    return this.docs.filter((d) => this.matches(d, _class, query))
  }

  async findOne (_class: string, query: Record<string, unknown> = {}): Promise<FakeDoc | undefined> {
    return this.docs.find((d) => this.matches(d, _class, query))
  }

  async createDoc (_class: string, space: string, data: unknown, id?: string): Promise<string> {
    this.mutations.push({ op: 'createDoc', _class, space, data })
    return id ?? 'new-id'
  }

  async addCollection (_class: string, space: string, attachedTo: string, _attachedToClass: string, _coll: string, data: unknown): Promise<string> {
    this.mutations.push({ op: 'addCollection', _class, space, attachedTo, data })
    return 'new-id'
  }

  async updateDoc (_class: string, space: string, id: string, data: unknown): Promise<void> {
    this.mutations.push({ op: 'updateDoc', _class, space, attachedTo: id, data })
  }
}

export interface FakeAccountCalls {
  login: number
  getUserWorkspaces: number
  getLoginInfoByToken: number
  selectWorkspace: Array<{ slug: string, token?: string }>
  getUserWorkspacesTokens: Array<string | undefined>
  getWorkspaceMembersTokens: Array<string | undefined>
  opened: Array<{ endpoint: string, token: string, socialId: string }>
}

export interface FakeEnvOptions {
  workspaces: FakeWorkspace[]
  /** Workspace slug → docs visible in that workspace. */
  data?: Record<string, FakeDoc[]>
  token?: string
  /** What getLoginInfoByToken() returns for HULY_TOKEN. */
  tokenInfo?: unknown
  getUserWorkspacesFails?: boolean
  restrictTo?: string
  /** openConnection waits for this before resolving (to test in-flight behavior). */
  openGate?: Promise<void>
}

export function createFakeEnv (opts: FakeEnvOptions): {
  manager: WorkspaceConnectionManager
  calls: FakeAccountCalls
  clients: Map<string, FakeTxClient>
  workspaces: FakeWorkspace[]
} {
  const calls: FakeAccountCalls = {
    login: 0,
    getUserWorkspaces: 0,
    getLoginInfoByToken: 0,
    selectWorkspace: [],
    getUserWorkspacesTokens: [],
    getWorkspaceMembersTokens: [],
    opened: []
  }
  const clients = new Map<string, FakeTxClient>()
  const workspaces = opts.workspaces

  const createAccountClient: ConnectionManagerOptions['createAccountClient'] = (_url, token) => ({
    login: async (email: string, password: string) => {
      calls.login++
      if (email !== 'me@example.com' || password !== 'pw') throw new Error('Invalid credentials')
      return { account: 'account-1', token: 'account-token', socialId: 'social-id' }
    },
    getLoginInfoByToken: async () => {
      calls.getLoginInfoByToken++
      return opts.tokenInfo
    },
    getUserWorkspaces: async () => {
      calls.getUserWorkspaces++
      calls.getUserWorkspacesTokens.push(token)
      if (opts.getUserWorkspacesFails === true) throw new Error('Forbidden')
      return workspaces.map((w) => ({ ...w, mode: 'active', versionMajor: 0, versionMinor: 7, versionPatch: 0, createdOn: 0, processingAttemps: 0 }))
    },
    selectWorkspace: async (slug: string) => {
      calls.selectWorkspace.push({ slug, token })
      const ws = workspaces.find((w) => w.url === slug)
      if (ws === undefined) throw new Error(`Workspace not found: ${slug}`)
      return { account: 'account-1', socialId: 'social-id', workspace: ws.uuid, workspaceUrl: ws.url, endpoint: `ws://huly/${ws.url}`, token: `ws-token-${ws.url}`, role: 'USER' }
    },
    getWorkspaceMembers: async () => {
      calls.getWorkspaceMembersTokens.push(token)
      return [{ person: `member-via-${token ?? 'none'}`, role: 'USER' }]
    }
  }) as any

  const openConnection: ConnectionManagerOptions['openConnection'] = async (endpoint, token, socialId) => {
    calls.opened.push({ endpoint, token, socialId })
    if (opts.openGate !== undefined) await opts.openGate
    const slug = endpoint.split('/').pop() ?? endpoint
    const client = new FakeTxClient(slug, opts.data?.[slug] ?? [], socialId)
    clients.set(slug, client)
    return { client: client as any, close: async () => { client.closed = true } }
  }

  const manager = new WorkspaceConnectionManager({
    accountsUrl: 'https://account.example',
    email: opts.token === undefined ? 'me@example.com' : undefined,
    password: opts.token === undefined ? 'pw' : undefined,
    token: opts.token,
    restrictTo: opts.restrictTo,
    createAccountClient,
    openConnection
  })

  return { manager, calls, clients, workspaces }
}

export const PERSONAL: FakeWorkspace = { uuid: '11111111-aaaa-4000-8000-000000000001', url: 'jokeks2023', name: 'JoKeks2023' }
export const AVMS: FakeWorkspace = { uuid: '22222222-bbbb-4000-8000-000000000002', url: 'avms', name: 'AVMS' }
