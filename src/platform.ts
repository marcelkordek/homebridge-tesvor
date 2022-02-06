import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { SwitchAccessory } from './switchAccessory';
import { TVAccessory } from './tvAccessory';
//import { Weback } from './lib/weback.js'
//const Weback = require('./lib/weback.js');
import { Weback } from './lib/weback.js';
import { WsMonitor } from './lib/WsMonitor.js';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class TesvorPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', PLATFORM_NAME);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }


  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  async discoverDevices() {
    //const _this = this;
    //this.log.info('Config', this.config);
    const weback = new Weback(this.log, this.config.username, this.config.password, this.config.country);

    const startMode = this.config.startMode || 'AutoClean';
    const stopMode = this.config.stopMode || 'Standby';

    const accessoryType = this.config.accessoryType || 'Switch';
    const accessoryCategory = this.config.accessoryCategory || 'TV';

    const ws = new WsMonitor(this.log, weback, { retryTime: 15 });

    ws.on('error', (error) => {
      this.log.debug('websocket communication error: %s', error);
    });
    ws.on('closed', (url) => {
      this.log.debug('websocket connection to %s closed - retrying in 15s', url);
    });
    // ws.on('listening', (url) => {
    //   this.log.debug('websocket connected to %s', url);
    // });
    // ws.on('notification', (obj) => {
    //   //console.log(obj)
    // });

    //ws.listen();

    weback.deviceList().then((body) => {
      ws.listen();
      //console.log(body.data.thing_list)
      for (const device of body.data.thing_list) {

        const nickname = device.thing_nickname;
        const uuid = this.api.hap.uuid.generate(device.thing_name);
        const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

        if (existingAccessory) {
          this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
          existingAccessory.context.ws = ws;
          existingAccessory.context.device = device;
          existingAccessory.context.nickname = nickname;
          existingAccessory.context.weback = weback;
          existingAccessory.context.modes = { startMode: startMode, stopMode: stopMode };
          existingAccessory.context.tv = { accessoryType: accessoryType, accessoryCategory: accessoryCategory };
          this.api.updatePlatformAccessories([existingAccessory]);
          switch (accessoryType) {
            case 'TV':
              new TVAccessory(this, existingAccessory, this.log);
              break;
            default:
              new SwitchAccessory(this, existingAccessory, this.log);
              break;
          }
        } else {
          this.log.info('Adding new accessory:', nickname);
          const accessory = new this.api.platformAccessory(nickname, uuid);
          accessory.context.ws = ws;
          accessory.context.device = device;
          accessory.context.nickname = nickname;
          accessory.context.weback = weback;
          accessory.context.modes = { startMode: startMode, stopMode: stopMode };
          accessory.context.tv = { accessoryType: accessoryType, accessoryCategory: accessoryCategory };
          switch (accessoryType) {
            case 'TV':
              new TVAccessory(this, accessory, this.log);
              this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);
              break;
            default:
              new SwitchAccessory(this, accessory, this.log);
              this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
              break;
          }
        }
      }
    });
  }
}
