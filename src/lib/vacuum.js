'use strict';

const CLEAN_MODE_AUTO = 'AutoClean'
const CLEAN_MODE_EDGE = 'EdgeClean'
const CLEAN_MODE_SPOT = 'SpotClean'
const CLEAN_MODE_SINGLE_ROOM = 'RoomClean'
const CLEAN_MODE_MOP = 'MopClean'
const CLEAN_MODE_STOP = 'Standby'
const CLEAN_MODE_SMART = 'SmartClean'

const CHARGE_MODE_RETURNING = 'BackCharging'
const CHARGE_MODE_CHARGING = 'Charging'
const CHARGE_MODE_DOCK_CHARGING = 'PileCharging'
const CHARGE_MODE_DIRECT_CHARGING = 'DirCharging'
const CHARGE_MODE_IDLE = 'Hibernating'

const CLEANING_STATES = [CLEAN_MODE_AUTO, CLEAN_MODE_EDGE, CLEAN_MODE_SPOT, CLEAN_MODE_SINGLE_ROOM, CLEAN_MODE_MOP, CLEAN_MODE_SMART]
const CHARGING_STATES = [CHARGE_MODE_CHARGING, CHARGE_MODE_DOCK_CHARGING, CHARGE_MODE_DIRECT_CHARGING]
const DOCKED_STATES = [CHARGE_MODE_IDLE, CHARGE_MODE_CHARGING, CHARGE_MODE_DOCK_CHARGING, CHARGE_MODE_DIRECT_CHARGING]

module.exports = {
    isCleaning(mode) {
        return CLEANING_STATES.includes(mode);
    },
    isDocked(mode) {
        return DOCKED_STATES.includes(mode);
    },
    isCharging(mode) {
        return CHARGING_STATES.includes(mode);
    }
}