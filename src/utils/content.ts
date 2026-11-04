// Reading and writing rich-text bodies (issue descriptions, document content, card content …).
// Huly stores them as blobs holding ProseMirror JSON; the doc only keeps the blob ref.
import { getWorkspaceInfo } from '../connection'
import { extractText, markdownToProseMirror } from './markdown'
import { uploadMarkupBlob } from './storage'

/** Plain text of a markup blob, or a short note why it could not be read. */
export async function readMarkup (workspace: string | undefined, blobRef: string | null | undefined): Promise<string> {
  if (blobRef == null || blobRef === '') return ''
  const frontUrl = process.env.HULY_FRONT_URL
  if (frontUrl == null || frontUrl === '') return `_(content not loaded — set HULY_FRONT_URL; blob \`${blobRef}\`)_`
  const { wsToken, workspaceUuid } = await getWorkspaceInfo(workspace)
  // Token goes in the Authorization header only — never in the URL.
  const url = `${frontUrl.replace(/\/$/, '')}/files?file=${encodeURIComponent(blobRef)}&workspace=${workspaceUuid}`
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${wsToken}` } })
    if (!res.ok) return `_(content fetch failed: HTTP ${res.status})_`
    const text = await res.text()
    try { return extractText(JSON.parse(text)) } catch { return text.slice(0, 4000) }
  } catch (e) {
    return `_(content fetch failed: ${(e as Error).message})_`
  }
}

/** Uploads Markdown as a markup blob and returns the blob ref to store on the doc. */
export async function writeMarkup (workspace: string | undefined, idHint: string, markdown: string): Promise<string> {
  const { wsToken, workspaceUuid } = await getWorkspaceInfo(workspace)
  return await uploadMarkupBlob(wsToken, workspaceUuid, `${idHint}-${Date.now()}`, JSON.stringify(markdownToProseMirror(markdown)))
}

/** Raw bytes of a blob (files, attachments) — via the self-hosted front service. */
export async function downloadBlob (workspace: string | undefined, blobRef: string): Promise<Buffer> {
  const frontUrl = process.env.HULY_FRONT_URL
  if (frontUrl == null || frontUrl === '') throw new Error('Downloading files needs HULY_FRONT_URL.')
  const { wsToken, workspaceUuid } = await getWorkspaceInfo(workspace)
  const url = `${frontUrl.replace(/\/$/, '')}/files?file=${encodeURIComponent(blobRef)}&workspace=${workspaceUuid}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${wsToken}` } })
  if (!res.ok) throw new Error(`File download failed: HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}
