#!/usr/bin/env node
/**
 * One-off script: populate the 4 medics-care epic documents with Mermaid diagrams
 * Run: node --env-file=.env scripts/populate-docs.mjs
 */
import accountClientPkg from '@hcengineering/account-client'
import corePkg from '@hcengineering/core'
import serverClientPkg from '@hcengineering/server-client'
import documentPkg from '@hcengineering/document'

const { getClient: getRawAccountClient } = accountClientPkg
const { TxOperations } = corePkg
const { createClient } = serverClientPkg
const document = documentPkg.default ?? documentPkg

const DATALAKE_URL = 'https://dl-eu.huly.app'
const ACCOUNTS_URL = process.env.HULY_ACCOUNTS_URL ?? 'https://account.huly.app'

// ── Connect ───────────────────────────────────────────────────────────────────

async function connect () {
  const workspaceUrl = process.env.HULY_WORKSPACE
  const hulyToken = process.env.HULY_TOKEN

  if (!workspaceUrl || !hulyToken) throw new Error('HULY_WORKSPACE and HULY_TOKEN are required')

  const authedClient = getRawAccountClient(ACCOUNTS_URL, hulyToken)
  const info = await authedClient.getLoginInfoByToken()
  if (!info) throw new Error('HULY_TOKEN invalid or expired')

  let socialId, endpoint, wsToken, workspaceUuid

  if ('endpoint' in info && info.endpoint) {
    socialId = info.socialId
    endpoint = info.endpoint
    wsToken = info.token
    workspaceUuid = String(info.workspace ?? '')
  } else if ('token' in info && info.token) {
    socialId = info.socialId
    const wsInfo = await authedClient.selectWorkspace(workspaceUrl, 'external')
    if (!wsInfo.endpoint || !wsInfo.token) throw new Error(`Workspace '${workspaceUrl}' not accessible`)
    endpoint = wsInfo.endpoint
    wsToken = wsInfo.token
    workspaceUuid = String(wsInfo.workspace ?? '')
  } else {
    throw new Error('Unexpected token response')
  }

  const rawConnection = await createClient(endpoint, wsToken)
  const txClient = new TxOperations(rawConnection, socialId)
  return { txClient, rawConnection, wsToken, workspaceUuid }
}

// ── Upload blob ───────────────────────────────────────────────────────────────

async function uploadContent (wsToken, workspaceUuid, docId, content) {
  const blobId = `${docId}-content-${Date.now()}`
  const form = new FormData()
  form.append('file', new Blob([content], { type: 'application/json' }), blobId)

  const res = await fetch(`${DATALAKE_URL}/upload/form-data/${workspaceUuid}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${wsToken}` },
    body: form
  })

  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await res.text()}`)
  const json = await res.json()
  return json[0]?.id ?? blobId
}

// ── Markdown → ProseMirror ────────────────────────────────────────────────────

function parseInline (text) {
  const nodes = []
  const re = /\*\*(.+?)\*\*|`(.+?)`|([^`*]+)/g
  let m
  while ((m = re.exec(text)) !== null) {
    if (m[1] != null) nodes.push({ type: 'text', text: m[1], marks: [{ type: 'bold' }] })
    else if (m[2] != null) nodes.push({ type: 'text', text: m[2], marks: [{ type: 'code' }] })
    else if (m[3]?.length > 0) nodes.push({ type: 'text', text: m[3] })
  }
  return nodes.length > 0 ? nodes : [{ type: 'text', text }]
}

function buildTable (rows) {
  const [headerRow, ...bodyRows] = rows
  const tableRows = []
  if (headerRow) {
    tableRows.push({
      type: 'tableRow',
      content: headerRow.map(cell => ({
        type: 'tableHeader',
        content: [{ type: 'paragraph', content: parseInline(cell) }]
      }))
    })
  }
  for (const row of bodyRows) {
    tableRows.push({
      type: 'tableRow',
      content: row.map(cell => ({
        type: 'tableCell',
        content: [{ type: 'paragraph', content: parseInline(cell) }]
      }))
    })
  }
  return { type: 'table', content: tableRows }
}

