'use strict';

const got = require('got');
const crypto = require('crypto');

export class Weback {
  constructor(log, username, password, region, app_name) {
    // Creds for WeBack API
    this.log = log;
    this.username = username;
    this.password = password;
    this.country_code = region;
    this.app_name = app_name;

    // Expiration time of session
    this.expiration_time;

    this.client;
    this.weback_data;

    // Start
    //this.init();
  }

  // async init() {
  //     await this.auth();
  // }

  auth() {
    this.log('auth() ...');
    return new Promise(async (resolve, reject) => {
      if (!this.username) {
        this.log('Username is not provided via params'); return;
      }
      if (!this.password) {
        this.log('Password is not provided via params'); return;
      }
      if (!this.country_code) {
        this.log('Country Code is not provided via params'); return;
      }

      const data = {
        'payload': {
          'opt': 'login',
          'pwd': crypto.createHash('md5').update(this.password).digest('hex'),
        },
        'header': {
          'language': 'de',
          'app_name': this.app_name,
          'calling_code': this.country_code,
          'api_version': '1.0',
          'account': this.username,
          'client_id': 'yugong_app',
        },
      };

      const { body } = await got.post('https://user.grit-cloud.com/oauth', {
        json: data,
        responseType: 'json',
      });
      //this.log.debug('auth()', body);
      if(body.msg !== 'success') reject(body);
      this.expiration_time = body.data.expired_time;
      this.weback_data = body;
      resolve(body);
    }).catch((e) => {
      this.log('auth() error:', e);
    });
  }



  async deviceList() {
    this.log.debug('deviceList() ...');
    return new Promise(async (resolve, reject) => {
      if (!this.weback_data) await this.auth();
      if (this.weback_data.msg !== 'success'){
        reject(this.weback_data);
        return;
      }
      var httpheaders = {
        'Accept': 'application/json',
        'region': this.weback_data.data.region_name,
        'token': this.weback_data.data.jwt_token,
      };
      const payload = {
        'opt': 'user_thing_list_get',
      };
      const { body } = await got.post('https://user.grit-cloud.com/api', {
        headers: httpheaders,
        json: payload,
        responseType: 'json',
      });
      //console.log('device_list()',body)
      if(body.msg !== 'success') reject(body);
      resolve(body);
    }).catch((e) => {
      this.log('device_list() error:', e);
    });
  }

  async getData() {
    this.log.debug('getData() - checking token ...');
    this.log.debug('token expired:', this.isTokenExpired());

    return new Promise(async (resolve, reject) => {
      if (!this.weback_data) await this.auth();
      if(this.isTokenExpired()) await this.auth();
      resolve(this.weback_data);
    });
  }

  isTokenExpired(token = this.weback_data.data.jwt_token) {
    const payloadBase64 = token.split('.')[1];
    const decodedJson = Buffer.from(payloadBase64, 'base64').toString();
    const decoded = JSON.parse(decodedJson);
    const exp = decoded.exp;
    const expired = (Date.now() >= exp * 1000);
    return expired;
  }
}