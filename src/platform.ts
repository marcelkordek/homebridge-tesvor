import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { SwitchAccessory } from './switchAccessory';
import { TVAccessory } from './tvAccessory';
//import { Weback } from './lib/weback.js'
const Weback = require('./lib/weback.js');

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
    const weback = new Weback(this.config.username, this.config.password, this.config.country);

    const startMode = this.config.startMode || 'AutoClean' ;
    const stopMode = this.config.stopMode || 'Standby' ;

    const accessoryType = this.config.accessoryType || 'Switch' ;
    const accessoryCategory = this.config.accessoryCategory || 'TV' ;

    weback.device_list().then((devices) => {
      //console.log(devices)
      for (const device of devices) {
        weback.get_device_description(device).then((thing) => {
          //console.log(thing)
          //console.log(thing.thingId)
          const nickname = thing.Thing_Nick_Name;
          //console.log(nickname)

          const uuid = this.api.hap.uuid.generate(thing.thingId);
          const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

          if (existingAccessory) {
            this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
            //existingAccessory.context.device = thing
            //_this.api.updatePlatformAccessories([existingAccessory]);
            existingAccessory.context.device = thing;
            existingAccessory.context.nickname = nickname;
            existingAccessory.context.weback = weback;
            existingAccessory.context.modes = { startMode: startMode, stopMode: stopMode };
            existingAccessory.context.tv = { accessoryType: accessoryType, accessoryCategory: accessoryCategory };
            this.api.updatePlatformAccessories([existingAccessory]);
            switch(accessoryType){
              case 'TV':
                new TVAccessory(this, existingAccessory, this.log);
                break;
              default:
                new SwitchAccessory(this, existingAccessory, this.log);
                break;
            }
            //new SwitchAccessory(this, existingAccessory, this.log);
          } else {
            // the accessory does not yet exist, so we need to create it
            this.log.info('Adding new accessory:', nickname);
            // create a new accessory
            const accessory = new this.api.platformAccessory(nickname, uuid);
            // store a copy of the device object in the `accessory.context`
            // the `context` property can be used to store any data about the accessory you may need
            accessory.context.device = thing;
            accessory.context.nickname = nickname;
            accessory.context.weback = weback;
            accessory.context.modes = { startMode: startMode, stopMode: stopMode };
            accessory.context.tv = { accessoryType: accessoryType, accessoryCategory: accessoryCategory };
            // create the accessory handler for the newly create accessory
            // this is imported from `platformAccessory.ts`
            switch(accessoryType){
              case 'TV':
                new TVAccessory(this, accessory, this.log);
                this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);
                break;
              default:
                new SwitchAccessory(this, accessory, this.log);
                this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
                break;
            }
            //new SwitchAccessory(this, accessory, this.log);
            // link the accessory to your platform
            //this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          }
        });
      }
    });
  }
}
