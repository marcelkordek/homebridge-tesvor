import { Service, PlatformAccessory, CharacteristicValue, Logger } from 'homebridge';
import { TesvorPlatform } from './platform';
const vacuum = require('./lib/vacuum.js');

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class SwitchAccessory {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private state = {
    On: false,
    BatteryLevel: 100,
    Charging: true,
  };

  private weback;
  private ws;
  private device;

  constructor(
    private readonly platform: TesvorPlatform,
    private readonly accessory: PlatformAccessory,
    public readonly log: Logger,
  ) {
    // weback
    //const weback = accessory.context.weback;
    this.ws = accessory.context.ws;
    this.device = accessory.context.device;
    //this.weback = weback;
    const firmware = this.device.thing_status.firmware_version || this.device.thing_status.vendor_firmware_version;

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Tesvor')
      .setCharacteristic(this.platform.Characteristic.Model, this.device.sub_type)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.device.thing_name)
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, firmware);

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.nickname);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))                // SET - bind to the `setOn` method below
      .onGet(this.getOn.bind(this));               // GET - bind to the `getOn` method below

    // create a new Battery service
    const batteryService = this.accessory.getService(this.platform.Service.Battery) || this.accessory.addService(this.platform.Service.Battery);

    // create handlers for required characteristics
    batteryService.getCharacteristic(this.platform.Characteristic.StatusLowBattery)
      .onGet(this.handleStatusLowBatteryGet.bind(this));

    batteryService.getCharacteristic(this.platform.Characteristic.BatteryLevel)
      .onGet(this.handleBatteryLevelGet.bind(this));

    const intervalTime = 30; //sec
    let interval;

    this.ws.on('error', () => {
      //this.log.debug('websocket communication error: %s', error);
      clearInterval(interval);
    });
    this.ws.on('closed', () => {
      //this.log.debug('websocket connection to %s closed - retrying in 15s', url);
      clearInterval(interval);
    });
    this.ws.on('listening', (url) => {
      this.log.debug('%s - websocket listening on %s', this.device.thing_name, url);
      this.ws.getUpdate(this.device);
      interval = setInterval( () => {
        this.ws.getUpdate(this.device);
      }, intervalTime * 1000);
    });
    this.ws.on('notification', (obj) => {
      if (obj.thing_name !== this.device.thing_name) return;
      this.log.debug('%s - notification received', this.device.thing_name);

      if (obj.notify_info !== 'thing_status_update') return;

      if (Object.prototype.hasOwnProperty.call(obj.thing_status, 'working_status')) {
        //var mode = JSON.parse(msg.toString()).state.working_status == 'AutoClean' ? true : false
        const mode = obj.thing_status.working_status;
        const state = vacuum.isCleaning(mode);
        const isCharging = vacuum.isCharging(mode);
        this.state.Charging = isCharging;
        this.state.On = state;
        this.log.debug(accessory.context.nickname, mode);
        this.log.debug(accessory.context.nickname, state);
        this.service.updateCharacteristic(this.platform.Characteristic.On, state);
        batteryService.updateCharacteristic(this.platform.Characteristic.ChargingState, isCharging);
      }
      if (Object.prototype.hasOwnProperty.call(obj.thing_status, 'battery_level')) {
        //var mode = JSON.parse(msg.toString()).state.working_status == 'AutoClean' ? true : false
        const battery_level = obj.thing_status.battery_level;
        this.state.BatteryLevel = battery_level;
        this.log.debug(accessory.context.nickname, battery_level);
        batteryService.updateCharacteristic(this.platform.Characteristic.BatteryLevel, battery_level);
      }
      //console.log(obj)
    });
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    // implement your own code to turn your device on/off
    this.state.On = value as boolean;
    //const mode = this.state.On ? 'AutoClean' : 'BackCharging' //Standby
    const mode = this.state.On ? this.accessory.context.modes.startMode : this.accessory.context.modes.stopMode;
    const payload = {
      'topic_name': '$aws/things/'+ this.device.thing_name +'/shadow/update',
      'opt': 'send_to_device',
      'sub_type': this.device.sub_type,
      'topic_payload': { 'state': { 'working_status': mode } },
      'thing_name': this.device.thing_name,
    };
    this.ws.send(payload);

    // get state
    setTimeout(() => {
      this.ws.getUpdate(this.device);
    }, 1000);

    this.platform.log.debug('Set Characteristic On ->', value);
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async getOn(): Promise<CharacteristicValue> {
    // implement your own code to check if the device is on
    const isOn = this.state.On;

    this.platform.log.debug('Get Characteristic On ->', isOn);

    // get state
    this.ws.getUpdate(this.device);

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    return isOn;
  }

  async handleStatusLowBatteryGet(): Promise<CharacteristicValue> {
    // set this to a valid value for StatusLowBattery
    const batteryLevel = this.state.BatteryLevel;
    let state = this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
    if (batteryLevel < 20) {
      state = this.platform.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW;
    }

    return state;
  }

  async handleBatteryLevelGet(): Promise<CharacteristicValue> {
    // set this to a valid value for StatusLowBattery
    const batteryLevel = this.state.BatteryLevel;
    return batteryLevel;
  }
}