"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const additionalItems_1 = require("./additionalItems.js");
const prefixItems_1 = require("./prefixItems.js");
const items_1 = require("./items.js");
const items2020_1 = require("./items2020.js");
const contains_1 = require("./contains.js");
const dependencies_1 = require("./dependencies.js");
const propertyNames_1 = require("./propertyNames.js");
const additionalProperties_1 = require("./additionalProperties.js");
const properties_1 = require("./properties.js");
const patternProperties_1 = require("./patternProperties.js");
const not_1 = require("./not.js");
const anyOf_1 = require("./anyOf.js");
const oneOf_1 = require("./oneOf.js");
const allOf_1 = require("./allOf.js");
const if_1 = require("./if.js");
const thenElse_1 = require("./thenElse.js");
function getApplicator(draft2020 = false) {
    const applicator = [
        // any
        not_1.default,
        anyOf_1.default,
        oneOf_1.default,
        allOf_1.default,
        if_1.default,
        thenElse_1.default,
        // object
        propertyNames_1.default,
        additionalProperties_1.default,
        dependencies_1.default,
        properties_1.default,
        patternProperties_1.default,
    ];
    // array
    if (draft2020)
        applicator.push(prefixItems_1.default, items2020_1.default);
    else
        applicator.push(additionalItems_1.default, items_1.default);
    applicator.push(contains_1.default);
    return applicator;
}
exports.default = getApplicator;
//# sourceMappingURL=index.js.map