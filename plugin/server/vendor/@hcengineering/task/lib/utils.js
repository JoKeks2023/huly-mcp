"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var utils_exports = {};
__export(utils_exports, {
  calcRank: () => calcRank,
  calculateStatuses: () => calculateStatuses,
  createProjectType: () => createProjectType,
  createState: () => createState,
  findStatusAttr: () => findStatusAttr,
  genRanks: () => import_rank2.genRanks,
  getProjectTypeStates: () => getProjectTypeStates,
  getStates: () => getStates,
  getStatusIndex: () => getStatusIndex,
  getTaskTypeStates: () => getTaskTypeStates,
  makeRank: () => import_rank2.makeRank,
  updateProjectType: () => updateProjectType
});
module.exports = __toCommonJS(utils_exports);
var import_core = __toESM(require("../../core/lib/index.js"));
var import_platform = require("../../platform/lib/index.js");
var import__ = __toESM(require("./index.js"));
var import_rank = require("../../rank/lib/index.js");
var import_rank2 = require("../../rank/lib/index.js");
const calcRank = /* @__PURE__ */ __name((prev, next) => {
  return (0, import_rank.makeRank)(prev?.rank, next?.rank);
}, "calcRank");
function getProjectTypeStates(projectType, types, statuses) {
  if (projectType === void 0) return [];
  return types.get(projectType)?.statuses?.map((p) => statuses.get(p._id))?.filter((p) => p !== void 0) ?? [];
}
__name(getProjectTypeStates, "getProjectTypeStates");
function getStates(space, types, statuses) {
  if (space === void 0) return [];
  return getProjectTypeStates(space.type, types, statuses);
}
__name(getStates, "getStates");
function getTaskTypeStates(taskType, types, statuses) {
  if (taskType === void 0) return [];
  return types.get(taskType)?.statuses?.map((p) => statuses.get(p))?.filter((p) => p !== void 0) ?? [];
}
__name(getTaskTypeStates, "getTaskTypeStates");
function getStatusIndex(type, taskTypes, status) {
  return type.tasks.map((it) => taskTypes.get(it)).flatMap((it) => it?.statuses.indexOf(status)).filter((it) => (it ?? 0) >= 0).reduce((p, c) => (p ?? 0) + (c ?? 0), 0) ?? -1;
}
__name(getStatusIndex, "getStatusIndex");
async function createState(client, _class, data) {
  const query = { name: data.name, ofAttribute: data.ofAttribute };
  if (data.category !== void 0) {
    query.category = data.category;
  }
  const exists = await client.findOne(_class, query);
  if (exists !== void 0) {
    return exists._id;
  }
  const res = await client.createDoc(_class, import_core.default.space.Model, data);
  return res;
}
__name(createState, "createState");
function calculateStatuses(projectType, taskTypes, override) {
  const stIds = /* @__PURE__ */ new Map();
  for (const s of projectType.statuses) {
    if (!stIds.has(s._id)) {
      stIds.set(s._id, s);
    }
  }
  const processed = /* @__PURE__ */ new Set();
  const result = [];
  for (const tt of projectType.tasks) {
    const statusesList = override.find((it) => it.taskTypeId === tt)?.statuses ?? taskTypes.get(tt)?.statuses ?? [];
    for (const tts of statusesList) {
      const prjStatus = stIds.get(tts);
      const key = `${tts}:${tt}`;
      if (!processed.has(key)) {
        processed.add(key);
        result.push({ ...prjStatus ?? {}, _id: tts, taskType: tt });
      }
    }
  }
  return result;
}
__name(calculateStatuses, "calculateStatuses");
function findStatusAttr(h, _class) {
  const attrs = h.getAllAttributes(_class);
  for (const it of attrs.values()) {
    if (it.type._class === import_core.default.class.RefTo && h.isDerived(it.type.to, import_core.default.class.Status)) {
      return it;
    }
  }
  return h.getAttribute(import__.default.class.Task, "status");
}
__name(findStatusAttr, "findStatusAttr");
async function createStates(client, states, stateClass) {
  const statuses = [];
  for (const st of states) {
    statuses.push(await createState(client, stateClass, st));
  }
  return statuses;
}
__name(createStates, "createStates");
async function createProjectType(client, data, tasks, _id) {
  const current = await client.findOne(import__.default.class.ProjectType, { _id });
  if (current !== void 0) {
    return current._id;
  }
  const _tasks = [];
  const tasksData = /* @__PURE__ */ new Map();
  const _statues = /* @__PURE__ */ new Set();
  const categoryObj = client.getModel().findObject(data.descriptor);
  if (categoryObj === void 0) {
    throw new Error("category is not found in model");
  }
  await createTaskTypes(tasks, _id, client, _statues, tasksData, _tasks, false);
  const baseClassClass = client.getHierarchy().getClass(categoryObj.baseClass);
  const targetProjectClassId = `${_id}:type:mixin`;
  const tmpl = await client.createDoc(
    import__.default.class.ProjectType,
    import_core.default.space.Model,
    {
      description: data.description,
      shortDescription: data.shortDescription,
      descriptor: data.descriptor,
      roles: 0,
      tasks: _tasks,
      name: data.name,
      statuses: calculateStatuses({ tasks: _tasks, statuses: [] }, tasksData, []),
      targetClass: targetProjectClassId,
      classic: data.classic
    },
    _id
  );
  await client.createDoc(
    import_core.default.class.Mixin,
    import_core.default.space.Model,
    {
      extends: categoryObj.baseClass,
      kind: import_core.ClassifierKind.MIXIN,
      label: (0, import_platform.getEmbeddedLabel)(data.name),
      icon: baseClassClass.icon
    },
    targetProjectClassId
  );
  await client.createMixin(targetProjectClassId, import_core.default.class.Mixin, import_core.default.space.Model, import__.default.mixin.ProjectTypeClass, {
    projectType: _id
  });
  return tmpl;
}
__name(createProjectType, "createProjectType");
async function updateProjectType(client, projectType, tasks) {
  const current = await client.findOne(import__.default.class.ProjectType, { _id: projectType });
  if (current === void 0) {
    throw new import_platform.PlatformError((0, import_platform.unknownStatus)("No project type found"));
  }
  const _tasks = [...current.tasks];
  const tasksData = /* @__PURE__ */ new Map();
  const _statues = /* @__PURE__ */ new Set();
  const hasUpdates = await createTaskTypes(tasks, projectType, client, _statues, tasksData, _tasks, true);
  if (hasUpdates) {
    const ttypes = await client.findAll(import__.default.class.TaskType, { _id: { $in: _tasks } });
    const newStatuses = calculateStatuses(
      {
        statuses: current.statuses,
        tasks: _tasks
      },
      new Map(ttypes.map((it) => [it._id, it])),
      []
    );
    await client.update(current, {
      tasks: _tasks,
      statuses: newStatuses
    });
  }
}
__name(updateProjectType, "updateProjectType");
async function createTaskTypes(tasks, _id, client, _statues, tasksData, _tasks, skipExisting) {
  const existingTaskTypes = await client.findAll(import__.default.class.TaskType, { parent: _id });
  let hasUpdates = false;
  for (const it of tasks) {
    const { factory, _id: taskId, ...data } = it;
    if (skipExisting) {
      const existingOne = existingTaskTypes.find((tt) => tt.ofClass === data.ofClass);
      if (existingOne !== void 0) {
        continue;
      }
    }
    hasUpdates = true;
    const statuses = await createStates(client, factory, data.statusClass);
    for (const st of statuses) {
      _statues.add(st);
    }
    const tdata = {
      ...data,
      parent: _id,
      statuses
    };
    const ofClassClass = client.getHierarchy().getClass(data.ofClass);
    tdata.icon = ofClassClass.icon;
    if (tdata.targetClass === void 0) {
      const targetClassId = `${taskId}:type:mixin`;
      tdata.targetClass = targetClassId;
      await client.createDoc(
        import_core.default.class.Mixin,
        import_core.default.space.Model,
        {
          extends: data.ofClass,
          kind: import_core.ClassifierKind.MIXIN,
          label: ofClassClass.label,
          icon: ofClassClass.icon
        },
        targetClassId
      );
      await client.createMixin(targetClassId, import_core.default.class.Mixin, import_core.default.space.Model, import__.default.mixin.TaskTypeClass, {
        taskType: taskId,
        projectType: _id
      });
    }
    await client.createDoc(import__.default.class.TaskType, import_core.default.space.Model, tdata, taskId);
    tasksData.set(taskId, tdata);
    _tasks.push(taskId);
  }
  return hasUpdates;
}
__name(createTaskTypes, "createTaskTypes");
//# sourceMappingURL=utils.js.map
