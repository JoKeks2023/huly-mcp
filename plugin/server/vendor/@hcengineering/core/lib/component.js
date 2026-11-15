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
var component_exports = {};
__export(component_exports, {
  configUserAccountUuid: () => configUserAccountUuid,
  coreId: () => coreId,
  default: () => component_default,
  readOnlyGuestAccountUuid: () => readOnlyGuestAccountUuid,
  systemAccount: () => systemAccount,
  systemAccountEmail: () => systemAccountEmail,
  systemAccountUuid: () => systemAccountUuid
});
module.exports = __toCommonJS(component_exports);
var import_platform = require("../../platform/lib/index.js");
var import_classes = require("./classes.js");
const coreId = "core";
const systemAccountEmail = "anticrm@hc.engineering";
const systemAccountUuid = "1749089e-22e6-48de-af4e-165e18fbd2f9";
const systemAccount = {
  uuid: systemAccountUuid,
  role: import_classes.AccountRole.Owner,
  primarySocialId: "",
  socialIds: [],
  fullSocialIds: []
};
const configUserAccountUuid = "0d94731c-0787-4bcd-aefe-304efc3706b1";
const readOnlyGuestAccountUuid = "83bbed9a-0867-4851-be32-31d49d1d42ce";
var component_default = (0, import_platform.plugin)(coreId, {
  class: {
    Obj: "",
    Doc: "",
    Blob: "",
    AttachedDoc: "",
    Class: "",
    Mixin: "",
    Interface: "",
    Attribute: "",
    Tx: "",
    TxModelUpgrade: "",
    TxWorkspaceEvent: "",
    TxDomainEvent: "",
    TxApplyIf: "",
    TxCUD: "",
    TxCreateDoc: "",
    TxMixin: "",
    TxUpdateDoc: "",
    TxRemoveDoc: "",
    Space: "",
    SystemSpace: "",
    TypedSpace: "",
    SpaceTypeDescriptor: "",
    SpaceType: "",
    Role: "",
    Permission: "",
    AttributePermission: "",
    ClassPermission: "",
    Type: "",
    TypeRelation: "",
    TypeString: "",
    TypeBlob: "",
    TypeIntlString: "",
    TypeHyperlink: "",
    TypeNumber: "",
    TypeFileSize: "",
    TypeMarkup: "",
    TypeRank: "",
    TypeRecord: "",
    TypeBoolean: "",
    TypeTimestamp: "",
    TypeDate: "",
    TypeCollaborativeDoc: "",
    TypePersonId: "",
    TypeAccountUuid: "",
    TypeIdentifier: "",
    RefTo: "",
    ArrOf: "",
    Enum: "",
    EnumOf: "",
    Collection: "",
    TypeAny: "",
    Version: "",
    PluginConfiguration: "",
    UserStatus: "",
    TypeRelatedDocument: "",
    DomainIndexConfiguration: "",
    Configuration: "",
    Status: "",
    StatusCategory: "",
    MigrationState: "",
    BenchmarkDoc: "",
    FullTextSearchContext: "",
    Association: "",
    Relation: "",
    Sequence: "",
    CustomSequence: "",
    ClassCollaborators: "",
    Collaborator: ""
  },
  icon: {
    TypeString: "",
    TypeBlob: "",
    TypeHyperlink: "",
    TypeNumber: "",
    TypeMarkup: "",
    TypeRank: "",
    TypeRecord: "",
    TypeBoolean: "",
    TypeDate: "",
    TypeRef: "",
    TypeArray: "",
    TypeEnumOf: "",
    TypeCollection: ""
  },
  mixin: {
    ConfigurationElement: "",
    IndexConfiguration: "",
    SpacesTypeData: "",
    TransientConfiguration: "",
    TxAccessLevel: "",
    VersionableClass: ""
  },
  space: {
    Tx: "",
    DerivedTx: "",
    Model: "",
    Space: "",
    Configuration: "",
    Workspace: "",
    Domain: ""
  },
  employee: {
    System: ""
    // An system employee reference.
  },
  account: {
    System: "",
    ConfigUser: ""
  },
  status: {
    ObjectNotFound: "",
    ItemNotFound: ""
  },
  version: {
    Model: ""
  },
  string: {
    Id: "",
    Space: "",
    Spaces: "",
    SpacesDescription: "",
    TypedSpace: "",
    SpaceType: "",
    Modified: "",
    ModifiedDate: "",
    ModifiedBy: "",
    Class: "",
    AttachedTo: "",
    AttachedToClass: "",
    String: "",
    Record: "",
    Markup: "",
    Relation: "",
    Relations: "",
    AddRelation: "",
    Collaborative: "",
    CollaborativeDoc: "",
    MarkupBlobRef: "",
    PersonId: "",
    AccountId: "",
    Number: "",
    Boolean: "",
    Timestamp: "",
    Date: "",
    IntlString: "",
    Ref: "",
    Collection: "",
    Array: "",
    Name: "",
    Enum: "",
    Size: "",
    Description: "",
    ShortDescription: "",
    Descriptor: "",
    TargetClass: "",
    Role: "",
    Roles: "",
    Hyperlink: "",
    Private: "",
    Object: "",
    System: "",
    CreatedBy: "",
    CreatedDate: "",
    Status: "",
    Account: "",
    StatusCategory: "",
    Rank: "",
    Members: "",
    Owners: "",
    Permission: "",
    CreateObject: "",
    UpdateObject: "",
    DeleteObject: "",
    ForbidDeleteObject: "",
    UpdateSpace: "",
    ArchiveSpace: "",
    CreateObjectDescription: "",
    UpdateObjectDescription: "",
    DeleteObjectDescription: "",
    ForbidDeleteObjectDescription: "",
    UpdateSpaceDescription: "",
    ArchiveSpaceDescription: "",
    AutoJoin: "",
    AutoJoinDescr: "",
    RBAC: "",
    RBACDescr: "",
    Version: ""
  },
  descriptor: {
    SpacesType: ""
  },
  spaceType: {
    SpacesType: ""
  },
  permission: {
    CreateObject: "",
    UpdateObject: "",
    DeleteObject: "",
    ForbidDeleteObject: "",
    UpdateSpace: "",
    ArchiveSpace: ""
  },
  role: {
    Admin: ""
  },
  metadata: {
    DisablePermissions: ""
  }
});
//# sourceMappingURL=component.js.map
