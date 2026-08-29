// Blob upload — used for MarkupBlobRef content (document bodies, issue
// descriptions) as well as generic file attachments.
//
// Huly Cloud uses a dedicated "datalake" microservice (see
// foundations/core/packages/storage-client/src/client/datalake.ts in
// hcengineering/platform) reachable at a fixed URL like https://dl-eu.huly.app,
// with the contract POST {datalakeUrl}/upload/form-data/{workspaceUuid}.
//
// huly-selfhost (v0.7.x) does NOT run that microservice — blob storage is
// wired directly into the `front` service via STORAGE_CONFIG (typically
// MinIO), exposed through front's own, older /files endpoint (see
// server/front/src/index.ts, handleUpload). Contract differs:
//   POST {frontUrl}/files            (workspace resolved server-side from token)
//   multipart field name: "file"
//   Authorization: Bearer <workspace token>
//   200 response: [{ key: "file", id: <blobId>, metadata: {...} }]
//
// Which one to use is auto-detected: if HULY_FRONT_URL is set (already
// required for self-hosted get_document reads per the README), we use the
// self-hosted /files contract. Otherwise we fall back to Huly Cloud's
// datalake, preserving the original behavior for huly.app users.

const CLOUD_DATALAKE_URL = 'https://dl-eu.huly.app'

export interface UploadResult {
  id: string
  size: number
}

export async function uploadMarkupBlob (
  wsToken: string,
  workspaceUuid: string,
  blobId: string,
  content: string
): Promise<string> {
  const result = await uploadBlob(
    wsToken,
    workspaceUuid,
    blobId,
    new Blob([content], { type: 'application/json' })
  )
  return result.id
}

export async function uploadBlob (
  wsToken: string,
  workspaceUuid: string,
  blobId: string,
  blob: Blob
): Promise<UploadResult> {
  const frontUrl = process.env.HULY_FRONT_URL

  if (frontUrl != null && frontUrl !== '') {
    return await uploadViaSelfHostedFront(frontUrl, wsToken, blobId, blob)
  }
  return await uploadViaCloudDatalake(workspaceUuid, wsToken, blobId, blob)
}

async function uploadViaSelfHostedFront (
  frontUrl: string,
  wsToken: string,
  blobId: string,
  blob: Blob
): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', blob, blobId)

  const uploadUrl = `${frontUrl.replace(/\/$/, '')}/files`
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${wsToken}` },
    body: form
  })

  if (!uploadRes.ok) {
    const body = await uploadRes.text().catch(() => '')
    throw new Error(`Self-hosted file upload failed (${uploadRes.status}) at ${uploadUrl}: ${body}`)
  }

  const uploadJson: Array<{ key: string, id: string, metadata?: { size?: number } }> = await uploadRes.json()
  const uploadedId = uploadJson[0]?.id
  if (uploadedId == null) {
    throw new Error(`Self-hosted file upload: no blob id in response: ${JSON.stringify(uploadJson)}`)
  }
  return { id: uploadedId, size: uploadJson[0]?.metadata?.size ?? blob.size }
}

async function uploadViaCloudDatalake (
  workspaceUuid: string,
  wsToken: string,
  blobId: string,
  blob: Blob
): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', blob, blobId)

  const uploadUrl = `${CLOUD_DATALAKE_URL}/upload/form-data/${workspaceUuid}`
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${wsToken}` },
    body: form
  })

  if (!uploadRes.ok) {
    const body = await uploadRes.text().catch(() => '')
    throw new Error(`Datalake upload failed (${uploadRes.status}): ${body}`)
  }

  const uploadJson: Array<{ key: string, id: string, metadata?: { size?: number } }> = await uploadRes.json()
  return { id: uploadJson[0]?.id ?? blobId, size: uploadJson[0]?.metadata?.size ?? blob.size }
}

export async function deleteBlob (wsToken: string, workspaceUuid: string, blobId: string): Promise<void> {
  const frontUrl = process.env.HULY_FRONT_URL
  const url = frontUrl != null && frontUrl !== ''
    ? `${frontUrl.replace(/\/$/, '')}/files?file=${encodeURIComponent(blobId)}`
    : `${CLOUD_DATALAKE_URL}/blob/${encodeURIComponent(workspaceUuid)}/${encodeURIComponent(blobId)}`

  await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${wsToken}` } }).catch(() => {})
}