function markdownToProseMirror (md) {
  const lines = md.split('\n')
  const nodes = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++
      // Use Huly's native 'mermaid' node type so diagrams render properly
      const nodeType = lang === 'mermaid' ? 'mermaid' : 'codeBlock'
      nodes.push({
        type: nodeType,
        attrs: { language: lang || null },
        content: [{ type: 'text', text: codeLines.join('\n') }]
      })
      continue
    }

    // Heading
    const hm = line.match(/^(#{1,6})\s+(.+)$/)
    if (hm) {
      nodes.push({ type: 'heading', attrs: { level: hm[1].length }, content: parseInline(hm[2]) })
      i++; continue
    }

    // Table
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableRows = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
        const row = lines[i].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
        if (!row.every(c => /^[-:]+$/.test(c))) tableRows.push(row)
        i++
      }
      if (tableRows.length > 0) nodes.push(buildTable(tableRows))
      continue
    }

    // Bullet list
    if (/^(\s*[-*+])\s/.test(line)) {
      const items = []
      while (i < lines.length && /^(\s*[-*+])\s/.test(lines[i])) {
        const text = lines[i].replace(/^\s*[-*+]\s/, '')
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: parseInline(text) }] })
        i++
      }
      nodes.push({ type: 'bulletList', content: items })
      continue
    }

    if (line.trim() === '') { i++; continue }

    nodes.push({ type: 'paragraph', content: parseInline(line) })
    i++
  }

  if (nodes.length === 0) nodes.push({ type: 'paragraph', content: [] })
  return { type: 'doc', content: nodes }
}

// ── Document content ──────────────────────────────────────────────────────────

const EP1_MD = `# EP1 — Service Ordering Flow

## Architecture Flow

\`\`\`mermaid
flowchart TD
    A([Patient Opens App]) --> B{What to order?}

    B --> C[Health Packages\\ne.g. Full Body, Cardiac]
    B --> D[Individual Lab Tests\\ne.g. CBC, HbA1c]

    C --> E[Browse Catalogue]
    D --> E

    E --> F[Select Service]
    F --> G[Select Patient\\nSelf or Family Member]
    G --> H{Home Collection\\nAvailable?}

    H -- Yes --> I[Choose: Home / Walk-in]
    H -- No --> J[Walk-in Only]

    I --> K[Pick Date & Slot]
    J --> K

    K --> L[Review Order]
    L --> M[Payment via Razorpay]

    M -- Success --> N[Order Confirmed ✅]
    M -- Failed --> O[Retry Payment ❌]

    N --> P[Sync to HIS]
    N --> Q[Push Notification Sent]
    N --> R[Order Tracking Active]

    R --> S[CONFIRMED]
    S --> T[SAMPLE COLLECTED]
    T --> U[PROCESSING]
    U --> V[REPORT READY 🎉]
    V --> W[View Report in App]
\`\`\`

## Business Rules

| Rule | Detail |
|------|--------|
| Service visibility | Only services flagged \`canBeOrderedFromApp: true\` in HIS |
| Home collection | Checked per service + patient pin code |
| Payment | Mandatory before order confirmation |
| HIS sync | All orders synced back to HIS for lab/collection team |
| Family orders | All linked family members eligible |
`

const EP2_MD = `# EP2 — Medicine Ordering & Refills

## Flow

\`\`\`mermaid
flowchart TD
    A([Entry Point]) --> B{Source}

    B -- From Visit --> C[Prescription Medicines]
    B -- Past Order --> D[Order History]
    B -- Refill Reminder --> E[Refill Screen]

    C --> F[Medicine List]
    D --> F
    E --> F

    F --> G{Medicine Type?}

    G -- OTC --> H[✅ Allow Order\\nNo Rx needed]
    G -- Rx-Required --> I{Valid Prescription\\nExists?}

    I -- Yes, Active --> J{Is it a Refill?}
    I -- No / Expired --> K[❌ BLOCKED\\nShow: Prescription required\\nOffer: Book Follow-up]

    J -- Within Validity --> L[✅ Allow Refill]
    J -- Expired --> M[❌ BLOCKED\\nShow: Prescription expired\\nOffer: Book Follow-up]

    H --> N[Select Patient]
    L --> N

    N --> O[Choose Delivery Address\\nSaved or New]
    O --> P[Review Cart]
    P --> Q[Payment]

    Q -- Success --> R[Order Confirmed ✅]
    Q -- Failed --> S[Retry ❌]

    R --> T[PENDING]
    T --> U[CONFIRMED]
    U --> V[DISPATCHED 🚚]
    V --> W[DELIVERED 🎉]
\`\`\`

## Prescription Validation Matrix

| Medicine Type | Valid Rx | Expired Rx | No Rx |
|--------------|----------|------------|-------|
| Rx-Required  | ✅ Allow  | ❌ Block + suggest follow-up | ❌ Block |
| OTC          | ✅ Allow  | ✅ Allow   | ✅ Allow |
| Refill       | ✅ Allow (within validity) | ❌ Block | ❌ Block |

## Business Rules

- Prescription validity period set at time of issue (30 / 60 / 90 days)
- Partial orders allowed: OTC items proceed even if Rx items are blocked
- Expired prescription → prompt to book a follow-up appointment
- All orders linked to patient + family member context
`

