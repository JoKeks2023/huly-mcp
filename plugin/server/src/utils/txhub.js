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
var txhub_exports = {};
__export(txhub_exports, {
  onTx: () => onTx,
  touchedIds: () => touchedIds,
  txHub: () => txHub
});
module.exports = __toCommonJS(txhub_exports);
function txHub(raw) {
  if (raw.__hulyTxHub != null) return raw.__hulyTxHub;
  const hub = { listeners: /* @__PURE__ */ new Set() };
  const previous = raw.notify;
  raw.notify = (...txes) => {
    for (const tx of txes) for (const l of hub.listeners) {
      try {
        l(tx);
      } catch {
      }
    }
    previous?.(...txes);
  };
  Object.defineProperty(raw, "__hulyTxHub", { value: hub, enumerable: false });
  return hub;
}
function onTx(client, listener) {
  const raw = client?.client ?? client;
  const hub = txHub(raw.__hulyRaw ?? raw);
  hub.listeners.add(listener);
  return () => {
    hub.listeners.delete(listener);
  };
}
function touchedIds(tx, out = /* @__PURE__ */ new Set()) {
  if (tx == null) return out;
  for (const k of ["objectId", "attachedTo"]) if (typeof tx[k] === "string") out.add(tx[k]);
  if (tx.tx != null) touchedIds(tx.tx, out);
  for (const inner of tx.txes ?? []) touchedIds(inner, out);
  return out;
}
