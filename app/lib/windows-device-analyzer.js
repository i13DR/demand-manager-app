'use strict'


module.exports = {
    deviceAnalysis,
    monitorPower,
    batteryCapabilities,
    batteryFirstTimeProfile
}

const config = require('../config')
const log = require('./log')
const utils = require('./utils')
const wmicParams = require('./wmic-params')
const firebase = require('./firebase')
const enums = require('./enums')
const db = require('../main/windows').db

const wmic = require('ms-wmic')
const _ = require('lodash/string')
const async = require('async')

var windowsDeviceData = {}
var batteryData = {}
var batteryCapabilitiesData = {}

function runWMIC(wmicCommand, paramCallback) {
    try {
        wmic.execute(`/namespace:${wmicCommand.nameSpace} 
        path ${wmicCommand.wmiClass} get ${wmicCommand.command}`, (err, stdOut) => {
            if (err) {
                log.error(err)
                return paramCallback()
            }
            if (wmicCommand.commandType === enums.WMICommandType.DEVICE) {
                windowsDeviceData[_.trimStart(_.toLower(`${wmicCommand.wmiClass}-${wmicCommand.command}`), 'win32_')] =
                    utils.convertWmicStringToList(stdOut)
            }
            else if (wmicCommand.commandType === enums.WMICommandType.BATTERY ||
                wmicCommand.commandType === enums.WMICommandType.BATTERY_FIRST_PROFILE) {
                batteryData[_.toLower(`${wmicCommand.wmiClass}-${wmicCommand.command}`)] =
                    utils.convertWmicStringToList(stdOut)
            }
            else if (wmicCommand.commandType === enums.WMICommandType.BATTERY_CAPABILITY) {
                batteryCapabilitiesData[_.toLower(`${wmicCommand.wmiClass}-${wmicCommand.command}`)] =
                    utils.convertWmicStringToList(stdOut)
            }

            paramCallback()
        })
    }
    catch (err) {
        log.error(err)
        paramCallback()
    }
}

function runAsyncCommands(wmicCommands) {
    async.eachOfLimit(wmicCommands.commands, 2, (wmiClassProps, wmiClass, commandCallback) => {
        async.eachLimit(wmiClassProps, 3, (wmiClassProp, paramCallback) => {
            var nameSpaceRoot = '\\\\root\\'
            var wmiClassParts = wmiClass.split('$')
            var command = {
                wmiClass: wmiClassParts[1],
                command: wmiClassProp,
                nameSpace: nameSpaceRoot + wmiClassParts[0],
                commandType: wmicCommands.commandType
            }
            runWMIC(command, paramCallback)
        }, (err) => {
            if (err) {
                log.error(err.message)
            }
            commandCallback()
        })
    }, (err) => {
        if (err) {
            log.error(err.message)
        }
        if (wmicCommands.commandType === enums.WMICommandType.DEVICE) {
            firebase.saveExtractedDevicesData(windowsDeviceData)
        }
        else if (wmicCommands.commandType === enums.WMICommandType.BATTERY ||
            wmicCommands.commandType === enums.WMICommandType.BATTERY_FIRST_PROFILE) {
            var chargeRate = Math.round((parseInt(batteryData['batterystatus-chargerate']) / 1000) * 100) / 100
            var dischargeRate = Math.round((parseInt(batteryData['batterystatus-dischargerate']) / 1000) * 100) / 100
            // 0.6 came from my own laptop, it's only an rough estimation
            var drainEstimation = dischargeRate > 0 ? dischargeRate : chargeRate * 0.6
            var remainingTime = parseInt(batteryData['win32_battery-estimatedruntime'])
            if (chargeRate > 0) {
                remainingTime = utils.hoursToMinutes(Math.round(
                        (parseInt(batteryData['batterystatus-remainingcapacity']) /
                        (drainEstimation * 1000) ) * 100) / 100)
            }
            var batteryObject = {
                'remaining_time_minutes': remainingTime,
                'power_rate_w': dischargeRate > 0 ? dischargeRate : chargeRate,
                'remaining_capacity_percent': parseInt(batteryData['win32_battery-estimatedchargeremaining']),
                'voltage_v': Math.round((parseInt(batteryData['batterystatus-voltage']) / 1000) * 100) / 100,
                'charging_bool': batteryData['batterystatus-charging'].toLowerCase() === 'true',
                'discharging_bool': batteryData['batterystatus-discharging'].toLowerCase() === 'true',
                'ac_connected_bool': batteryData['batterystatus-poweronline'].toLowerCase() === 'true'
            }
            if (wmicCommands.commandType === enums.WMICommandType.BATTERY) {
                db.runQuery({
                    'fn': 'addBattery',
                    'params': batteryObject
                })
            }
            else {
                db.runQuery({
                    'fn': 'addBatteryFirstProfile',
                    'params': batteryObject
                })
            }
        }
        else if (wmicCommands.commandType === enums.WMICommandType.BATTERY_CAPABILITY) {
            firebase.saveBatteryCapabilities(batteryCapabilitiesData)
        }
    })
}

function deviceAnalysis() {
    var wmicCommands = {
        commands: wmicParams.DeviceDataExtraction,
        commandType: enums.WMICommandType.DEVICE,
    }
    runAsyncCommands(wmicCommands)
}

function batteryCapabilities() {
    var wmicCommands = {
        commands: wmicParams.BatteryCapabilitiesInfo,
        commandType: enums.WMICommandType.BATTERY_CAPABILITY,
    }
    runAsyncCommands(wmicCommands)
}

function monitorPower() {
    batteryData = {}
    var wmicCommands = {
        commands: wmicParams.BatteryInfoMonitor,
        commandType: enums.WMICommandType.BATTERY,
    }
    runAsyncCommands(wmicCommands)
}

function batteryFirstTimeProfile() {
    batteryData = {}
    var wmicCommands = {
        commands: wmicParams.BatteryInfoMonitor,
        commandType: enums.WMICommandType.BATTERY_FIRST_PROFILE,
    }
    runAsyncCommands(wmicCommands)
}