const EP3_MD = `# EP3 — Deep Linking Architecture

## Link Resolution Flow

\`\`\`mermaid
flowchart TD
    A([Link Received\\nSMS / WhatsApp / Email / Push]) --> B[Smart Link URL\\nhttps://novacare.medicsprime.in/link/...]

    B --> C{App Installed?}

    C -- Yes --> D[Open Native App\\niOS Universal Link\\nAndroid App Link]
    C -- No --> E[Open in Browser\\nWeb Fallback]

    D --> F[Native Deep Link Handler]
    F --> G{Authenticated?}

    G -- Yes --> L[Route to Screen]
    G -- No --> H[OTP Login\\nPre-fill phone if known]
    H --> L

    E --> I{Auto-Login Token\\nin URL?}

    I -- Valid Token --> J[Auto-Login\\nSingle-use, 24h expiry]
    I -- No / Expired --> K[OTP Login Page\\nPre-fill phone if known]

    J --> L
    K --> L

    L --> M{Link Type}

    M -- /book --> N[Appointment Booking\\npre-filled doctor/speciality]
    M -- /apt --> O[Appointment Detail]
    M -- /rx --> P[Prescription View]
    M -- /report --> Q[Lab Report View]
    M -- /package --> R[Health Package Order]
    M -- /refill --> S[Medicine Refill Flow]
    M -- /bill --> T[Bill & Payment]
\`\`\`

## Link Format

\`\`\`
https://{hospital}.medicsprime.in/link/{type}?id={resourceId}&t={autoLoginToken}&ph={phoneHint}
\`\`\`

| Parameter | Description |
|-----------|-------------|
| \`hospital\` | novacare / sarji / cura / khushi |
| \`type\` | apt / rx / report / package / refill / bill / book |
| \`id\` | Resource ID (optional for /book) |
| \`t\` | Auto-login token (24h, single-use, optional) |
| \`ph\` | Phone number hint for OTP pre-fill (optional) |

## Auto-Login Token Security

\`\`\`mermaid
flowchart LR
    A[Token Generated] --> B[Signed with HMAC-SHA256]
    B --> C[Contains: userId + expiry + resourceId]
    C --> D[24-hour expiry]
    D --> E[Single-use — invalidated on first use]
    E --> F[Scoped to linked resource only]
\`\`\`

## Per-Hospital URL Schemes

| Hospital | Web Domain | Native Scheme |
|----------|-----------|---------------|
| NovaCare | novacare.medicsprime.in | novacare:// |
| Sarji | sarji.medicsprime.in | sarji:// |
| Cura | cura.medicsprime.in | cura:// |
| Khushi | khushi.medicsprime.in | khushi:// |
`

