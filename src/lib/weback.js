'use strict';

const got = require('got');
const crypto = require('crypto');
const AWS = require('aws-sdk');
const AWSIot = require('aws-iot-device-sdk');

module.exports = class Weback {
  constructor(log, username, password, region) {
    // Log
    this.log = log;
    // Creds for WeBack API
    this.username = username;
    this.password = password;
    this.country_code = region;

    //Credentials
    this.aws_access_key_id;
    this.aws_secret_access_key;
    this.aws_session_token;

    this.aws_session;
    this.aws_identity_id;
    this.region;

    this.iot;
    this.iot_data;

    // Expiration time of session
    this.expiration_time;

    // Start
    this.init();
  }

  async init() {
    await this.get_session();
  }

  auth() {
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

      const payload = {
        'App_Version': 'android_3.9.3',
        'Password': crypto.createHash('md5').update(this.password).digest('hex'),
        'User_Account': this.country_code + '-' + this.username,
      };

      const { body } = await got.post('https://www.weback-login.com/WeBack/WeBack_Login_Ats_V3', {
        json: payload,
        responseType: 'json',
      });
      resolve(body);
    });
  }

  auth_cognito(region, identity_Id, token) {
    return new Promise(async (resolve, reject) => {
      var cognitoidentity = new AWS.CognitoIdentity({ region: region });
      var params = {
        IdentityId: identity_Id,
        Logins: { // optional tokens, used for authenticated login
          'cognito-identity.amazonaws.com': token,
        },
      };
      cognitoidentity.getCredentialsForIdentity(params, (err, data) => {
        //this.log(data)
        if (err) this.log(err, err.stack); // an error occurred
        else resolve(data);           // successful response
      });

    });
  }

  make_session_from_cognito(aws_creds, region) {
    return new Promise(async (resolve, reject) => {
      //this.aws_identity_id = aws_creds.Credentials.IdentityId
      this.aws_access_key_id = aws_creds.Credentials.AccessKeyId;
      this.aws_secret_access_key = aws_creds.Credentials.SecretKey;
      this.aws_session_token = aws_creds.Credentials.SessionToken;
      this.region = region;

      AWS.config.update({
        accessKeyId: this.aws_access_key_id,
        secretAccessKey: this.aws_secret_access_key,
        sessionToken: this.aws_session_token,
        region: this.region,
      });
      let lambda = new AWS.Lambda({ region: this.region });
      this.aws_session = lambda;
      this.iot = new AWS.Iot();
      var endpoint = await this.get_endpoint();
      this.iot_data = new AWS.IotData({ endpoint: endpoint });

      resolve(lambda);
    });
  }

  is_renewal_required() {
    return Date.now() < Date.parse(this.expiration_time);
  }

  async get_session() {
    if (this.aws_session && !this.is_renewal_required()) return this.aws_session;

    let weback_data = await this.auth();
    if (weback_data.Request_Result != 'success') {
      this.log('Could not authenticate: ', weback_data ); return;
    }

    this.region = weback_data['Region_Info'];
    this.aws_identity_id = weback_data['Identity_Id'];

    let aws_creds = await this.auth_cognito(this.region, weback_data['Identity_Id'], weback_data['Token']);
    this.aws_creds = aws_creds;
    this.expiration_time = aws_creds.Credentials.Expiration;

    let session = await this.make_session_from_cognito(aws_creds, this.region);
    this.aws_session = session;
    return session;
  }

  async device_list() {
    return new Promise(async (resolve, reject) => {
      let session = this.aws_session;
      if (!session) session = await this.get_session();
      if (!session) return;

      var params = {
        FunctionName: 'Device_Manager_V2',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({
          'Device_Manager_Request': 'query',
          'Identity_Id': this.aws_identity_id,
          'Region_Info': this.region,
        }),
      };

      session.invoke(params, (err, data) => {
        if (err) this.log(err, err.stack); // an error occurred
        else var payload = JSON.parse(data.Payload); resolve(payload['Request_Cotent']);           // successful response
      });
    });
  }

  async get_device_description(device, session = this.aws_session) {
    return new Promise(async (resolve, reject) => {
      if (!session) session = await this.get_session();

      var params = {
        thingName: device.Thing_Name,
      };

      this.iot.describeThing(params, (err, data) => {
        data.Thing_Nick_Name = device.Thing_Nick_Name;
        if (err) this.log(err, err.stack); // an error occurred
        else resolve(data);           // successful response
      });
    });

  }

  get_endpoint() {
    return new Promise(async (resolve, reject) => {
      var params = {
        endpointType: 'iot:Data-ATS',
      };
      this.iot.describeEndpoint(params, (err, data) => {
        //this.log(data)
        if (err) this.log(err, err.stack); // an error occurred
        else resolve('https://' + data.endpointAddress);           // successful response
      });
    });

  }

  async get_device_shadow(device_name, session = this.aws_session) {
    if (!session) session = await this.get_session();

    // var endpoint = await this.get_endpoint()
    // var iot_data = new AWS.IotData({endpoint: endpoint})


    var params = {
      thingName: device_name,
    };

    this.iot_data.getThingShadow(params, (err, data) => {
      //this.log(data)
      if (err) this.log(err, err.stack); // an error occurred
      else this.log(JSON.parse(data.payload));           // successful response
    });

  }

  async publish_device_msg(device_name, desired_payload = {}, session = this.aws_session) {
    if (!session || this.is_renewal_required()) session = await this.get_session();

    //var endpoint = await this.get_endpoint()
    //var iot_data = new AWS.IotData({ endpoint: endpoint })

    var topic = '$aws/things/' + device_name + '/shadow/update';
    var payload = {
      state: {
        desired: desired_payload,
      },
    };
    var params = {
      topic: topic,
      payload: JSON.stringify(payload),
      qos: 0,
    };
    //this.log(params)
    this.iot_data.publish(params, (err, data) => {
      if (err) this.log(err, err.stack); // an error occurred
      //else this.log(data);           // successful response
    });
  }

  async getConnection() {
    return new Promise(async (resolve, reject) => {
      var endpoint = await this.get_endpoint();

      var client = AWSIot.device({
        region: AWS.config.region,
        host: endpoint.replace('https://', ''),
        clientId: 'mqtt-' + (Math.floor((Math.random() * 100000) + 1)),
        protocol: 'wss',
        maximumReconnectTimeMs: 8000,
        debug: false,
        accessKeyId: this.aws_access_key_id,
        secretKey: this.aws_secret_access_key,
        sessionToken: this.aws_session_token,
      });
      resolve(client);
    });
  }
};
