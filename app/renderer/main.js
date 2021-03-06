'use strict'

const crashReporter = require('../lib/crash-reporter')
crashReporter.init({'scope': 'preferences'})

const {ipcRenderer, remote} = require('electron')
const ConfigStore = require('configstore')
const AutoLaunch = require('auto-launch')
const config = require('../config')
const log = remote.require('./lib/log')
const enums = require('../lib/enums')
const notify = remote.require('./lib/notify')
const powerControl = remote.require('./lib/power-control')

const conf = new ConfigStore(config.APP_SHORT_NAME)

let firebaseConfig = {
    apiKey: config.FIREBASE_API_KEY,
    authDomain: config.FIREBASE_AUTH_DOMAIN
}

let runStartUpCheckBox
let timeLimitUpCheckBox
let timeLimitStart
let timeLimitUpEnd
let timeValidatorError
let navItems
let navPanes
let statusNavItem
let settingsNavItem
let aboutNavItem
let appRunning
let appPaused
let registered
let notRegistered
let registeredEmail
let emailRegisterButton
let registerEmailForm
let emailInput
let dimScreen
let turnOffScreenIdle
let suspendIdle
let disableBackLight
let settingsToHide
let powerSaveRunningYes
let powerSaveRunningNo
let dmRunningYes
let dmRunningNo
let minutesSaved
let energySaved
let moneySaved


let selectedTab = null
let ipcReady = false

let appLauncher = null

appLauncher = new AutoLaunch({
    name: config.APP_NAME
})

ipcRenderer.on('selected-window', (event, windowType) => {
    selectedTab = windowType
    if (ipcReady) {
        checkIfShouldSelectTab()
    }
})

ipcRenderer.on('log-message', (event, msg) => {
    console.log(msg)
})

ipcRenderer.on('log-error-message', (event, msg) => {
    console.error(msg)
})

function selectTab(tabToSelect) {
    navItems.removeClass('active')
    tabToSelect.addClass('active')
    navPanes.hide()
    $(`#${tabToSelect.data('manager-pane-id')}`).show()
}

function enableAutoStart() {
    appLauncher.isEnabled().then((enabled) => {
        if (enabled) {
            return
        }
        return appLauncher.enable()
    }).then((enabled) => {
        conf.set('run-on-start-up', true)
    })
}

function disableAutoStart() {
    appLauncher.isEnabled().then((enabled) => {
        if (enabled) {
            return appLauncher.disable()
        }
    }).then((disabled) => {
        conf.set('run-on-start-up', false)
    })
}

function checkIfAutoStartRunning() {
    if (conf.get('run-on-start-up')) {
        runStartUpCheckBox.prop('checked', true)
    }
}


function checkPowerControlSettings() {
    if (conf.get('dim-screen')) {
        dimScreen.prop('checked', true)
    }
    if (conf.get('turn-off-screen')) {
        turnOffScreenIdle.prop('checked', true)
    }
    if (conf.get('suspend-computer')) {
        suspendIdle.prop('checked', true)
    }
}

function enableLimitedActivity() {
    conf.del('limited-activity')
    conf.del('limited-activity-start-time')
    conf.del('limited-activity-end-time')
    timeLimitStart.val(0)
    timeLimitStart.prop('disabled', true)
    timeLimitUpEnd.val(24)
    timeLimitUpEnd.prop('disabled', true)
    checkIfAppRunning()
}

function disableLimitedActivity() {
    conf.set('limited-activity', true)
    conf.set('limited-activity-start-time', 0)
    conf.set('limited-activity-end-time', 24)
    timeLimitStart.prop('disabled', false)
    timeLimitUpEnd.prop('disabled', false)
    checkIfAppRunning()
}

function checkIfLimitedActivitySet() {
    if (conf.get('limited-activity')) {
        timeLimitStart.prop('disabled', false)
        timeLimitUpEnd.prop('disabled', false)
    }
    else {
        timeLimitUpCheckBox.prop('checked', true)
    }

    let startTime = conf.get('limited-activity-start-time')
    if (startTime !== undefined) {
        timeLimitStart.val(startTime)
    }

    let endTime = conf.get('limited-activity-end-time')
    if (endTime !== undefined) {
        timeLimitUpEnd.val(endTime)
    }
}

function checkEndTimeValidation() {
    let startTime = timeLimitStart.val()
    let endTime = timeLimitUpEnd.val()
    if (parseInt(startTime) >= parseInt(endTime)) {
        timeValidatorError.show()
        return false
    }
    timeValidatorError.hide()
    return true
}

function checkIfAppRunning() {
    if (remote.require('./lib/monitor').shouldAppBeRunning()) {
        appPaused.hide()
        appRunning.show()
    }
    else {
        appPaused.show()
        appRunning.hide()
    }

    if (conf.get('dm-already-start')) {
        dmRunningNo.hide()
        dmRunningYes.show()

        powerSaveRunningNo.hide()
        powerSaveRunningYes.show()
    }
    else {
        dmRunningNo.show()
        dmRunningYes.hide()

        powerSaveRunningNo.show()
        powerSaveRunningYes.hide()
    }
}

function checkIfShouldSelectTab() {
    if (selectedTab === enums.WindowType.ABOUT) {
        selectTab(aboutNavItem)
    }
    else if (selectedTab === enums.WindowType.SETTINGS) {
        selectTab(settingsNavItem)
    }
    else if (selectedTab === enums.WindowType.STATUS) {
        selectTab(statusNavItem)
    }
    selectedTab = null
}

