var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var storage_exports = {};
__export(storage_exports, {
  deleteBlob: () => deleteBlob,
  uploadBlob: () => uploadBlob,
  uploadMarkupBlob: () => uploadMarkupBlob
});
module.exports = __toCommonJS(storage_exports);
const UPLOAD_TIMEOUT_MS = 12e4;
const CLOUD_DATALAKE_URL = "https://dl-eu.huly.app";
async function uploadMarkupBlob(wsToken, workspaceUuid, blobId, content) {
  const result = await uploadBlob(
    wsToken,
    workspaceUuid,
    blobId,
    new Blob([content], { type: "application/json" })
  );
  return result.id;
}
async function uploadBlob(wsToken, workspaceUuid, blobId, blob) {
  const frontUrl = process.env.HULY_FRONT_URL;
  if (frontUrl != null && frontUrl !== "") {
    return await uploadViaSelfHostedFront(frontUrl, wsToken, blobId, blob);
  }
  return await uploadViaCloudDatalake(workspaceUuid, wsToken, blobId, blob);
}
async function uploadViaSelfHostedFront(frontUrl, wsToken, blobId, blob) {
  const form = new FormData();
  form.append("file", blob, blobId);
  const uploadUrl = `${frontUrl.replace(/\/$/, "")}/files`;
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${wsToken}` },
    body: form,
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS)
  });
  if (!uploadRes.ok) {
    const body = await uploadRes.text().catch(() => "");
    throw new Error(`Self-hosted file upload failed (${uploadRes.status}) at ${uploadUrl}: ${body}`);
  }
  const uploadJson = await uploadRes.json();
  const uploadedId = uploadJson[0]?.id;
  if (uploadedId == null) {
    throw new Error(`Self-hosted file upload: no blob id in response: ${JSON.stringify(uploadJson)}`);
  }
  return { id: uploadedId, size: uploadJson[0]?.metadata?.size ?? blob.size };
}
async function uploadViaCloudDatalake(workspaceUuid, wsToken, blobId, blob) {
  const form = new FormData();
  form.append("file", blob, blobId);
  const uploadUrl = `${CLOUD_DATALAKE_URL}/upload/form-data/${workspaceUuid}`;
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${wsToken}` },
    body: form,
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS)
  });
  if (!uploadRes.ok) {
    const body = await uploadRes.text().catch(() => "");
    throw new Error(`Datalake upload failed (${uploadRes.status}): ${body}`);
  }
  const uploadJson = await uploadRes.json();
  return { id: uploadJson[0]?.id ?? blobId, size: uploadJson[0]?.metadata?.size ?? blob.size };
}
async function deleteBlob(wsToken, workspaceUuid, blobId) {
  const frontUrl = process.env.HULY_FRONT_URL;
  const url = frontUrl != null && frontUrl !== "" ? `${frontUrl.replace(/\/$/, "")}/files?file=${encodeURIComponent(blobId)}` : `${CLOUD_DATALAKE_URL}/blob/${encodeURIComponent(workspaceUuid)}/${encodeURIComponent(blobId)}`;
  await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${wsToken}` }, signal: AbortSignal.timeout(3e4) }).catch(() => {
  });
}
