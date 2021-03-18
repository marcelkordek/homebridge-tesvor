import { Service, PlatformAccessory, CharacteristicValue, Logger } from 'homebridge';
import { TesvorPlatform } from './platform';
const vacuum = require('./lib/vacuum.js');

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class TVAccessory {
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
  private client;

  constructor(
    private readonly platform: TesvorPlatform,
    private readonly accessory: PlatformAccessory,
    public readonly log: Logger,
  ) {
    // weback
    const weback = accessory.context.weback;
    this.weback = weback;

    // set the accessory category
    this.accessory.category = this.platform.api.hap.Categories.TELEVISION;

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Tesvor')
      .setCharacteristic(this.platform.Characteristic.Model, accessory.context.device.thingName)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.attributes.mac)
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, accessory.context.device.attributes.firmware_version);


    this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.nickname);

    // set sleep discovery characteristic
    this.service.setCharacteristic(this.platform.Characteristic.SleepDiscoveryMode, this.platform.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);

    // handle on / off events using the Active characteristic
    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onSet((newValue) => {
        this.log.debug('set Active => setNewValue: ' + newValue);
        this.service.updateCharacteristic(this.platform.Characteristic.Active, 1);
      });

    this.service.setCharacteristic(this.platform.Characteristic.ActiveIdentifier, 1);

    // handle input source changes
    this.service.getCharacteristic(this.platform.Characteristic.ActiveIdentifier)
      .onSet((newValue) => {

        // the value will be the value you set for the Identifier Characteristic
        // on the Input Source service that was selected - see input sources below.

        this.log.info('set Active Identifier => setNewValue: ' + newValue);
      });

    // handle remote control input
    this.service.getCharacteristic(this.platform.Characteristic.RemoteKey)
      .onSet((newValue) => {
        switch (newValue) {
          case this.platform.Characteristic.RemoteKey.REWIND: {
            this.log.info('set Remote Key Pressed: REWIND');
            break;
          }
          case this.platform.Characteristic.RemoteKey.FAST_FORWARD: {
            this.log.info('set Remote Key Pressed: FAST_FORWARD');
            break;
          }
          case this.platform.Characteristic.RemoteKey.NEXT_TRACK: {
            this.log.info('set Remote Key Pressed: NEXT_TRACK');
            break;
          }
          case this.platform.Characteristic.RemoteKey.PREVIOUS_TRACK: {
            this.log.info('set Remote Key Pressed: PREVIOUS_TRACK');
            break;
          }
          case this.platform.Characteristic.RemoteKey.ARROW_UP: {
            this.log.info('set Remote Key Pressed: ARROW_UP');
            break;
          }
          case this.platform.Characteristic.RemoteKey.ARROW_DOWN: {
            this.log.info('set Remote Key Pressed: ARROW_DOWN');
            break;
          }
          case this.platform.Characteristic.RemoteKey.ARROW_LEFT: {
            this.log.info('set Remote Key Pressed: ARROW_LEFT');
            break;
          }
          case this.platform.Characteristic.RemoteKey.ARROW_RIGHT: {
            this.log.info('set Remote Key Pressed: ARROW_RIGHT');
            break;
          }
          case this.platform.Characteristic.RemoteKey.SELECT: {
            this.log.info('set Remote Key Pressed: SELECT');
            break;
          }
          case this.platform.Characteristic.RemoteKey.BACK: {
            this.log.info('set Remote Key Pressed: BACK');
            break;
          }
          case this.platform.Characteristic.RemoteKey.EXIT: {
            this.log.info('set Remote Key Pressed: EXIT');
            break;
          }
          case this.platform.Characteristic.RemoteKey.PLAY_PAUSE: {
            this.log.info('set Remote Key Pressed: PLAY_PAUSE');
            break;
          }
          case this.platform.Characteristic.RemoteKey.INFORMATION: {
            this.log.info('set Remote Key Pressed: INFORMATION');
            break;
          }
        }
      });

    /**
     * Create a speaker service to allow volume control
     */
    const speakerService = this.accessory.getService(this.platform.Service.TelevisionSpeaker) || this.accessory.addService(this.platform.Service.TelevisionSpeaker);

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))                // SET - bind to the `setOn` method below
      .onGet(this.getOn.bind(this));               // GET - bind to the `getOn` method below

    speakerService
      .setCharacteristic(this.platform.Characteristic.Active, this.platform.Characteristic.Active.ACTIVE)
      .setCharacteristic(this.platform.Characteristic.VolumeControlType, this.platform.Characteristic.VolumeControlType.ABSOLUTE);

    // handle volume control
    speakerService.getCharacteristic(this.platform.Characteristic.VolumeSelector)
      .onSet((newValue) => {
        this.log.info('set VolumeSelector => setNewValue: ' + newValue);
      });

    /**
     * Create TV Input Source Services
     * These are the inputs the user can select from.
     * When a user selected an input the corresponding Identifier Characteristic
     * is sent to the TV Service ActiveIdentifier Characteristic handler.
     */

    // HDMI 1 Input Source
    const hdmi1InputService = this.accessory.getService('hdmi1') ||
      this.accessory.addService(this.platform.Service.InputSource, 'hdmi1', 'HDMI-1');

    hdmi1InputService
      .setCharacteristic(this.platform.Characteristic.Identifier, 1)
      .setCharacteristic(this.platform.Characteristic.ConfiguredName, 'HDMI 1')
      .setCharacteristic(this.platform.Characteristic.IsConfigured, this.platform.Characteristic.IsConfigured.CONFIGURED)
      .setCharacteristic(this.platform.Characteristic.InputSourceType, this.platform.Characteristic.InputSourceType.HDMI);
    this.service.addLinkedService(hdmi1InputService); // link to tv service

    // create a new Battery service
    const batteryService = this.accessory.getService(this.platform.Service.Battery) || this.accessory.addService(this.platform.Service.Battery);

    // create handlers for required characteristics
    batteryService.getCharacteristic(this.platform.Characteristic.StatusLowBattery)
      .onGet(this.handleStatusLowBatteryGet.bind(this));

    batteryService.getCharacteristic(this.platform.Characteristic.BatteryLevel)
      .onGet(this.handleBatteryLevelGet.bind(this));

    //const _this = this
    this.weback.getConnection().then((client) => {
      this.client = client;
      const deviceTopic = '$aws/things/' + accessory.context.device.thingName + '/shadow/update/delta';
      const getTopic = '$aws/things/' + accessory.context.device.thingName + '/shadow/get';
      const getTopicAccepted = '$aws/things/' + accessory.context.device.thingName + '/shadow/get/accepted';

      client.subscribe(deviceTopic);
      client.subscribe(getTopicAccepted);
      client.publish(getTopic, '');

      client.on('message', (topic, msg) => {
        if (!topic.includes(accessory.context.device.thingName)) return;
        if (!Object.prototype.hasOwnProperty.call(JSON.parse(msg.toString()), 'state')) return;
        //console.log(topic)
        //console.log(JSON.parse(msg.toString())
        const message = JSON.parse(msg.toString());
        // Object.prototype.hasOwnProperty.call(foo, "bar")
        // message.state.hasOwnProperty('working_status')
        //this.log.debug(message)
        //this.log.debug(Object.prototype.hasOwnProperty.call(message.state, 'working_status').toString())
        if (Object.prototype.hasOwnProperty.call(message.state, 'working_status')) {
          //var mode = JSON.parse(msg.toString()).state.working_status == 'AutoClean' ? true : false
          const mode = message.state.working_status;
          const state = vacuum.isCleaning(mode);
          const isCharging = vacuum.isCharging(mode);
          this.state.Charging = isCharging;
          this.state.On = state;
          this.log.debug(accessory.context.nickname, mode);
          //_this.log.debug(state)
          this.service.updateCharacteristic(this.platform.Characteristic.On, state);
          batteryService.updateCharacteristic(this.platform.Characteristic.ChargingState, isCharging);
        }
        if (!Object.prototype.hasOwnProperty.call(JSON.parse(msg.toString()).state, 'reported')) return;
        if (Object.prototype.hasOwnProperty.call(message.state.reported, 'working_status')) {
          //var mode = JSON.parse(msg.toString()).state.working_status == 'AutoClean' ? true : false
          const mode = message.state.reported.working_status;
          const state = vacuum.isCleaning(mode);
          const isCharging = vacuum.isCharging(mode);
          this.state.Charging = isCharging;
          this.state.On = state;
          this.log.debug(accessory.context.nickname, mode);
          //_this.log.debug(state)
          this.service.updateCharacteristic(this.platform.Characteristic.On, state);
          batteryService.updateCharacteristic(this.platform.Characteristic.ChargingState, isCharging);
        }
        if (Object.prototype.hasOwnProperty.call(message.state.reported, 'battery_level')) {
          //var mode = JSON.parse(msg.toString()).state.working_status == 'AutoClean' ? true : false
          const battery_level = message.state.reported.battery_level;
          this.state.BatteryLevel = battery_level;
          this.log.debug(accessory.context.nickname, battery_level);
          batteryService.updateCharacteristic(this.platform.Characteristic.BatteryLevel, battery_level);
        }
      });
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
    //this.weback.publish_device_msg(this.accessory.context.device.thingName, { working_status: mode });
    const topic = '$aws/things/' + this.accessory.context.device.thingName + '/shadow/update';
    const payload = {
      state: {
        desired: { working_status: mode },
      },
    };
    this.client.publish(topic, JSON.stringify(payload));

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
    const topic = '$aws/things/' + this.accessory.context.device.thingName + '/shadow/get';
    this.client.publish(topic, '');

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

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  // async setBrightness(value: CharacteristicValue) {
  //   // implement your own code to set the brightness
  //   this.exampleStates.Brightness = value as number;

  //   this.platform.log.debug('Set Characteristic Brightness -> ', value);
  // }

}
