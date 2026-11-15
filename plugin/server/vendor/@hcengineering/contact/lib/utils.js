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
  addEmployeeListenrer: () => addEmployeeListenrer,
  checkHasGravatar: () => checkHasGravatar,
  combineName: () => combineName,
  contactCache: () => contactCache,
  ensureEmployee: () => ensureEmployee,
  ensureEmployeeForPerson: () => ensureEmployeeForPerson,
  findContacts: () => findContacts,
  findPerson: () => findPerson,
  formatContactName: () => formatContactName,
  formatName: () => formatName,
  getAllAccounts: () => getAllAccounts,
  getAllSocialStringsByPersonId: () => getAllSocialStringsByPersonId,
  getAllSocialStringsByPersonRef: () => getAllSocialStringsByPersonRef,
  getAllUserAccounts: () => getAllUserAccounts,
  getAvatarColorForId: () => getAvatarColorForId,
  getAvatarColorName: () => getAvatarColorName,
  getAvatarColors: () => getAvatarColors,
  getAvatarProviderId: () => getAvatarProviderId,
  getCurrentEmployee: () => getCurrentEmployee,
  getCurrentEmployeeSpace: () => getCurrentEmployeeSpace,
  getEmployeeBySocialId: () => getEmployeeBySocialId,
  getFirstName: () => getFirstName,
  getGravatarUrl: () => getGravatarUrl,
  getLastName: () => getLastName,
  getName: () => getName,
  getPersonByPersonId: () => getPersonByPersonId,
  getPersonByPersonIdCb: () => getPersonByPersonIdCb,
  getPersonByPersonRef: () => getPersonByPersonRef,
  getPersonByPersonRefCb: () => getPersonByPersonRefCb,
  getPersonBySocialKey: () => getPersonBySocialKey,
  getPersonRefByPersonId: () => getPersonRefByPersonId,
  getPersonRefByPersonIdCb: () => getPersonRefByPersonIdCb,
  getPersonRefsByPersonIds: () => getPersonRefsByPersonIds,
  getPersonRefsByPersonIdsCb: () => getPersonRefsByPersonIdsCb,
  getPersonRefsBySocialIds: () => getPersonRefsBySocialIds,
  getPersonsByPersonIds: () => getPersonsByPersonIds,
  getPersonsByPersonIdsCb: () => getPersonsByPersonIdsCb,
  getPersonsByPersonRefs: () => getPersonsByPersonRefs,
  getPersonsByPersonRefsCb: () => getPersonsByPersonRefsCb,
  getPrimarySocialId: () => getPrimarySocialId,
  getSocialIdByPersonId: () => getSocialIdByPersonId,
  getSocialIdByPersonIdCb: () => getSocialIdByPersonIdCb,
  getSocialStringsByEmployee: () => getSocialStringsByEmployee,
  includesAny: () => includesAny,
  loadCachesForPersonId: () => loadCachesForPersonId,
  loadCachesForPersonIds: () => loadCachesForPersonIds,
  loadCachesForPersonRef: () => loadCachesForPersonRef,
  loadCachesForPersonRefs: () => loadCachesForPersonRefs,
  setCurrentEmployee: () => setCurrentEmployee,
  setCurrentEmployeeSpace: () => setCurrentEmployeeSpace
});
module.exports = __toCommonJS(utils_exports);
var import_core = require("../../core/lib/index.js");
var import_platform = require("../../platform/lib/index.js");
var import__ = __toESM(require("./index.js"));
var import_types = require("./types.js");
var import_cache = __toESM(require("./cache.js"));
let currentEmployee;
let currentEmployeeSpace;
const employeeListeners = [];
function getCurrentEmployee() {
  return currentEmployee;
}
__name(getCurrentEmployee, "getCurrentEmployee");
function getCurrentEmployeeSpace() {
  return currentEmployeeSpace;
}
__name(getCurrentEmployeeSpace, "getCurrentEmployeeSpace");
function addEmployeeListenrer(l) {
  employeeListeners.push(l);
}
__name(addEmployeeListenrer, "addEmployeeListenrer");
function setCurrentEmployee(employee) {
  currentEmployee = employee;
  for (const l of employeeListeners) {
    l(employee);
  }
}
__name(setCurrentEmployee, "setCurrentEmployee");
function setCurrentEmployeeSpace(space) {
  currentEmployeeSpace = space;
}
__name(setCurrentEmployeeSpace, "setCurrentEmployeeSpace");
function getAvatarColorForId(id) {
  if (id == null) return import_types.AVATAR_COLORS[0].color;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash += id.charCodeAt(i);
  }
  return import_types.AVATAR_COLORS[hash % import_types.AVATAR_COLORS.length].color;
}
__name(getAvatarColorForId, "getAvatarColorForId");
function getAvatarColors() {
  return import_types.AVATAR_COLORS;
}
__name(getAvatarColors, "getAvatarColors");
function getAvatarColorName(color) {
  return import_types.AVATAR_COLORS.find((col) => col.color === color)?.name ?? import_types.AVATAR_COLORS[0].name;
}
__name(getAvatarColorName, "getAvatarColorName");
function getAvatarProviderId(kind) {
  switch (kind) {
    case import__.AvatarType.GRAVATAR:
      return import__.default.avatarProvider.Gravatar;
    case import__.AvatarType.COLOR:
      return import__.default.avatarProvider.Color;
  }
  return import__.default.avatarProvider.Image;
}
__name(getAvatarProviderId, "getAvatarProviderId");
function getGravatarUrl(gravatarId, width = 64, placeholder = "identicon") {
  return `https://gravatar.com/avatar/${gravatarId}?s=${width}&d=${placeholder}`;
}
__name(getGravatarUrl, "getGravatarUrl");
async function checkHasGravatar(gravatarId, fetch) {
  try {
    return (await (fetch ?? window.fetch)(getGravatarUrl(gravatarId, 2048, "404"))).ok;
  } catch {
    return false;
  }
}
__name(checkHasGravatar, "checkHasGravatar");
async function findContacts(client, _class, name, channels) {
  if (channels.length === 0 && name.length === 0) {
    return { contacts: [], channels: [] };
  }
  const values = channels.map((it) => it.value);
  const potentialChannels = await client.findAll(import__.default.class.Channel, { value: { $in: values } }, { limit: 1e3 });
  let potentialContactIds = Array.from(new Set(potentialChannels.map((it) => it.attachedTo)).values());
  if (potentialContactIds.length === 0) {
    if (client.getHierarchy().isDerived(_class, import__.default.class.Person)) {
      const firstName = getFirstName(name).split(" ").shift() ?? "";
      const lastName = getLastName(name);
      potentialContactIds = (await client.findAll(import__.default.class.Contact, { name: { $like: `${lastName}%${firstName}%` } }, { limit: 100 })).map((it) => it._id);
      if (potentialContactIds.length === 0) {
        return { contacts: [], channels: [] };
      }
    } else if (client.getHierarchy().isDerived(_class, import__.default.class.Organization)) {
      potentialContactIds = (await client.findAll(import__.default.class.Contact, { name: { $like: `${name}` } }, { limit: 100 })).map((it) => it._id);
      if (potentialContactIds.length === 0) {
        return { contacts: [], channels: [] };
      }
    }
  }
  const potentialPersons = await client.findAll(
    import__.default.class.Contact,
    { _id: { $in: potentialContactIds } },
    {
      lookup: {
        _id: {
          channels: import__.default.class.Channel
        }
      }
    }
  );
  const result = [];
  const resChannels = [];
  for (const c of potentialPersons) {
    let matches = 0;
    if (c.name === name) {
      matches++;
    }
    for (const ch of c.$lookup?.channels ?? []) {
      for (const chc of channels) {
        if (chc.provider === ch.provider && chc.value === ch.value.trim()) {
          resChannels.push(chc);
          matches += 2;
          break;
        }
      }
    }
    if (matches > 0) {
      result.push(c);
    }
  }
  return { contacts: result, channels: resChannels };
}
__name(findContacts, "findContacts");
async function findPerson(client, name, channels) {
  const result = await findContacts(client, import__.default.class.Person, name, channels);
  return result.contacts;
}
__name(findPerson, "findPerson");
const SEP = ",";
function combineName(first, last) {
  return (last ?? "") + SEP + (first ?? "");
}
__name(combineName, "combineName");
function getFirstName(name) {
  return name !== void 0 ? name.substring(name.indexOf(SEP) + 1) : "";
}
__name(getFirstName, "getFirstName");
function getLastName(name) {
  return name !== void 0 ? name.substring(0, name.indexOf(SEP)) : "";
}
__name(getLastName, "getLastName");
function formatName(name, lastNameFirst) {
  const lastNameFirstCombined = lastNameFirst !== void 0 ? lastNameFirst === "true" : (0, import_platform.getMetadata)(import__.default.metadata.LastNameFirst) === true;
  return lastNameFirstCombined ? getLastName(name) + " " + getFirstName(name) : getFirstName(name) + " " + getLastName(name);
}
__name(formatName, "formatName");
function getName(hierarchy, value, lastNameFirst) {
  if (isPerson(hierarchy, value)) {
    return formatName(value.name, lastNameFirst);
  }
  return value.name;
}
__name(getName, "getName");
function isPerson(hierarchy, value) {
  return isPersonClass(hierarchy, value._class);
}
__name(isPerson, "isPerson");
function isPersonClass(hierarchy, _class) {
  return hierarchy.isDerived(_class, import__.default.class.Person);
}
__name(isPersonClass, "isPersonClass");
function formatContactName(hierarchy, _class, name, lastNameFirst) {
  if (isPersonClass(hierarchy, _class)) {
    return formatName(name, lastNameFirst);
  }
  return name;
}
__name(formatContactName, "formatContactName");
function includesAny(members, ids) {
  return members.some((m) => ids.includes(m));
}
__name(includesAny, "includesAny");
async function getPersonBySocialKey(client, socialKey) {
  const socialId = await client.findOne(import__.default.class.SocialIdentity, { key: socialKey });
  if (socialId === void 0) return void 0;
  return await client.findOne(import__.default.class.Person, { _id: socialId?.attachedTo, _class: socialId?.attachedToClass });
}
__name(getPersonBySocialKey, "getPersonBySocialKey");
async function getEmployeeBySocialId(client, socialIdString) {
  const socialId = await client.findOne(import__.default.class.SocialIdentity, { _id: socialIdString });
  if (socialId === void 0) return void 0;
  return await client.findOne(import__.default.mixin.Employee, { _id: socialId.attachedTo });
}
__name(getEmployeeBySocialId, "getEmployeeBySocialId");
async function getPersonRefsBySocialIds(client, ids = []) {
  const socialIds = await client.findAll(
    import__.default.class.SocialIdentity,
    ids.length === 0 ? {} : { _id: { $in: ids } }
  );
  const result = {};
  for (const socialId of socialIds) {
    result[socialId._id] = socialId.attachedTo;
  }
  return result;
}
__name(getPersonRefsBySocialIds, "getPersonRefsBySocialIds");
async function getPrimarySocialId(client, person) {
  const socialIds = await client.findAll(import__.default.class.SocialIdentity, { attachedTo: person, verifiedOn: { $gt: 0 } });
  if (socialIds.length === 0) {
    return;
  }
  return (0, import_core.pickPrimarySocialId)(socialIds)._id;
}
__name(getPrimarySocialId, "getPrimarySocialId");
async function getAllSocialStringsByPersonId(client, personId) {
  const socialId = await client.findOne(import__.default.class.SocialIdentity, {
    _id: personId,
    attachedToClass: import__.default.class.Person
  });
  if (socialId === void 0) {
    return [];
  }
  const socialIds = await client.findAll(import__.default.class.SocialIdentity, { attachedTo: socialId.attachedTo });
  return socialIds.map((it) => it._id);
}
__name(getAllSocialStringsByPersonId, "getAllSocialStringsByPersonId");
async function getAllSocialStringsByPersonRef(client, person) {
  const socialIds = await client.findAll(import__.default.class.SocialIdentity, { attachedTo: person });
  return socialIds.map((it) => it._id);
}
__name(getAllSocialStringsByPersonRef, "getAllSocialStringsByPersonRef");
async function getSocialStringsByEmployee(client) {
  const employees = await client.findAll(import__.default.mixin.Employee, { active: true });
  const socialIds = await client.findAll(import__.default.class.SocialIdentity, {
    attachedTo: { $in: employees.map((it) => it._id) },
    attachedToClass: import__.default.class.Person
  });
  const socialStringsByPerson = {};
  for (const socialId of socialIds) {
    const socialStrings = socialStringsByPerson[socialId.attachedTo];
    if (socialStrings === void 0) {
      socialStringsByPerson[socialId.attachedTo] = [];
    }
    socialStrings.push(socialId._id);
  }
  return socialStringsByPerson;
}
__name(getSocialStringsByEmployee, "getSocialStringsByEmployee");
async function getAllAccounts(client) {
  const employees = await client.findAll(import__.default.mixin.Employee, { active: true });
  return employees.map((it) => it.personUuid).filter(import_core.notEmpty);
}
__name(getAllAccounts, "getAllAccounts");
async function getAllUserAccounts(client) {
  const employees = await client.findAll(import__.default.mixin.Employee, { active: true });
  return employees.map((it) => it.personUuid).filter(import_core.notEmpty);
}
__name(getAllUserAccounts, "getAllUserAccounts");
async function ensureEmployee(ctx, me, client, socialIds, getGlobalPerson) {
  const globalPerson = await getGlobalPerson();
  return await ensureEmployeeForPerson(ctx, me, me, client, socialIds, globalPerson);
}
__name(ensureEmployee, "ensureEmployee");
async function ensureEmployeeForPerson(ctx, me, person, client, socialIds, globalPerson) {
  const txFactory = new import_core.TxFactory(me.primarySocialId);
  const personByUuid = await client.findOne(import__.default.class.Person, { personUuid: person.uuid });
  let personRef = personByUuid?._id;
  if (personRef === void 0) {
    const socialIdentity = await client.findOne(import__.default.class.SocialIdentity, {
      _id: { $in: person.socialIds }
    });
    personRef = socialIdentity?.attachedTo;
  }
  if (personRef === void 0) {
    await ctx.with("create-person", {}, async () => {
      if (globalPerson === void 0) {
        console.error("Cannot get global person");
        return null;
      }
      const data = {
        personUuid: person.uuid,
        name: combineName(globalPerson.firstName, globalPerson.lastName),
        city: globalPerson.city,
        avatarType: import__.AvatarType.COLOR
      };
      personRef = (0, import_core.generateId)();
      const createPersonTx = txFactory.createTxCreateDoc(import__.default.class.Person, import__.default.space.Contacts, data, personRef);
      await client.tx(createPersonTx);
    });
  } else if (personByUuid === void 0) {
    const updatePersonTx = txFactory.createTxUpdateDoc(import__.default.class.Person, import__.default.space.Contacts, personRef, {
      personUuid: person.uuid
    });
    await client.tx(updatePersonTx);
  }
  const existingIdentifiers = (0, import_core.toIdMap)(
    await client.findAll(import__.default.class.SocialIdentity, { _id: { $in: person.socialIds } })
  );
  for (const socialId of socialIds) {
    const existing = existingIdentifiers.get(socialId._id);
    if (existing == null) {
      await ctx.with("create-social-identity", {}, async () => {
        if (personRef === void 0) {
          console.error("Person not found");
          return null;
        }
        const createSocialIdTx = txFactory.createTxCollectionCUD(
          import__.default.class.Person,
          personRef,
          import__.default.space.Contacts,
          "socialIds",
          txFactory.createTxCreateDoc(
            import__.default.class.SocialIdentity,
            import__.default.space.Contacts,
            {
              attachedTo: personRef,
              attachedToClass: import__.default.class.Person,
              collection: "socialIds",
              type: socialId.type,
              value: socialId.value,
              key: (0, import_core.buildSocialIdString)(socialId),
              // TODO: fill it in trigger or on DB level as stored calculated column or smth?
              verifiedOn: socialId.verifiedOn,
              isDeleted: socialId.isDeleted
            },
            socialId._id
          )
        );
        await client.tx(createSocialIdTx);
      });
    } else {
      if (existing.verifiedOn != null && existing.attachedTo !== personRef) {
        throw new Error("Confirmed social identity is attached to the wrong person");
      }
      const sidUpdate = {};
      let needUpdate = false;
      if (existing.verifiedOn == null) {
        sidUpdate.verifiedOn = socialId.verifiedOn;
        needUpdate = true;
      }
      if (existing.attachedTo !== personRef) {
        sidUpdate.attachedTo = personRef;
        needUpdate = true;
      }
      if (existing.isDeleted !== socialId.isDeleted && socialId.isDeleted === true) {
        sidUpdate.value = socialId.value;
        sidUpdate.key = socialId.key;
        sidUpdate.isDeleted = socialId.isDeleted;
        needUpdate = true;
      }
      if (needUpdate) {
        const updateSocialIdentityTx = txFactory.createTxUpdateDoc(
          import__.default.class.SocialIdentity,
          import__.default.space.Contacts,
          existing._id,
          sidUpdate
        );
        await client.tx(updateSocialIdentityTx);
      }
    }
  }
  const employeeRole = person.role === import_core.AccountRole.Guest || person.role === import_core.AccountRole.ReadOnlyGuest ? "GUEST" : "USER";
  const employee = await client.findOne(import__.default.mixin.Employee, { _id: personRef });
  if (employee === void 0 || !import_core.Hierarchy.hasMixin(employee, import__.default.mixin.Employee) || !employee.active || employee.role !== employeeRole) {
    await ctx.with("create-employee", {}, async () => {
      if (personRef === void 0) {
        console.error("Person not found");
        return null;
      }
      const createEmployeeTx = txFactory.createTxMixin(
        personRef,
        import__.default.class.Person,
        import__.default.space.Contacts,
        import__.default.mixin.Employee,
        {
          active: true,
          role: employeeRole
        }
      );
      await client.tx(createEmployeeTx);
    });
  }
  return personRef;
}
__name(ensureEmployeeForPerson, "ensureEmployeeForPerson");
const contactCache = import_cache.default.instance;
async function loadCachesForPersonId(client, personId) {
  if (personId == null || personId === "") return;
  const sidObj = await client.findOne(
    import__.default.class.SocialIdentity,
    {
      _id: personId
    },
    {
      lookup: {
        attachedTo: import__.default.class.Person
      }
    }
  );
  contactCache.fillCachesForPersonId(personId, sidObj);
}
__name(loadCachesForPersonId, "loadCachesForPersonId");
async function loadCachesForPersonIds(client, personIds) {
  const sidObjsMap = (0, import_core.toIdMap)(
    await client.findAll(
      import__.default.class.SocialIdentity,
      {
        _id: { $in: personIds }
      },
      {
        lookup: {
          attachedTo: import__.default.class.Person
        }
      }
    )
  );
  for (const personId of personIds) {
    const sidObj = sidObjsMap.get(personId);
    contactCache.fillCachesForPersonId(personId, sidObj);
  }
}
__name(loadCachesForPersonIds, "loadCachesForPersonIds");
async function loadCachesForPersonRef(client, personRef) {
  const person = await client.findOne(
    import__.default.class.Person,
    {
      _id: personRef
    },
    {
      lookup: {
        _id: { socialIds: import__.default.class.SocialIdentity }
      }
    }
  );
  contactCache.fillCachesForPersonRef(personRef, person);
}
__name(loadCachesForPersonRef, "loadCachesForPersonRef");
async function loadCachesForPersonRefs(client, personRefs) {
  const persons = (0, import_core.toIdMap)(
    await client.findAll(
      import__.default.class.Person,
      {
        _id: { $in: personRefs }
      },
      {
        lookup: {
          _id: { socialIds: import__.default.class.SocialIdentity }
        }
      }
    )
  );
  for (const personRef of personRefs) {
    const person = persons.get(personRef);
    contactCache.fillCachesForPersonRef(personRef, person);
  }
}
__name(loadCachesForPersonRefs, "loadCachesForPersonRefs");
async function getPersonRefByPersonId(client, personId) {
  if (!contactCache.personRefByPersonId.has(personId)) {
    await loadCachesForPersonId(client, personId);
  }
  return contactCache.personRefByPersonId.get(personId) ?? null;
}
__name(getPersonRefByPersonId, "getPersonRefByPersonId");
function getPersonRefByPersonIdCb(client, personId, cb) {
  let personRef = contactCache.personRefByPersonId.get(personId);
  if (personRef !== void 0) {
    cb(personRef);
  } else {
    void loadCachesForPersonId(client, personId).then(() => {
      personRef = contactCache.personRefByPersonId.get(personId);
      cb(personRef ?? null);
    });
  }
}
__name(getPersonRefByPersonIdCb, "getPersonRefByPersonIdCb");
function getPersonRefsByPersonIdsFromCache(personIds) {
  return new Map(
    personIds.map((pid) => {
      const ref = contactCache.personRefByPersonId.get(pid);
      return ref != null ? [pid, ref] : void 0;
    }).filter(import_core.notEmpty)
  );
}
__name(getPersonRefsByPersonIdsFromCache, "getPersonRefsByPersonIdsFromCache");
async function getPersonRefsByPersonIds(client, personIds) {
  if (personIds.some((personId) => !contactCache.personRefByPersonId.has(personId))) {
    await loadCachesForPersonIds(client, personIds);
  }
  return getPersonRefsByPersonIdsFromCache(personIds);
}
__name(getPersonRefsByPersonIds, "getPersonRefsByPersonIds");
function getPersonRefsByPersonIdsCb(client, personIds, cb) {
  if (personIds.some((personId) => !contactCache.personRefByPersonId.has(personId))) {
    void loadCachesForPersonIds(client, personIds).then(() => {
      const personRefs = getPersonRefsByPersonIdsFromCache(personIds);
      cb(personRefs);
    });
  } else {
    const personRefs = getPersonRefsByPersonIdsFromCache(personIds);
    cb(personRefs);
  }
}
__name(getPersonRefsByPersonIdsCb, "getPersonRefsByPersonIdsCb");
async function getPersonByPersonId(client, personId) {
  if (!contactCache.personByPersonId.has(personId)) {
    await loadCachesForPersonId(client, personId);
  }
  return contactCache.personByPersonId.get(personId) ?? null;
}
__name(getPersonByPersonId, "getPersonByPersonId");
function getPersonByPersonIdCb(client, personId, cb) {
  let person = contactCache.personByPersonId.get(personId);
  if (person !== void 0) {
    cb(person);
  } else {
    void loadCachesForPersonId(client, personId).then(() => {
      person = contactCache.personByPersonId.get(personId) ?? null;
      cb(person ?? null);
    });
  }
}
__name(getPersonByPersonIdCb, "getPersonByPersonIdCb");
function getPersonsByPersonIdsFromCache(personIds) {
  return new Map(
    personIds.map((pid) => {
      const person = contactCache.personByPersonId.get(pid);
      return person != null ? [pid, person] : void 0;
    }).filter(import_core.notEmpty)
  );
}
__name(getPersonsByPersonIdsFromCache, "getPersonsByPersonIdsFromCache");
async function getPersonsByPersonIds(client, personIds) {
  if (personIds.some((personId) => !contactCache.personByPersonId.has(personId))) {
    await loadCachesForPersonIds(client, personIds);
  }
  return getPersonsByPersonIdsFromCache(personIds);
}
__name(getPersonsByPersonIds, "getPersonsByPersonIds");
function getPersonsByPersonIdsCb(client, personIds, cb) {
  if (personIds.some((personId) => !contactCache.personByPersonId.has(personId))) {
    void loadCachesForPersonIds(client, personIds).then(() => {
      const persons = getPersonsByPersonIdsFromCache(personIds);
      cb(persons);
    });
  } else {
    const persons = getPersonsByPersonIdsFromCache(personIds);
    cb(persons);
  }
}
__name(getPersonsByPersonIdsCb, "getPersonsByPersonIdsCb");
async function getPersonByPersonRef(client, personRef) {
  if (!contactCache.personByRef.has(personRef)) {
    await loadCachesForPersonRef(client, personRef);
  }
  return contactCache.personByRef.get(personRef) ?? null;
}
__name(getPersonByPersonRef, "getPersonByPersonRef");
function getPersonByPersonRefCb(client, personRef, cb) {
  let person = contactCache.personByRef.get(personRef);
  if (person !== void 0) {
    cb(person);
  } else {
    void loadCachesForPersonRef(client, personRef).then(() => {
      person = contactCache.personByRef.get(personRef) ?? null;
      cb(person ?? null);
    });
  }
}
__name(getPersonByPersonRefCb, "getPersonByPersonRefCb");
function getPersonsByPersonRefsFromCache(personRefs) {
  return new Map(
    personRefs.map((personRef) => {
      const person = contactCache.personByRef.get(personRef);
      return person != null ? [personRef, person] : void 0;
    }).filter(import_core.notEmpty)
  );
}
__name(getPersonsByPersonRefsFromCache, "getPersonsByPersonRefsFromCache");
async function getPersonsByPersonRefs(client, personRefs) {
  if (personRefs.some((personRef) => !contactCache.personByRef.has(personRef))) {
    await loadCachesForPersonRefs(client, personRefs);
  }
  return getPersonsByPersonRefsFromCache(personRefs);
}
__name(getPersonsByPersonRefs, "getPersonsByPersonRefs");
function getPersonsByPersonRefsCb(client, personRefs, cb) {
  if (personRefs.some((personRef) => !contactCache.personByRef.has(personRef))) {
    void loadCachesForPersonRefs(client, personRefs).then(() => {
      const persons = getPersonsByPersonRefsFromCache(personRefs);
      cb(persons);
    });
  } else {
    const persons = getPersonsByPersonRefsFromCache(personRefs);
    cb(persons);
  }
}
__name(getPersonsByPersonRefsCb, "getPersonsByPersonRefsCb");
async function getSocialIdByPersonId(client, personId) {
  if (!contactCache.personRefByPersonId.has(personId)) {
    await loadCachesForPersonId(client, personId);
  }
  return contactCache.socialIdByPersonId.get(personId) ?? null;
}
__name(getSocialIdByPersonId, "getSocialIdByPersonId");
function getSocialIdByPersonIdCb(client, personId, cb) {
  let socialId = contactCache.socialIdByPersonId.get(personId);
  if (socialId !== void 0) {
    cb(socialId);
  } else {
    void loadCachesForPersonId(client, personId).then(() => {
      socialId = contactCache.socialIdByPersonId.get(personId) ?? null;
      cb(socialId ?? null);
    });
  }
}
__name(getSocialIdByPersonIdCb, "getSocialIdByPersonIdCb");
//# sourceMappingURL=utils.js.map
