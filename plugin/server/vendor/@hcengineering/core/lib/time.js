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
var time_exports = {};
__export(time_exports, {
  convertToDay: () => convertToDay,
  getDay: () => getDay,
  getDisplayTime: () => getDisplayTime,
  getHour: () => getHour,
  isOtherDay: () => isOtherDay,
  isOtherHour: () => isOtherHour
});
module.exports = __toCommonJS(time_exports);
function getDay(time) {
  const date = new Date(time);
  return convertToDay(date).getTime();
}
__name(getDay, "getDay");
function convertToDay(date) {
  const originalDay = date.getDate();
  const convertedDate = new Date(date);
  convertedDate.setUTCHours(12, 0, 0, 0);
  if (convertedDate.getDate() !== originalDay) {
    convertedDate.setDate(originalDay);
  }
  return convertedDate;
}
__name(convertToDay, "convertToDay");
function getHour(time) {
  const date = new Date(time);
  date.setMinutes(0, 0, 0);
  return date.getTime();
}
__name(getHour, "getHour");
function getDisplayTime(time) {
  let options = { hour: "numeric", minute: "numeric" };
  if (!isToday(time)) {
    options = {
      month: "numeric",
      day: "numeric",
      ...options
    };
  }
  return new Date(time).toLocaleString("default", options);
}
__name(getDisplayTime, "getDisplayTime");
function isOtherDay(time1, time2) {
  return getDay(time1) !== getDay(time2);
}
__name(isOtherDay, "isOtherDay");
function isOtherHour(time1, time2) {
  return getHour(time1) !== getHour(time2);
}
__name(isOtherHour, "isOtherHour");
function isToday(time) {
  const current = /* @__PURE__ */ new Date();
  const target = new Date(time);
  return current.getDate() === target.getDate() && current.getMonth() === target.getMonth() && current.getFullYear() === target.getFullYear();
}
__name(isToday, "isToday");
//# sourceMappingURL=time.js.map
