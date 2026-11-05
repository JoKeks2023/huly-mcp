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
    // Like the real server: a query on a base class also returns documents of derived classes.
    if (doc._class !== _class && !this.getHierarchy().isDerived(doc._class, _class)) return false
    return Object.entries(query).every(([k, v]) => {
      const actual = doc[k] ?? null
      if (v != null && typeof v === 'object' && !Array.isArray(v)) {
        const ops = v as Record<string, any>
        if ('$in' in ops && !ops.$in.includes(actual)) return false
        if ('$lte' in ops && !(actual != null && actual <= ops.$lte)) return false
        if ('$gte' in ops && !(actual != null && actual >= ops.$gte)) return false
        if ('$ne' in ops && actual === ops.$ne) return false
        return true
      }
      return actual === v
    })
  }

  /** Collections per class, used by move_issue via getHierarchy(). */
  collections: Record<string, Array<{ name: string, of: string }>> = {}

  /** Model classes for tools that inspect the hierarchy (generic tools). */
  classes: Record<string, { extends?: string, domain?: string, kind?: number, attrs?: Record<string, string>, label?: string, [k: string]: unknown }> = {}

  /** Custom attributes (core:class:Attribute docs) per class/mixin, returned by getAllAttributes. */
  customAttrs: Record<string, any[]> = {}

  getHierarchy (): any {
    const isDerived = (a: string, b: string): boolean => {
      let cur: string | undefined = a
      while (cur != null) { if (cur === b) return true; cur = this.classes[cur]?.extends }
      return false
    }
    return {
      getAllAttributes: (_class: string) => {
        const m = new Map<string, any>((this.collections[_class] ?? []).map((c) => [c.name, { name: c.name, type: { _class: 'core:class:Collection', of: c.of } }]))
        let cur: string | undefined = _class
        while (cur != null) {
          for (const [k, t] of Object.entries(this.classes[cur]?.attrs ?? {})) if (!m.has(k)) m.set(k, { name: k, type: { _class: t } })
          for (const a of this.customAttrs[cur] ?? []) if (!m.has(a.name)) m.set(a.name, a)
          cur = this.classes[cur]?.extends
        }
        return m
      },
      isDerived,
      getClass: (id: string) => { const c = this.classes[id]; if (c == null) throw new Error('not found'); return { ...c, _id: id, kind: c.kind ?? 0, extends: c.extends } },
      isMixin: (id: string) => this.classes[id]?.kind === 2,
      findDomain: (id: string) => { let cur: string | undefined = id; while (cur != null) { if (this.classes[cur]?.domain != null) return this.classes[cur].domain; cur = this.classes[cur]?.extends } return undefined },
      getDescendants: (id: string) => Object.keys(this.classes).filter((c) => isDerived(c, id)),
      hasMixin: (doc: any, mixin: string) => doc[mixin] != null
    }
  }

  async findAll (_class: string, query: Record<string, unknown> = {}, options: { limit?: number, total?: boolean } = {}): Promise<any> {
    const all = this.docs.filter((d) => this.matches(d, _class, query))
    const result: any = options.limit != null ? all.slice(0, options.limit) : all
    result.total = all.length
    return result
  }

  async findOne (_class: string, query: Record<string, unknown> = {}): Promise<FakeDoc | undefined> {
    return this.docs.find((d) => this.matches(d, _class, query))
  }

  async createDoc (_class: string, space: string, data: unknown, id?: string): Promise<string> {
    this.mutations.push({ op: 'createDoc', _class, space, data })
    return id ?? 'new-id'
  }

  async addCollection (_class: string, space: string, attachedTo: string, _attachedToClass: string, _coll: string, data: unknown, id?: string): Promise<string> {
    this.mutations.push({ op: 'addCollection', _class, space, attachedTo, data })
    // Store new issues so follow-up steps (set_parent, links) can find them, as on a real server.
    if (id != null && _class === 'tracker:class:Issue') this.docs.push({ ...(data as object), _id: id, _class, space, attachedTo } as any)
    return id ?? 'new-id'
  }

  async updateDoc (_class: string, space: string, id: string, data: unknown, retrieve?: boolean): Promise<unknown> {
    this.mutations.push({ op: 'updateDoc', _class, space, attachedTo: id, data })
    // Emulate $inc with retrieve (used for project sequence numbers).
    const inc = (data as any)?.$inc
    if (retrieve === true && inc != null) {
      const doc = this.docs.find((d) => d._id === id)
      if (doc != null) for (const [k, v] of Object.entries(inc)) doc[k] = (doc[k] as number) + (v as number)
      return { object: doc }
    }
    return undefined
  }

  async update (doc: FakeDoc, data: unknown): Promise<void> {
    this.mutations.push({ op: 'update', _class: doc._class, space: doc.space, attachedTo: doc._id, data })
  }

  async updateCollection (_class: string, space: string, id: string, _attachedTo: string, _attachedToClass: string, _coll: string, data: unknown): Promise<void> {
    this.mutations.push({ op: 'updateCollection', _class, space, attachedTo: id, data })
  }

  async removeCollection (_class: string, space: string, id: string): Promise<void> {
    this.mutations.push({ op: 'removeCollection', _class, space, attachedTo: id })
  }

  /** Canned fulltext result; the last query is kept for assertions. */
  searchResult: { docs: any[], total?: number } = { docs: [] }
  lastSearch: any
  async searchFulltext (query: unknown, options: unknown): Promise<any> {
    this.lastSearch = { query, options }
    return this.searchResult
  }

  async createMixin (id: string, _class: string, space: string, mixin: string, data: unknown): Promise<void> {
    this.mutations.push({ op: 'createMixin', _class: mixin, space, attachedTo: id, data })
  }

  async updateMixin (id: string, _class: string, space: string, mixin: string, data: unknown): Promise<void> {
    this.mutations.push({ op: 'updateMixin', _class: mixin, space, attachedTo: id, data })
  }

  async removeDoc (_class: string, space: string, id: string): Promise<void> {
    this.mutations.push({ op: 'removeDoc', _class, space, attachedTo: id })
  }
}

export interface FakeAccountCalls {
  login: number
  getUserWorkspaces: number
  getLoginInfoByToken: number
  selectWorkspace: Array<{ slug: string, token?: string }>
  getUserWorkspacesTokens: Array<string | undefined>
  getWorkspaceMembersTokens: Array<string | undefined>
  /** Invite and role calls: [method, ...args]. */
  admin: unknown[][]
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
    admin: [],
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
    },
    createInvite: async (...a: unknown[]) => { calls.admin.push(['createInvite', ...a]); return 'inv-1' },
    createInviteLink: async (...a: unknown[]) => { calls.admin.push(['createInviteLink', ...a]); return 'http://localhost:8087/login/join?inviteId=inv-2' },
    sendInvite: async (...a: unknown[]) => { calls.admin.push(['sendInvite', ...a]) },
    updateWorkspaceRole: async (...a: unknown[]) => { calls.admin.push(['updateWorkspaceRole', ...a]) }
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
export const ACME: FakeWorkspace = { uuid: '22222222-bbbb-4000-8000-000000000002', url: 'acme', name: 'ACME' }
