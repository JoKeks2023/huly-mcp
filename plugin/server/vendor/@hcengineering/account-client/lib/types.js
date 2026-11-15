"use strict";
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
var types_exports = {};
__export(types_exports, {
  SubscriptionStatus: () => SubscriptionStatus,
  SubscriptionType: () => SubscriptionType
});
module.exports = __toCommonJS(types_exports);
var SubscriptionStatus = /* @__PURE__ */ ((SubscriptionStatus2) => {
  SubscriptionStatus2["Active"] = "active";
  SubscriptionStatus2["Trialing"] = "trialing";
  SubscriptionStatus2["PastDue"] = "past_due";
  SubscriptionStatus2["Canceled"] = "canceled";
  SubscriptionStatus2["Paused"] = "paused";
  SubscriptionStatus2["Expired"] = "expired";
  return SubscriptionStatus2;
})(SubscriptionStatus || {});
var SubscriptionType = /* @__PURE__ */ ((SubscriptionType2) => {
  SubscriptionType2["Tier"] = "tier";
  SubscriptionType2["Support"] = "support";
  return SubscriptionType2;
})(SubscriptionType || {});
//# sourceMappingURL=types.js.map
