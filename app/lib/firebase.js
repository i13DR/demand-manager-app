'use strict'

module.exports = {
    registerDevice,
    saveOnlineLocation,
    saveLocationFirstProfile,
    updateLocationProfile,
    saveExtractedDevicesData,
    updateBatteryProfile,
    updateRunningProfile,
    enableOfflineCapabilities,
    installedVersion,
    saveBatteryCapabilities,
    saveBatteryFirstProfile,
    saveLocationClusterProfile,
    saveBatteryClusterProfile,
    saveCommandsFirstSchedule,
    watchScheduleChanges,
    watchSettingsChanges,
    saveBatteryLogging
}

const os = require('os')
const ConfigStore = require('configstore')
const firebase = require('firebase')
const config = require('../config')
const osInfo = require('./os-info')
const GeoFire = require('geofire')
const log = require('./log')
const utils = require('./utils')
const db = require('../main/windows').db


const conf = new ConfigStore(config.APP_SHORT_NAME)


let firebaseConfig = {
    apiKey: config.FIREBASE_API_KEY,
    databaseURL: config.FIREBASE_DATABASE_URL
}


firebase.initializeApp(firebaseConfig)

function registerDevice() {
    firebase.database().ref(`device/${global.machineId}`).set({
        'registered-time': firebase.database.ServerValue.TIMESTAMP
    })
    let deviceCount = firebase.database().ref('statistics/devices-count')
    deviceCount.transaction(function (count) {
        return count + 1
    })
    firebase.database().ref(`settings/${global.machineId}`).set({
        'logging': false,
        'power-model': ' '
    })
}

function installedVersion() {
    firebase.database().ref(`device/${global.machineId}`).update({
        'current-version': config.APP_VERSION,
        'check-update-time': firebase.database.ServerValue.TIMESTAMP,
    })
}

function saveOnlineLocation(geolocation) {
    geolocation['time'] = firebase.database.ServerValue.TIMESTAMP

    firebase.database()
        .ref(`last-location/${global.machineId}/`)
        .set(geolocation)

    let geoFire = new GeoFire(firebase.database()
        .ref(`online`))
    geoFire.set(global.machineId, [geolocation['latitude'], geolocation['longitude']]).then(() => {
        enableOfflineCapabilities()
    })

}

function saveLocationFirstProfile(locationProfiles) {
    for (let locationProfile of locationProfiles) {
        if (locationProfile['id']) {
            delete locationProfile['id']
        }
        locationProfile['last-updated'] = firebase.database.ServerValue.TIMESTAMP
        let profileId =
            `${utils.getDayNum(locationProfile['day_of_week'])}-${locationProfile['one_hour_duration_beginning']}`
        firebase.database()
            .ref(`location/${global.machineId}/${profileId}`)
            .set(locationProfile)
    }
}

function saveLocationClusterProfile(locationProfiles) {
    for (let locationProfile of locationProfiles) {
        if (locationProfile['id']) {
            delete locationProfile['id']
        }
        locationProfile['last-updated'] = firebase.database.ServerValue.TIMESTAMP
        let profileId = `${utils.getDayNum(locationProfile['day_of_week'])}-${locationProfile['section_of_day']}`
        firebase.database()
            .ref(`location-cluster/${global.machineId}/${profileId}`)
            .set(locationProfile)
    }
}

function updateLocationProfile(locationData, dayOfWeek, hoursOfDay) {
    let profileId = `${utils.getDayNum(dayOfWeek)}-${hoursOfDay}`
    firebase.database()
        .ref(`location/${global.machineId}/${profileId}`)
        .update({
            'last-updated': firebase.database.ServerValue.TIMESTAMP,
            'day_of_week': dayOfWeek,
            'one_hour_duration_beginning': hoursOfDay,
            'latitude': locationData['latitude'],
            'longitude': locationData['longitude'],
            'accuracy': locationData['accuracy'],
            'is_checked': locationData['is_checked']
        })
}

function saveExtractedDevicesData(extractedData) {

    extractedData['time'] = firebase.database.ServerValue.TIMESTAMP

    let osPrefix = ''
    if (config.IS_WINDOWS) {
        osPrefix = 'windows-extracted-devices'
    }
    else if (config.IS_LINUX) {
        osPrefix = 'linux-extracted-devices'
    }

    firebase.database()
        .ref(`hardware/${global.machineId}/${osPrefix}/`)
        .update(extractedData)
    firebase.database().ref(`hardware/${global.machineId}`).update({
        'os-info': osInfo()
    })
    conf.set('device-data-extracted', true)
}

