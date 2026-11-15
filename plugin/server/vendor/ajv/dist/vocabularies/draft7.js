"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("./core/index.js");
const validation_1 = require("./validation/index.js");
const applicator_1 = require("./applicator/index.js");
const format_1 = require("./format/index.js");
const metadata_1 = require("./metadata.js");
const draft7Vocabularies = [
    core_1.default,
    validation_1.default,
    (0, applicator_1.default)(),
    format_1.default,
    metadata_1.metadataVocabulary,
    metadata_1.contentVocabulary,
];
exports.default = draft7Vocabularies;
//# sourceMappingURL=draft7.js.map