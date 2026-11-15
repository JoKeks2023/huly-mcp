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
  attachmentId: () => attachmentId,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_platform = require("../../platform/lib/index.js");
__reExport(index_exports, require("./analytics.js"), module.exports);
const attachmentId = "attachment";
var index_default = (0, import_platform.plugin)(attachmentId, {
  component: {
    Attachments: "",
    Photos: "",
    AttachmentsPresenter: "",
    DrawingPresenter: "",
    FileBrowser: "",
    PDFViewer: ""
  },
  icon: {
    Attachment: "",
    FileBrowser: ""
  },
  class: {
    Attachment: "",
    Embedding: "",
    Drawing: "",
    Photo: "",
    SavedAttachments: ""
  },
  helper: {
    UploadFile: "",
    DeleteFile: ""
  },
  ids: {
    PreviewWidget: ""
  },
  string: {
    UploadDropFilesHere: "",
    Files: "",
    NoFiles: "",
    NoParticipants: "",
    ShowMoreAttachments: "",
    FileBrowserDateFilterAny: "",
    FileBrowserDateFilterToday: "",
    FileBrowserDateFilterYesterday: "",
    FileBrowserDateFilter7Days: "",
    FileBrowserDateFilter30Days: "",
    FileBrowserDateFilter3Months: "",
    FileBrowserDateFilter12Months: "",
    FileBrowserTypeFilterAny: "",
    FileBrowserTypeFilterImages: "",
    FileBrowserTypeFilterAudio: "",
    FileBrowserTypeFilterVideos: "",
    FileBrowserTypeFilterPDFs: "",
    DeleteFile: "",
    Attachments: "",
    FileBrowser: "",
    OpenInWindow: "",
    Embeddings: ""
  }
});
//# sourceMappingURL=index.js.map
