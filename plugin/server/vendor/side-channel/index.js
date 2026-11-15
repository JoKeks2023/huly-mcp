'use strict';

var $TypeError = require('../es-errors/type.js');
var inspect = require('../object-inspect/index.js');
var getSideChannelList = require('../side-channel-list/index.js');
var getSideChannelMap = require('../side-channel-map/index.js');
var getSideChannelWeakMap = require('../side-channel-weakmap/index.js');

var makeChannel = getSideChannelWeakMap || getSideChannelMap || getSideChannelList;

/** @type {import('./index.js')} */
module.exports = function getSideChannel() {
	/** @typedef {ReturnType<typeof getSideChannel>} Channel */

	/** @type {Channel | undefined} */ var $channelData;

	/** @type {Channel} */
	var channel = {
		assert: function (key) {
			if (!channel.has(key)) {
				var keyDesc = key && Object(key) === key
					? 'the given object key'
					: inspect(key);
				throw new $TypeError('Side channel does not contain ' + keyDesc);
			}
		},
		'delete': function (key) {
			return !!$channelData && $channelData['delete'](key);
		},
		get: function (key) {
			return $channelData && $channelData.get(key);
		},
		has: function (key) {
			return !!$channelData && $channelData.has(key);
		},
		set: function (key, value) {
			if (!$channelData) {
				$channelData = makeChannel();
			}

			$channelData.set(key, value);
		}
	};

	return channel;
};
