<p align="center">
  <img src="homebridge-tesvor.png" height="200px">  
</p>

# Homebridge Tesvor

[![Downloads](https://img.shields.io/npm/dt/homebridge-tesvor)](https://www.npmjs.com/package/homebridge-tesvor)
[![npm](https://img.shields.io/npm/v/homebridge-tesvor?style=flat-square)](https://www.npmjs.com/package/homebridge-tesvor) [![npm bundle size](https://img.shields.io/bundlephobia/min/homebridge-tesvor?style=flat-square)](https://github.com/marcelkordek/homebridge-tesvor)
[![GitHub last commit](https://img.shields.io/github/last-commit/marcelkordek/homebridge-tesvor?style=flat-square)](https://github.com/marcelkordek/homebridge-tesvor)

This is a plugin for [Homebridge](https://github.com/nfarina/homebridge) to control your **Tesvor Cleaning Vacuum.** 

This plugin supports following functions:

- **Power Switch** (on/off)

## Installation instructions
After [Homebridge](https://github.com/nfarina/homebridge) has been installed:

```
$ sudo npm install -g homebridge-tesvor
```

or

```
$ sudo npm install -g homebridge-tesvor@beta
```

## Basic configuration

 ```
{
	"bridge": {
		...
	},

	"platforms": [
        {
            "username": "USER", # E-Mail or Phone (Phone without Country-Code) e.g 123456 not +49123456
            "password": "PASS", # "Account Password."
            "country": "+49", # Country-Code
            "startMode": "AutoClean",
            "stopMode": "BackCharging",
            "platform": "HomebridgeTesvor"
        }
    ]
}

 ```

Or with homebridge-config-ui


## Valid Modes
* SmartClean
* AutoClean
* EdgeClean
* SpotClean
* RoomClean

* Standby
* BackCharging