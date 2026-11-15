'use strict';

/** @type {import('./index.js')} */
var $gOPD = require('./gOPD.js');

if ($gOPD) {
	try {
		$gOPD([], 'length');
	} catch (e) {
		// IE 8 has a broken gOPD
		$gOPD = null;
	}
}

module.exports = $gOPD;
