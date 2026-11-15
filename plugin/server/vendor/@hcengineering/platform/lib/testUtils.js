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
var testUtils_exports = {};
__export(testUtils_exports, {
  makeLocalesTest: () => makeLocalesTest
});
module.exports = __toCommonJS(testUtils_exports);
function makeLocaleMatcher(target) {
  return Object.entries(target).reduce(
    (obj, [key, value]) => ({
      ...obj,
      [key]: typeof value === "string" ? expect.any(String) : makeLocaleMatcher(value)
    }),
    {}
  );
}
__name(makeLocaleMatcher, "makeLocaleMatcher");
const langs = ["en", "ru"];
function makeLocalesTest(loader) {
  return async () => {
    const [target, ...rest] = await Promise.all(langs.map(loader));
    const matcher = makeLocaleMatcher(target);
    rest.forEach((loc) => {
      expect(loc).toEqual(matcher);
    });
  };
}
__name(makeLocalesTest, "makeLocalesTest");
//# sourceMappingURL=testUtils.js.map
