"use strict"

var mergeModules = require("../lib/helpers/merge-exports.js")

// Update this array if you add/rename/remove files in this directory.
// We support Browserify by skipping automatic module discovery and requiring modules directly.
var modules = [
  require("./internal.js"),
  require("./utf32.js"),
  require("./utf16.js"),
  require("./utf7.js"),
  require("./sbcs-codec.js"),
  require("./sbcs-data.js"),
  require("./sbcs-data-generated.js"),
  require("./dbcs-codec.js"),
  require("./dbcs-data.js")
]

// Put all encoding/alias/codec definitions to single object and export it.
for (var i = 0; i < modules.length; i++) {
  var module = modules[i]
  mergeModules(exports, module)
}
