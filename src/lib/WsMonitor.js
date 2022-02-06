'use strict';

import { EventEmitter } from 'events';
const WebSocket = require('ws');

export class WsMonitor extends EventEmitter {
  /** Create a new web socket client instance.
      * @param {object} params - Parameters.
      * @param {string} [params.url='localhost:443'] - IP address or hostname
      * and port of the web socket server.
      * * @param {string} [params.headers='']
      * @param {integer} [params.retryTime=10] - Time (in seconds) to try and
      * reconnect when the server connection has been closed.
      * @param {boolean} [params.raw=false] - Issue raw events instead of parsing
      * them.<br>
      * When specified, {@link WsMonitor#event:notification notification}
      * events are emitted, in lieu of {@link WsMonitor#event:changed changed},
      * {@link WsMonitor#event:added added}, and
      * {@link WsMonitor#event:sceneRecall sceneRecall} events.
      */
  constructor(log, weback, params = {}) {
    super();
    this.log = log;
    this.weback = weback;
    this._options = {
      retryTime: params.retryTime,
    };
  }

  getUpdate(device) {
    const payload = {
      'opt': 'thing_status_get',
      'sub_type': device.sub_type,
      'thing_name': device.thing_name,
    };
    this.send(payload);
  }

  send(payload) {
    try {
      this.log.debug('sending ...');
      this.log.debug('Websocket readyState: ', this.ws.readyState);
      this.ws.send(JSON.stringify(payload));
    } catch (error) {
      this.log.debug(error);
    }
  }

  /** Listen for web socket notifications.
      */
  async listen() {
    this.weback_data = await this.weback.getData();

    const url = this.weback_data.data.wss_url;
    //const auth = 'Basic ' + new Buffer.from('user' + ':' + 'pass').toString('base64');
    const headers = {
      Authorization: 'Basic KG51bGwpOihudWxsKQ==',
      region: this.weback_data.data.region_name,
      token: this.weback_data.data.jwt_token,
      Connection: 'keep-alive, Upgrade',
      handshakeTimeout: 10000,
    };

    this.timeout;
    this.ws = new WebSocket(url, null, { headers: headers });
    //this.log.debug(this.ws._req._headers);
    this.ws
      .on('error', (error) => {
        /** Emitted on error.
                  * @event WsMonitor#error
                  * @param {Error} error - The error.
                  */
        this.emit('error', error);
      })
      .on('open', () => {
        /** Emitted when connection to web socket server is opened.
                  * @event WsMonitor#listening
                  * @param {string} url - The URL of the web socket server.
                  */
        this.ws.ping();
        this.emit('listening', url);
      })
      .on('upgrade', (response) => {
        //this.log.debug(response.rawHeaders);
      })
      .on('ping', (data) => {
        this.log.debug('ping', data.toString());
      })
      .on('pong', (data) => {
        this.log.debug('pong', data.toString());
      })
      .on('message', (data, flags) => {
        clearTimeout(this.timeout);
        //this.log.debug(data);
        try {
          const obj = JSON.parse(data.toString());

          /** Emitted when an unknown notification has been received, or when
                      * `params.raw` was specified to the
                      * {@link WsMonitor constructor}.
                      * @event WsMonitor#notification
                      * @param {object} notification - The raw notification.
                      */
          this.emit('notification', obj);
        } catch (error) {
          this.emit('error', error);
        }
        this.timeout = setTimeout(this.close.bind(this), 60 * 1000);
      })
      .on('close', () => {
        /** Emitted when the connection to the web socket server has been closed.
                  * @event WsMonitor#closed
                  * @param {string} url - The URL of the web socket server.
                  */
        this.emit('closed', url);
        if (this._options.retryTime > 0) {
          setTimeout(this.listen.bind(this), this._options.retryTime * 1000);
        }
      });
  }

  /** Close the websocket.
      */
  async close() {
    this.log.debug('no messages for 60 sec. closing websocket.');
    if (this.ws != null) {
      this.ws.close();
      await EventEmitter.once(this.ws, 'close');
      this.ws.removeAllListeners();
      delete this.ws;
    }
  }
}