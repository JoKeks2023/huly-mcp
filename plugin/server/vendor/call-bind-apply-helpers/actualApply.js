'use strict';

var bind = require('../function-bind/index.js');

var $apply = require('./functionApply.js');
var $call = require('./functionCall.js');
var $reflectApply = require('./reflectApply.js');

/** @type {import('./actualApply.js')} */
module.exports = $reflectApply || bind.call($call, $apply);
