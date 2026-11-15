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
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var index_exports = {};
__export(index_exports, {
  AvatarType: () => AvatarType,
  contactId: () => contactId,
  contactPlugin: () => contactPlugin,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_platform = require("../../platform/lib/index.js");
__reExport(index_exports, require("./types.js"), module.exports);
__reExport(index_exports, require("./utils.js"), module.exports);
__reExport(index_exports, require("./analytics.js"), module.exports);
__reExport(index_exports, require("./avatar.js"), module.exports);
var AvatarType = /* @__PURE__ */ ((AvatarType2) => {
  AvatarType2["COLOR"] = "color";
  AvatarType2["IMAGE"] = "image";
  AvatarType2["GRAVATAR"] = "gravatar";
  AvatarType2["EXTERNAL"] = "external";
  return AvatarType2;
})(AvatarType || {});
const contactId = "contact";
const contactPlugin = (0, import_platform.plugin)(contactId, {
  class: {
    AvatarProvider: "",
    ChannelProvider: "",
    SocialIdentityProvider: "",
    Channel: "",
    Contact: "",
    Person: "",
    Member: "",
    Organization: "",
    Status: "",
    ContactsTab: "",
    PersonSpace: "",
    SocialIdentity: "",
    UserProfile: "",
    UserRole: "",
    Translation: ""
  },
  mixin: {
    Employee: ""
  },
  component: {
    SocialEditor: "",
    CreateOrganization: "",
    CreatePerson: "",
    ChannelsPresenter: "",
    MembersPresenter: "",
    Avatar: "",
    AvatarRef: "",
    UserBoxList: "",
    ChannelPresenter: "",
    SpaceMembers: "",
    DeleteConfirmationPopup: "",
    PersonIdArrayEditor: "",
    AccountArrayEditor: "",
    PersonIcon: "",
    EditOrganizationPanel: "",
    CollaborationUserAvatar: "",
    CreateGuest: "",
    SpaceMembersEditor: "",
    ContactNamePresenter: "",
    PersonFilterValuePresenter: "",
    PersonIdFilter: "",
    AssigneePopup: "",
    EmployeePresenter: ""
  },
  channelProvider: {
    Email: "",
    Phone: "",
    LinkedIn: "",
    Twitter: "",
    Telegram: "",
    GitHub: "",
    Facebook: "",
    Homepage: "",
    Whatsapp: "",
    Skype: "",
    Profile: "",
    Viber: ""
  },
  socialIdentityProvider: {
    Huly: "",
    Email: "",
    Phone: "",
    Google: "",
    GitHub: "",
    Telegram: ""
  },
  avatarProvider: {
    Color: "",
    Image: "",
    Gravatar: ""
  },
  function: {
    GetColorUrl: "",
    GetFileUrl: "",
    GetGravatarUrl: "",
    GetExternalUrl: ""
  },
  icon: {
    ContactApplication: "",
    Phone: "",
    Email: "",
    Huly: "",
    Discord: "",
    Facebook: "",
    Instagram: "",
    LinkedIn: "",
    Telegram: "",
    Google: "",
    Twitter: "",
    VK: "",
    WhatsApp: "",
    Skype: "",
    Youtube: "",
    GitHub: "",
    Edit: "",
    Person: "",
    Persona: "",
    Company: "",
    SocialEdit: "",
    Homepage: "",
    Whatsapp: "",
    ComponentMembers: "",
    Profile: "",
    KickUser: "",
    Contacts: "",
    Viber: "",
    Clock: "",
    Chat: "",
    User: ""
  },
  image: {
    ProfileBackground: "",
    ProfileBackgroundLight: ""
  },
  space: {
    Contacts: ""
  },
  app: {
    Contacts: ""
  },
  metadata: {
    LastNameFirst: ""
  },
  string: {
    PersonAlreadyExists: "",
    Person: "",
    Employee: "",
    CreateOrganization: "",
    UseImage: "",
    UseGravatar: "",
    UseColor: "",
    PersonFirstNamePlaceholder: "",
    PersonLastNamePlaceholder: "",
    NumberMembers: "",
    Position: "",
    For: "",
    SelectUsers: "",
    AddGuest: "",
    Members: "",
    Contacts: "",
    Employees: "",
    Persons: "",
    ViewProfile: "",
    SocialId: "",
    SocialIds: "",
    Type: "",
    Confirmed: "",
    UserProfile: "",
    DeactivatedAccount: "",
    LocalTime: "",
    Everyone: "",
    Here: "",
    EveryoneDescription: "",
    HereDescription: "",
    Guest: "",
    Deleted: "",
    Email: ""
  },
  viewlet: {
    TableMember: "",
    TablePerson: "",
    TableEmployee: "",
    TableOrganization: "",
    TableUserProfile: ""
  },
  filter: {
    FilterChannelIn: "",
    FilterChannelNin: "",
    FilterChannelHasMessages: "",
    FilterChannelHasNewMessages: ""
  },
  resolver: {
    Location: ""
  },
  templateFieldCategory: {
    CurrentEmployee: "",
    Contact: ""
  },
  templateField: {
    CurrentEmployeeName: "",
    CurrentEmployeePosition: "",
    CurrentEmployeeEmail: "",
    ContactName: "",
    ContactFirstName: "",
    ContactLastName: ""
  },
  ids: {
    MentionCommonNotificationType: ""
  },
  mention: {
    Everyone: "",
    Here: ""
  },
  extension: {
    EmployeePopupActions: "",
    PersonAchievementsPresenter: ""
  },
  store: {
    Permissions: ""
  }
});
var index_default = contactPlugin;
//# sourceMappingURL=index.js.map
