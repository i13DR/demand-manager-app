'use strict'

module.exports = {
    init,
    checkUpdate
}

const os = require('os')
const path = require('path')
const electron = require('electron')
const autoUpdaterElectron = require('electron-updater')
const app = electron.app
const request = require('request')
const https = require('https')
const fs = require('fs')
const isOnline = require('is-online')
const sudo = require('sudo-prompt')

const config = require('../config')
const log = require('./log')
const notify = require('./notify')


let manualUpdate = false

function deleteLinuxDownloadAndRestart(downloadPath) {
    fs.unlinkSync(downloadPath)
    app.relaunch({args: process.argv.slice(1).concat(['--relaunch'])})
    app.exit(0)
}

function installUpdate(downloadPath) {
    notify(`The latest version of the ${config.APP_NAME} is being installed.`)
    sudo.exec(`dpkg -i ${downloadPath}`, {name: config.APP_NAME}, (lshwJsonErr, lshwJsonStdout, lshwJsonStderr) => {
        if (lshwJsonErr) {
            log.sendError(lshwJsonErr)
            return notify(`The update could not be installed. 
            The latest version of ${config.APP_NAME} can be found in your home dir, please update it.`)
        }
        notify(`Update was installed successfully.`)
        setTimeout(() => {
            deleteLinuxDownloadAndRestart(downloadPath)
        }, 2000)
    })
}

function onLinuxResponse(err, res, data) {
    if (err) {
        return log.sendError(err)
    }
    if (res.statusCode === 200) {
        if (manualUpdate) {
            notify('Update is available and will be downloaded to your home directory.')
        }
        data = JSON.parse(data)
        let downloadPath = path.resolve(process.env.HOME || process.env.USERPROFILE) +
            `/${data.file}`
        fs.access(downloadPath, fs.F_OK, (error) => {
            if (error) {
                let newVersionFile = fs.createWriteStream(downloadPath)
                https.get(data.url, (response) => {
                    response.pipe(newVersionFile).on('close', () => {
                        installUpdate(downloadPath)
                    })
                })
            }
            else {
                installUpdate(downloadPath)
            }
        })
    } else if (res.statusCode === 204) {
        if (manualUpdate) {
            notify('No new update is available.')
        }
    } else {
        // Unexpected status code
        log.sendError({'message': 'Unexpected update status code', 'lineNumber': res.statusCode})
    }
}

function initLinux() {
    let feedURL = config.AUTO_UPDATE_LINUX_BASE_URL + (os.arch() === 'x64' ? '64' : '32') +
        '?v=' + config.APP_VERSION
    request(feedURL, onLinuxResponse)
}

function initWin32() {
    let autoUpdater = autoUpdaterElectron.autoUpdater
    autoUpdater.on(
        'error',
        (err) => {
            notify(`Update error: ${err.message}`)
            log.sendError(err)
        }
    )
    autoUpdater.on(
        'checking-for-update',
        () => {
        }
    )
    autoUpdater.on(
        'update-available',
        () => {
            if (manualUpdate) {
                notify('Update is available and will be installed.')
            }
        }
    )
    autoUpdater.on(
        'update-not-available',
        () => {
            if (manualUpdate) {
                notify('No new update is available.')
            }
        }
    )
    autoUpdater.on(
        'update-downloaded',
        (e, notes, name, date, url) => {
            notify('Update is being installed.')
            autoUpdater.quitAndInstall()
        }
    )
    autoUpdater.checkForUpdates()
}

function checkUpdate(manual) {
    manualUpdate = !!manual
    isOnline().then(online => {
        if (online) {
            if (config.IS_LINUX) {
                initLinux()
            } else {
                initWin32()
            }
        }
        else {
            if (manualUpdate) {
                notify('No internet connection')
            }
        }
    })
}

function init() {
    checkUpdate()
    log.loggingV('checkUpdate')
    return setTimeout(init, config.AUTO_UPDATE_CHECK_INTERVAL)
}
