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
var event_exports = {};
__export(event_exports, {
  PlatformEvent: () => PlatformEvent,
  addEventListener: () => addEventListener,
  broadcastEvent: () => broadcastEvent,
  monitor: () => monitor,
  removeEventListener: () => removeEventListener,
  setPlatformStatus: () => setPlatformStatus
});
module.exports = __toCommonJS(event_exports);
var import_status = require("./status.js");
const PlatformEvent = "platform-event";
const eventListeners = /* @__PURE__ */ new Map();
function addEventListener(event, listener) {
  const listeners = eventListeners.get(event);
  if (listeners !== void 0) {
    listeners.push(listener);
  } else {
    eventListeners.set(event, [listener]);
  }
}
__name(addEventListener, "addEventListener");
function removeEventListener(event, listener) {
  const listeners = eventListeners.get(event);
  if (listeners !== void 0) {
    listeners.splice(listeners.indexOf(listener), 1);
  }
}
__name(removeEventListener, "removeEventListener");
async function broadcastEvent(event, data) {
  const listeners = eventListeners.get(event);
  if (listeners !== void 0) {
    const promises = listeners.map(async (listener) => {
      await listener(event, data);
    });
    await Promise.all(promises);
  }
}
__name(broadcastEvent, "broadcastEvent");
async function setPlatformStatus(status) {
  if (status.severity === import_status.Severity.ERROR) {
    console.trace("Platform Error Status", status);
  }
  await broadcastEvent(PlatformEvent, status);
}
__name(setPlatformStatus, "setPlatformStatus");
async function monitor(status, promise) {
  void setPlatformStatus(status);
  try {
    const result = await promise;
    void setPlatformStatus(import_status.OK);
    return result;
  } catch (err) {
    void setPlatformStatus((0, import_status.unknownError)(err));
    console.error(err);
    throw err;
  }
}
__name(monitor, "monitor");
//# sourceMappingURL=event.js.map