function saveBatteryCapabilities(extractedData) {
    let osPrefix = ''
    if (config.IS_WINDOWS) {
        osPrefix = 'windows-battery'
    }
    else if (config.IS_LINUX) {
        osPrefix = 'linux-battery'
    }

    firebase.database()
        .ref(`hardware/${global.machineId}/${osPrefix}/`)
        .update(extractedData)
}

function updateRunningProfile(dayOfWeek, hoursOfDay, appRunning, computerRunning) {
    let profileId = `${utils.getDayNum(dayOfWeek)}-${hoursOfDay}`

    firebase.database()
        .ref(`power/${global.machineId}/${profileId}`)
        .update({
            'app_running_bool': appRunning,
            'computer_running_bool': computerRunning

        })
}

function updateBatteryProfile(powerData, dayOfWeek, hoursOfDay) {
    powerData['last-updated'] = firebase.database.ServerValue.TIMESTAMP
    powerData['day_of_week'] = dayOfWeek
    powerData['one_hour_duration_beginning'] = hoursOfDay

    let profileId = `${utils.getDayNum(powerData['day_of_week'])}-${powerData['one_hour_duration_beginning']}`

    firebase.database()
        .ref(`power/${global.machineId}/${profileId}`)
        .update(powerData)
}

function saveBatteryFirstProfile(batteryProfiles) {
    for (let batteryProfile of batteryProfiles) {
        if (batteryProfile['id']) {
            delete batteryProfile['id']
        }
        batteryProfile['last-updated'] = firebase.database.ServerValue.TIMESTAMP
        let profileId =
            `${utils.getDayNum(batteryProfile['day_of_week'])}-${batteryProfile['one_hour_duration_beginning']}`

        firebase.database()
            .ref(`power/${global.machineId}/${profileId}`)
            .update(batteryProfile)
    }
}

function saveBatteryClusterProfile(batteryProfiles) {
    for (let batteryProfile of batteryProfiles) {
        if (batteryProfile['id']) {
            delete batteryProfile['id']
        }
        batteryProfile['last-updated'] = firebase.database.ServerValue.TIMESTAMP
        let profileId = `${utils.getDayNum(batteryProfile['day_of_week'])}-${batteryProfile['section_of_day']}`

        firebase.database()
            .ref(`power-cluster/${global.machineId}/${profileId}`)
            .set(batteryProfile)
    }
}

function enableOfflineCapabilities() {
    let onlineConnectionsRef = firebase.database()
        .ref(`online/${global.machineId}/connections`)
    let lastOnlineRef = firebase.database()
        .ref(`activity-status/${global.machineId}/last-online`)
    let connectedRef = firebase.database().ref('.info/connected')
    connectedRef.on('value', (snap) => {
        if (snap.val() === true) {
            let con = onlineConnectionsRef.push(firebase.database.ServerValue.TIMESTAMP)
            con.onDisconnect().remove()
            lastOnlineRef.onDisconnect().set(firebase.database.ServerValue.TIMESTAMP)
        }
    })
}


function saveCommandsFirstSchedule(schedules) {
    for (let schedule of schedules) {
        if (schedule['id']) {
            delete schedule['id']
        }
        schedule['last-updated'] = firebase.database.ServerValue.TIMESTAMP
        let profileId = `${utils.getDayNum(schedule['day_of_week'])}-${schedule['one_hour_duration_beginning']}`
        firebase.database()
            .ref(`schedule/${global.machineId}/${profileId}`)
            .set(schedule)
    }
}

function watchScheduleChanges() {
    let scheduleRef = firebase.database().ref(`schedule/${global.machineId}`)
    scheduleRef.once('value', (snapshot) => {
        db.runQuery({
            'fn': 'updateScheduleAfterLaunch',
            'params': snapshot.val()
        })
    })
    return scheduleRef.on('child_changed', (snapshot) => {
        db.runQuery({
            'fn': 'updateSchedule',
            'params': snapshot.val()
        })
    })
}

function watchSettingsChanges() {
    let scheduleRef = firebase.database().ref(`settings/${global.machineId}`)
    scheduleRef.once('value', (snapshot) => {
        let settings = snapshot.val()
        if (settings) {
            conf.set('logging-enabled', settings['logging'])
            conf.set('power-model', settings['power-model'])
        }
    })
    return scheduleRef.on('child_changed', (snapshot) => {
        if (snapshot.key === 'logging') {
            conf.set('logging-enabled', snapshot.val())
        }
        else if (snapshot.key === 'power-model') {
            conf.set('power-model', snapshot.val())
        }
    })
}

function saveBatteryLogging(extractedData) {

    extractedData['time'] = firebase.database.ServerValue.TIMESTAMP
    log(extractedData)
    firebase.database().ref(`logging/${global.machineId}`).push(extractedData)
}