"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
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
var blob_exports = {};
__export(blob_exports, {
  BlobClient: () => BlobClient
});
module.exports = __toCommonJS(blob_exports);
var import_node_buffer = require("node:buffer");
class BlobClient {
  constructor(storageAdapter, workspace) {
    this.storageAdapter = storageAdapter;
    this.workspace = workspace;
    this.index = 0;
  }
  static {
    __name(this, "BlobClient");
  }
  index;
  async checkFile(ctx, name) {
    const obj = await this.storageAdapter.stat(ctx, this.workspace, name);
    if (obj !== void 0) {
      return true;
    }
    return false;
  }
  async writeTo(ctx, name, size, writable) {
    let written = 0;
    const chunkSize = 50 * 1024 * 1024;
    let emptyChunkRetries = 0;
    const maxEmptyChunkRetries = 3;
    while (written < size) {
      let i = 0;
      for (; i < 5; i++) {
        try {
          const chunks = [];
          const readable = await this.storageAdapter.partial(ctx, this.workspace, name, written, chunkSize);
          await new Promise((resolve) => {
            readable.on("data", (chunk2) => {
              chunks.push(chunk2);
            });
            readable.on("end", () => {
              readable.destroy();
              resolve();
            });
          });
          const chunk = import_node_buffer.Buffer.concat(chunks);
          if (chunk.length === 0) {
            emptyChunkRetries++;
            if (emptyChunkRetries >= maxEmptyChunkRetries) {
              ctx.error("Empty chunk received multiple times, aborting", { name, written, size, emptyChunkRetries });
              await new Promise((resolve) => {
                writable.end(resolve);
              });
              throw new Error(
                `Empty chunk received ${emptyChunkRetries} times for blob ${name} at offset ${written}/${size}`
              );
            }
            ctx.warn("Empty chunk received, retrying", { name, written, size, retry: emptyChunkRetries });
            await new Promise((resolve) => setTimeout(resolve, 100 * emptyChunkRetries));
            continue;
          }
          emptyChunkRetries = 0;
          await new Promise((resolve, reject) => {
            writable.write(chunk, (err) => {
              if (err != null) {
                reject(err);
              }
              resolve();
            });
          });
          written += chunk.length;
          break;
        } catch (err) {
          if (err?.code === "NoSuchKey" || err?.code === "NotFound" || err?.message === "No such key" || err?.Code === "NoSuchKey") {
            ctx.info("No such key", { name });
            return;
          }
          if (i >= 4) {
            await new Promise((resolve) => {
              writable.end(resolve);
            });
            throw err;
          }
          await new Promise((resolve) => setTimeout(resolve, 100 * (i + 1)));
        }
      }
    }
    await new Promise((resolve) => {
      writable.end(resolve);
    });
  }
  async upload(ctx, name, size, contentType, buffer) {
    await this.storageAdapter.put(ctx, this.workspace, name, buffer, contentType, size);
  }
}
//# sourceMappingURL=blob.js.map
