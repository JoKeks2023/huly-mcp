'use strict';

const createWebSocketStream = require('./lib/stream.js');
const extension = require('./lib/extension.js');
const PerMessageDeflate = require('./lib/permessage-deflate.js');
const Receiver = require('./lib/receiver.js');
const Sender = require('./lib/sender.js');
const subprotocol = require('./lib/subprotocol.js');
const WebSocket = require('./lib/websocket.js');
const WebSocketServer = require('./lib/websocket-server.js');

WebSocket.createWebSocketStream = createWebSocketStream;
WebSocket.extension = extension;
WebSocket.PerMessageDeflate = PerMessageDeflate;
WebSocket.Receiver = Receiver;
WebSocket.Sender = Sender;
WebSocket.Server = WebSocketServer;
WebSocket.subprotocol = subprotocol;
WebSocket.WebSocket = WebSocket;
WebSocket.WebSocketServer = WebSocketServer;

module.exports = WebSocket;
