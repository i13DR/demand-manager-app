'use strict'

module.exports = {
    hasTray,
    init
}

const electron = require('electron')
const app = electron.app

const config = require('../config')
const powerToggle = require('../lib/power-control')
const windows = require('../main/windows')

var tray

var getMenuTemplate = () => {
    return [
        {
            label: 'Status',
            click: () => windows.status.init()
        },
        {
            label: 'Preferences',
            click: () => windows.preferences.init()
        },
        {type: 'separator'},
        {
            label: 'About',
            click: () => windows.about.init()
        },
        {type: 'separator'},
        {
            label: 'Quit',
            click: () => app.quit()
        }
    ]
}

/**
 * Check for libappindicator1 support before creating tray icon
 */
var checkLinuxTraySupport = (cb)=> {
    var cp = require('child_process')

    // Check that we're on Ubuntu (or another debian system) and that we have
    // libappindicator1. If app was installed from the deb file, we should
    // always have it. If it was installed from the zip file, we might not.
    cp.exec('dpkg --get-selections libappindicator1', (err, stdout)=> {
        if (err) {
            return cb(false)
        }
        // Unfortunately there's no cleaner way, as far as I can tell, to check
        // whether a debian package is installed:
        cb(stdout.endsWith('\tinstall\n'))
    })
}

var updateTrayMenu = () => {
    var contextMenu = electron.Menu.buildFromTemplate(getMenuTemplate())
    tray.setContextMenu(contextMenu)
}

var createTray = ()=> {
    tray = new electron.Tray(config.APP_ICON)

    // On Windows, left click opens the app, right click opens the context menu.
    // On Linux, any click (left or right) opens the context menu.
    tray.on('click', () => windows.about.init())

    // Show the tray context menu, and keep the available commands up to date
    updateTrayMenu()
    tray.setToolTip(config.APP_NAME)
}


var initLinux = ()=> {
    checkLinuxTraySupport((supportsTray)=> {
        if (supportsTray) {
            createTray()
        }
    })
}

var initWin32 = () => {
    createTray()
}

/**
 * Returns true if there a tray icon is active.
 */
function hasTray() {
    return !!tray
}

function init() {
    if (process.platform === 'linux') {
        initLinux()
    }
    if (process.platform === 'win32') {
        initWin32()
    }
    // OS X apps generally do not have menu bar icons
}