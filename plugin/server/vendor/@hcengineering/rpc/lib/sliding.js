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
var sliding_exports = {};
__export(sliding_exports, {
  SlidingWindowRateLimitter: () => SlidingWindowRateLimitter
});
module.exports = __toCommonJS(sliding_exports);
class SlidingWindowRateLimitter {
  constructor(rateLimitMax, rateLimitWindow, now = Date.now) {
    this.rateLimitMax = rateLimitMax;
    this.rateLimitWindow = rateLimitWindow;
    this.now = now;
    this.rateLimitMax = rateLimitMax;
    this.rateLimitWindow = rateLimitWindow;
  }
  static {
    __name(this, "SlidingWindowRateLimitter");
  }
  rateLimits = /* @__PURE__ */ new Map();
  checkRateLimit(groupId) {
    const now = this.now();
    const windowStart = now - this.rateLimitWindow;
    let rateLimit = this.rateLimits.get(groupId);
    if (rateLimit == null) {
      rateLimit = { requests: [], resetTime: now + this.rateLimitWindow, rejectedRequests: 0 };
      this.rateLimits.set(groupId, rateLimit);
    }
    rateLimit.requests = rateLimit.requests.filter((time) => time > windowStart);
    if (rateLimit.requests.length === 0) {
      rateLimit.rejectedRequests = 0;
    }
    rateLimit.resetTime = now + this.rateLimitWindow;
    if (rateLimit.requests.length <= this.rateLimitMax) {
      rateLimit.requests.push(now + (rateLimit.rejectedRequests > this.rateLimitMax * 2 ? this.rateLimitWindow * 5 : 0));
    }
    if (rateLimit.requests.length >= this.rateLimitMax) {
      rateLimit.rejectedRequests++;
      const nextAvailableTime = rateLimit.requests[0] + this.rateLimitWindow;
      return {
        remaining: 0,
        limit: this.rateLimitMax,
        current: rateLimit.requests.length,
        reset: rateLimit.resetTime,
        retryAfter: Math.max(1, nextAvailableTime - now + 1)
      };
    }
    return {
      remaining: this.rateLimitMax - rateLimit.requests.length,
      current: rateLimit.requests.length,
      limit: this.rateLimitMax,
      reset: rateLimit.resetTime
    };
  }
  // Add a reset method for testing purposes
  reset() {
    this.rateLimits.clear();
  }
}
//# sourceMappingURL=sliding.js.map