function checkIfRegisteredUser() {
    if (conf.get('register-email')) {
        registered.show()
        registeredEmail.text(conf.get('register-email'))
    }
    else {
        $.getScript('../assets/bower_components/firebase/firebase.js', (data, textStatus, jqxhr) => {
            firebase.initializeApp(firebaseConfig) // jshint ignore:line
            notRegistered.show()
        })
    }
}

function showEmail(email) {
    conf.set('register-email', email)
    notify('You successfully registered, we will inform you in case you win! :)')
    registered.show()
    registeredEmail.text(email)
    notRegistered.hide()
}

function registerEmail(email) {
    let password = require('node-uuid').v1()

    firebase.auth().createUserWithEmailAndPassword(email, password).then(() => { // jshint ignore:line
        return showEmail(email)
    }).catch(function (errorSignUp) {
        if (errorSignUp.code === 'auth/email-already-in-use') {
            return showEmail(email)
        }
        return notify(errorSignUp.message)
    })

    firebase.auth().onAuthStateChanged((user) => { // jshint ignore:line
        user.sendEmailVerification()
    })
}

function showOptionsBasedOnOS() {
    if (config.IS_LINUX) {
        settingsToHide.show()
    }
}

function getStatistics() {
    if (conf.has('saved-minutes')) {
        minutesSaved.text(conf.get('saved-minutes'))
    }
    if (conf.has('saved-energy-watts-second')) {
        let savedEnergy = Math.round((conf.get('saved-energy-watts-second') / 3600) * 1000) / 1000
        energySaved.text(savedEnergy)
        moneySaved.text(Math.round((savedEnergy / 1000) * config.ELECTRICITY_PRICE_EURO_PER_KWH * 10000) / 10000)
    }
}

$(document).ready(() => {

    runStartUpCheckBox = $('#run-at-start-up')
    timeLimitUpCheckBox = $('#limited-activity')
    timeLimitStart = $('#limited-activity-start-time')
    timeLimitUpEnd = $('#limited-activity-end-time')
    timeValidatorError = $('#end-time-error')
    navItems = $('.nav-group-item')
    navPanes = $('.manager-pane')
    statusNavItem = $('#status-menu-item')
    settingsNavItem = $('#settings-menu-item')
    aboutNavItem = $('#about-menu-item')
    registered = $('#already-registered')
    notRegistered = $('#not-registered')
    registeredEmail = $('#user-registered-email')
    emailRegisterButton = $('#email-register-button')
    registerEmailForm = $('.email-form')
    emailInput = $('#email-input')
    dimScreen = $('#dim-screen-power-save')
    turnOffScreenIdle = $('#turn-screen-off-power-save-idle')
    suspendIdle = $('#suspend-power-save-idle')
    disableBackLight = $('#disable-dim-screen')
    settingsToHide = $('.settings-to-hide')
    appRunning = $('#app-running-yes')
    appPaused = $('#app-running-no')
    powerSaveRunningYes = $('#computer-power-save-yes')
    powerSaveRunningNo = $('#computer-power-save-no')
    dmRunningYes = $('#computer-dm-yes')
    dmRunningNo = $('#computer-dm-no')
    minutesSaved = $('#minutes-participated')
    energySaved = $('#energy-saved')
    moneySaved = $('#money-saved')

    ipcReady = true

    checkIfAutoStartRunning()
    checkIfLimitedActivitySet()
    checkIfAppRunning()
    checkIfShouldSelectTab()
    checkPowerControlSettings()
    showOptionsBasedOnOS()
    getStatistics()
    checkIfRegisteredUser()

    navItems.click((e) => {
        selectTab($(e.target))
    })

    emailRegisterButton.click(() => {
        registerEmailForm.toggle(100)
    })

    registerEmailForm.on('submit', (e) => {
        e.preventDefault()
        registerEmail(emailInput.val())
    })

    runStartUpCheckBox.click(() => {
        if (runStartUpCheckBox.prop('checked')) {
            enableAutoStart()
        }
        else {
            disableAutoStart()
        }
    })

    dimScreen.click(() => {
        if (dimScreen.prop('checked')) {
            conf.set('dim-screen', true)
        }
        else {
            conf.set('dim-screen', false)
        }
    })

    turnOffScreenIdle.click(() => {
        if (turnOffScreenIdle.prop('checked')) {
            conf.set('turn-off-screen', true)
        }
        else {
            conf.set('turn-off-screen', false)
        }
    })

    suspendIdle.click(() => {
        if (suspendIdle.prop('checked')) {
            conf.set('suspend-computer', true)
        }
        else {
            conf.set('suspend-computer', false)
        }
    })

    disableBackLight.click(() => {
        powerControl.restoreBacklight()
    })

    timeLimitUpCheckBox.click(() => {
        if (timeLimitUpCheckBox.prop('checked')) {
            enableLimitedActivity()
        }
        else {
            disableLimitedActivity()
        }
        checkEndTimeValidation()
    })

    timeLimitStart.change(() => {
        if (checkEndTimeValidation()) {
            conf.set('limited-activity-start-time', timeLimitStart.val())
            checkIfAppRunning()
        }
    })

    timeLimitUpEnd.change(() => {
        if (checkEndTimeValidation()) {
            conf.set('limited-activity-end-time', timeLimitUpEnd.val())
            checkIfAppRunning()
        }
    })
})

window.onerror = function rendererErrorHandler(errorMsg, url, lineNumber) {
    log.sendError({'message': errorMsg, 'stack': url, 'lineNumber': lineNumber})
    return false;
}