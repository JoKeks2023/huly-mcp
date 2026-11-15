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
  chunterId: () => chunterId,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_platform = require("../../platform/lib/index.js");
__reExport(index_exports, require("./utils.js"), module.exports);
__reExport(index_exports, require("./analytics.js"), module.exports);
const chunterId = "chunter";
var index_default = (0, import_platform.plugin)(chunterId, {
  icon: {
    Chunter: "",
    Hashtag: "",
    Thread: "",
    Lock: "",
    ChannelBrowser: "",
    ChunterBrowser: "",
    Copy: "",
    Messages: "",
    Bookmarks: ""
  },
  component: {
    DmHeader: "",
    ThreadView: "",
    Thread: "",
    Reactions: "",
    ChatMessageInput: "",
    ChatMessagesPresenter: "",
    ChatMessagePresenter: "",
    ThreadMessagePresenter: "",
    ChatMessagePreview: "",
    ThreadMessagePreview: "",
    DirectIcon: "",
    InlineCommentThread: ""
  },
  activity: {
    MembersChangedMessage: ""
  },
  class: {
    ThreadMessage: "",
    ChunterSpace: "",
    Channel: "",
    DirectMessage: "",
    ChatMessage: "",
    ChatMessageViewlet: "",
    ChatSyncInfo: ""
  },
  mixin: {
    ObjectChatPanel: ""
  },
  string: {
    Reactions: "",
    EditUpdate: "",
    EditCancel: "",
    Comments: "",
    Settings: "",
    ArchiveChannel: "",
    UnarchiveChannel: "",
    ArchiveConfirm: "",
    Message: "",
    MessageOn: "",
    UnarchiveConfirm: "",
    ConvertToPrivate: "",
    DirectNotificationTitle: "",
    DirectNotificationBody: "",
    MessageNotificationBody: "",
    AddCommentPlaceholder: "",
    LeftComment: "",
    Docs: "",
    Chat: "",
    Thread: "",
    ThreadMessage: "",
    ReplyToThread: "",
    Channels: "",
    Direct: "",
    RepliedTo: "",
    AllChannels: "",
    AllContacts: "",
    NewChannel: "",
    TopicOptional: "",
    Visibility: "",
    Public: "",
    Private: "",
    NewDirectChat: "",
    AddMembers: "",
    CloseConversation: "",
    Starred: "",
    DeleteStarred: "",
    StarChannel: "",
    StarConversation: "",
    UnstarChannel: "",
    UnstarConversation: "",
    NoMessagesInChannel: "",
    SendMessagesInChannel: "",
    Joined: "",
    Left: "",
    Added: "",
    Removed: "",
    CreatedChannelOn: "",
    YouJoinedChannel: "",
    AndMore: "",
    IsTyping: "",
    ThreadIn: "",
    TranslateMessage: "",
    Translate: "",
    ShowOriginal: "",
    Translating: "",
    StartConversation: "",
    ViewingThreadFromArchivedChannel: "",
    ViewingArchivedChannel: "",
    OpenChatInSidebar: "",
    SummarizeMessages: ""
  },
  ids: {
    DMNotification: "",
    ThreadNotification: "",
    ChannelNotification: "",
    JoinChannelNotification: "",
    ThreadMessageViewlet: "",
    ChatWidget: ""
  },
  app: {
    Chunter: ""
  },
  action: {
    DeleteChatMessage: "",
    LeaveChannel: "",
    RemoveChannel: "",
    TranslateMessage: "",
    SummarizeMessages: "",
    ShowOriginalMessage: "",
    CloseConversation: ""
  },
  function: {
    CanTranslateMessage: "",
    CanSummarizeMessages: "",
    OpenThreadInSidebar: "",
    OpenChannelInSidebar: ""
  }
});
//# sourceMappingURL=index.js.map