const EP4_MD = `# EP4 — Push Notifications

## Notification Delivery Architecture

\`\`\`mermaid
flowchart TD
    A([Trigger]) --> B{Trigger Type}

    B -- Hospital Event --> C[Appointment Confirmed\\nCancelled / Lab Ready\\nPrescription Ready\\nBill Generated]
    B -- Scheduled Job --> D[Appointment Reminder\\nMedicine Dose\\nRefill Due\\nRx Expiry\\nCheckup Due]
    B -- Patient Action --> E[Payment Success\\nOrder Placed\\nMedicine Ordered]

    C --> F[Notification Engine\\nBackend Service]
    D --> F
    E --> F

    F --> G{Check Opt-in\\nPreferences}
    G -- Opted Out --> Z[Skip ✗]
    G -- Opted In --> H{Quiet Hours?\\n10pm – 7am}

    H -- Critical Alert --> I[Send Immediately\\nAppt Cancelled only]
    H -- Non-Critical + Quiet --> J[Queue for 7am]
    H -- Normal Hours --> K{Daily Limit\\nReached? max 3}

    K -- Under Limit --> L[Send Now]
    K -- At Limit --> M[Queue for Next Day]

    I --> N[FCM / Firebase]
    J --> N
    L --> N

    N --> O{Platform}
    O -- iOS/Android --> P[Capacitor Push\\nNative Alert]
    O -- Web --> Q[Firebase VAPID\\nBrowser Notification]
    O -- Critical Only --> R[SMS Fallback\\nvia Communication Service]

    P --> S[Tap → Deep Link\\nto Relevant Screen]
    Q --> S
\`\`\`

## All Notification Scenarios

\`\`\`mermaid
mindmap
  root((Push\\nNotifications))
    Appointments
      Confirmed ✅
      Reminder 24h ⏰
      Reminder 2h ⏰
      Cancelled ❗
      Rescheduled ❗
      Doctor Late 🕐
    Lab and Reports
      Lab Result Ready 📋
      Prescription Ready 💊
      Home Collection Morning 🏠
      Order Confirmed 📦
    Medicine
      Dose Reminder 💊
      Missed Dose ⚠️
      Refill Due 🔄
      Rx Expiry 7 days 📅
      Order Dispatched 🚚
      Order Delivered 🎉
    Billing
      Bill Generated 💰
      Payment Success ✅
      Payment Due ⏳
    Preventive Health
      Annual Checkup 📅
      Follow-up Due 👨‍⚕️
      Vaccination Due 💉
\`\`\`

## Notification Preferences

\`\`\`mermaid
flowchart LR
    A[Patient Settings] --> B[Notification Preferences]
    B --> C[🔔 Appointments\\nDefault: ON]
    B --> D[💊 Medicine\\nDefault: ON]
    B --> E[📦 Orders\\nDefault: ON]
    B --> F[💰 Billing\\nDefault: ON]
    B --> G[🏥 Preventive Health\\nDefault: ON]
    B --> H[📣 Promotional\\nDefault: OFF]
\`\`\`

## Scenario Reference Table

| Scenario | Trigger | Channel | Priority | Deep Link |
|----------|---------|---------|----------|-----------|
| Appt Confirmed | Event | Push | High | /apt?id=X |
| Appt Reminder 24h | Scheduled | Push + SMS | High | /apt?id=X |
| Appt Reminder 2h | Scheduled | Push | High | /apt?id=X |
| Appt Cancelled | Event | Push + SMS | **Critical** | /apt?id=X |
| Doctor Running Late | Event | Push | Normal | /apt?id=X |
| Lab Result Ready | Event | Push | High | /report?id=X |
| Prescription Ready | Event | Push | High | /rx?id=X |
| Medicine Dose Due | Scheduled | Push | Normal | Reminder |
| Missed Dose | Scheduled | Push | Normal | Reminder |
| Refill Due | Scheduled | Push | High | /refill?med=X |
| Rx Expiry (7 days) | Scheduled | Push | High | /rx?id=X |
| Bill Generated | Event | Push | High | /bill?id=X |
| Payment Success | Event | Push | Normal | /bill?id=X |
| Payment Due | Scheduled | Push | Normal | /bill?id=X |
| Annual Checkup | Scheduled | Push | Low | Book |
| Follow-up Due | Scheduled | Push | Normal | Book |
| Vaccination Due | Scheduled | Push | Normal | Reminder |
`

// ── Document IDs (created in previous session) ────────────────────────────────
const DOCS = [
  { id: '69b9a635cf60316d6ce21a50', title: 'EP1 — Service Ordering', md: EP1_MD },
  { id: '69b9a63bcf60316d6ce21a52', title: 'EP2 — Medicine Ordering', md: EP2_MD },
  { id: '69b9a640cf60316d6ce21a54', title: 'EP3 — Deep Linking', md: EP3_MD },
  { id: '69b9a645cf60316d6ce21a56', title: 'EP4 — Push Notifications', md: EP4_MD }
]

// ── Main ──────────────────────────────────────────────────────────────────────

const { txClient, rawConnection, wsToken, workspaceUuid } = await connect()
console.log(`Connected. Workspace UUID: ${workspaceUuid}`)

for (const { id, title, md } of DOCS) {
  process.stdout.write(`Updating "${title}" ... `)
  try {
    const doc = await txClient.findOne(document.class.Document, { _id: id })
    if (!doc) { console.log('NOT FOUND — skipping'); continue }

    const prosemirror = markdownToProseMirror(md)
    const blobId = await uploadContent(wsToken, workspaceUuid, id, JSON.stringify(prosemirror))
    await txClient.updateDoc(document.class.Document, doc.space, doc._id, { content: blobId })
    console.log(`✅  blob: ${blobId}`)
  } catch (err) {
    console.log(`❌  ${err.message}`)
  }
}

await rawConnection.close()
console.log('\nDone.')
