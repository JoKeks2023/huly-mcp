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
var metrics_exports = {};
__export(metrics_exports, {
  childMetrics: () => childMetrics,
  globals: () => globals,
  measure: () => measure,
  metricsAggregate: () => metricsAggregate,
  metricsToJson: () => metricsToJson,
  metricsToRows: () => metricsToRows,
  metricsToString: () => metricsToString,
  newMetrics: () => newMetrics,
  updateMeasure: () => updateMeasure
});
module.exports = __toCommonJS(metrics_exports);
var import__ = require("./index.js");
const globals = newMetrics();
function newMetrics() {
  return {
    operations: 0,
    value: 0,
    measurements: {},
    params: {},
    namedParams: {}
  };
}
__name(newMetrics, "newMetrics");
function getUpdatedTopResult(current, time, params) {
  if (time === 0) {
    return current;
  }
  const result = current ?? [];
  const newValue = {
    value: time,
    params
  };
  if (result.length > 6) {
    if (result[0].value < newValue.value) {
      result[0] = newValue;
      return result;
    }
    if (result[result.length - 1].value > newValue.value) {
      result[result.length - 1] = newValue;
      return result;
    }
    return [result[0], newValue, ...result.slice(1, 3), result[5]];
  } else {
    result.push(newValue);
    return result;
  }
}
__name(getUpdatedTopResult, "getUpdatedTopResult");
function measure(metrics, params, fullParams = {}, endOp) {
  const st = (0, import__.platformNow)();
  return () => {
    updateMeasure(metrics, st, params, fullParams, endOp);
  };
}
__name(measure, "measure");
function updateMeasure(metrics, st, params, fullParams, endOp, value, override) {
  const ed = (0, import__.platformNow)();
  const fParams = typeof fullParams === "function" ? fullParams() : fullParams;
  const pparams = Object.entries(params);
  if (pparams.length > 0) {
    const [k, v] = pparams[0];
    let params2 = metrics.params[k];
    if (params2 === void 0) {
      params2 = {};
      metrics.params[k] = params2;
    }
    const vKey = `${v?.toString() ?? ""}`;
    let param = params2[vKey];
    if (param === void 0) {
      param = {
        operations: 0,
        value: 0
      };
      params2[vKey] = param;
    }
    if (override === true) {
      if (value === 0) {
        delete params2[vKey];
      } else {
        param.operations = value ?? ed - st;
      }
    } else {
      param.value += value ?? ed - st;
      param.operations++;
    }
    if (pparams.length > 1) {
      if (param.topResult === void 0) {
        param.topResult = [];
      }
      for (const [, v2] of pparams.slice(1)) {
        const r = (param.topResult ?? []).find((it) => it.params[`${v2}`] === true);
        if (r !== void 0) {
          r.value += 1;
          r.time = (r.time ?? 0) + (value ?? ed - st);
        } else {
          param.topResult.push({ params: { [`${v2}`]: true }, value: 1, time: value ?? ed - st });
        }
      }
      param.topResult.sort((a, b) => b.value - a.value);
    }
  }
  if (override === true) {
    metrics.operations = value ?? ed - st;
  } else {
    metrics.value += value ?? ed - st;
    metrics.operations++;
  }
  metrics.topResult = getUpdatedTopResult(metrics.topResult, ed - st, fParams);
  endOp?.(ed - st);
}
__name(updateMeasure, "updateMeasure");
function childMetrics(root, path) {
  const segments = path;
  let oop = root;
  for (const p of segments) {
    const v = oop.measurements[p] ?? { operations: 0, value: 0, measurements: {}, params: {} };
    oop.measurements[p] = v;
    oop = v;
  }
  return oop;
}
__name(childMetrics, "childMetrics");
function metricsAggregate(m, limit = -1, roundMath = false) {
  let ms = aggregateMetrics(m.measurements, limit);
  const me = Object.entries(ms);
  const sumVal = (me.length === 0 ? m.value : 0) + me.filter((it) => !it[0].startsWith("#")).map((it) => it[1]).reduce((p, v) => {
    return p + v.value;
  }, 0);
  if (limit !== -1) {
    if (Object.keys(ms).length > 0) {
      const newMs = {};
      let added = 0;
      for (const [k, v] of Object.entries(ms)) {
        newMs[k] = v;
        added++;
        if (added >= limit) {
          break;
        }
      }
      ms = newMs;
    }
  }
  return {
    operations: m.operations,
    measurements: ms,
    params: m.params,
    value: sumVal,
    topResult: m.topResult,
    namedParams: m.namedParams,
    opLog: m.opLog
  };
}
__name(metricsAggregate, "metricsAggregate");
function aggregateMetrics(m, limit = -1) {
  const result = {};
  for (const [k, v] of Object.entries(m).sort((a, b) => b[1].value - a[1].value)) {
    result[k] = metricsAggregate(v, limit);
  }
  return result;
}
__name(aggregateMetrics, "aggregateMetrics");
function toLen(val, sep, len) {
  while (val.length < len) {
    val += sep;
  }
  return val;
}
__name(toLen, "toLen");
function printMetricsChildren(params, offset, length) {
  let r = "";
  if (Object.keys(params).length > 0) {
    r += "\n" + toLen("", " ", offset);
    r += Object.entries(params).filter((it) => it[1].value > 0.1).map(([k, vv]) => toString(k, vv, offset, length)).join("\n" + toLen("", " ", offset));
  }
  return r;
}
__name(printMetricsChildren, "printMetricsChildren");
function printMetricsParams(params, offset, length) {
  let r = "";
  const joinP = /* @__PURE__ */ __name((key, data) => {
    return Object.entries(data).filter((it) => it[1].value >= 0.1).map(
      ([k, vv]) => `${toLen("", " ", offset)}${toLen(key + "=" + k, "-", length - offset)}: avg ${Math.round(vv.value / (vv.operations > 0 ? vv.operations : 1) * 100) / 100} total: ${Math.round(vv.value * 100) / 100} ops: ${vv.operations}`.trim()
    );
  }, "joinP");
  const joinParams = Object.entries(params).reduce((p, c) => [...p, ...joinP(c[0], c[1])], []);
  if (Object.keys(joinParams).length > 0) {
    r += "\n" + toLen("", " ", offset);
    r += joinParams.join("\n" + toLen("", " ", offset));
  }
  return r;
}
__name(printMetricsParams, "printMetricsParams");
function toString(name, m, offset, length) {
  let r = `${toLen("", " ", offset)}${toLen(name, "-", length - offset)}: avg ${Math.round(m.value / (m.operations > 0 ? m.operations : 1) * 100) / 100} total: ${Math.round(m.value * 100) / 100} ops: ${m.operations}`.trim();
  r += printMetricsParams(m.params, offset + 4, length);
  r += printMetricsChildren(m.measurements, offset + 4, length);
  return r;
}
__name(toString, "toString");
function toJson(m) {
  const obj = {
    $total: m.value,
    $ops: m.operations
  };
  if (m.operations > 1) {
    obj.avg = Math.round(m.value / (m.operations > 0 ? m.operations : 1) * 100) / 100;
  }
  if (Object.keys(m.params).length > 0) {
    obj.params = m.params;
  }
  for (const [k, v] of Object.entries(m.measurements ?? {})) {
    obj[`${k} ${v.value} ${v.operations} ${v.operations > 1 ? Math.round(v.value / (v.operations > 0 ? m.operations : 1) * 100) / 100 : ""}`] = toJson(v);
  }
  return obj;
}
__name(toJson, "toJson");
function metricsToString(metrics, name = "System", length) {
  return toString(name, metricsAggregate(metrics, 50, true), 0, length);
}
__name(metricsToString, "metricsToString");
function metricsToJson(metrics) {
  return toJson(metricsAggregate(metrics));
}
__name(metricsToJson, "metricsToJson");
function printMetricsParamsRows(params, offset) {
  const r = [];
  function joinP(key, data) {
    return Object.entries(data).map(([k, vv]) => [
      offset,
      `${key}=${k}`,
      Math.round(vv.value / (vv.operations > 0 ? vv.operations : 1) * 100) / 100,
      Math.round(vv.value * 100) / 100,
      vv.operations
    ]);
  }
  __name(joinP, "joinP");
  for (const [k, v] of Object.entries(params)) {
    r.push(...joinP(k, v));
  }
  return r;
}
__name(printMetricsParamsRows, "printMetricsParamsRows");
function printMetricsChildrenRows(params, offset) {
  const r = [];
  if (Object.keys(params).length > 0) {
    Object.entries(params).forEach(([k, vv]) => r.push(...toStringRows(k, vv, offset)));
  }
  return r;
}
__name(printMetricsChildrenRows, "printMetricsChildrenRows");
function toStringRows(name, m, offset) {
  const r = [
    [
      offset,
      name,
      Math.round(m.value / (m.operations > 0 ? m.operations : 1) * 100) / 100,
      Math.round(m.value * 100) / 100,
      m.operations
    ]
  ];
  r.push(...printMetricsParamsRows(m.params, offset + 1));
  r.push(...printMetricsChildrenRows(m.measurements, offset + 1));
  return r;
}
__name(toStringRows, "toStringRows");
function metricsToRows(metrics, name = "System") {
  return toStringRows(name, metricsAggregate(metrics, 50, true), 0);
}
__name(metricsToRows, "metricsToRows");
//# sourceMappingURL=metrics.js.map
