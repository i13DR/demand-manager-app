'use strict'

module.exports = {
    startDM,
    stopDM
}

const exec = require('child_process').exec
const ConfigStore = require('configstore')
const config = require('../config')
const notify = require('./notify')
const log = require('./log')

const conf = new ConfigStore(config.APP_SHORT_NAME)

function goToPowerSaveMode(guid) {
    exec(`powercfg -l `, (error, listLines, stderr) => {
        if (error) {
            log.error(error)
        }
        let guidParts = listLines.split(' ')
        let notIncluded = true
        guidParts.forEach((guidPart) => {
            if (String(guidPart) === String(guid)) {
                notIncluded = false
                return exec(`powercfg -setactive ${guid}`)
            }
        })
        if(notIncluded)
        {
            exec(`powercfg -import  %CD%\\app\\assets\\power\\power_save_suspend_5`, (error, guidLine, stderr) => {
                if (error) {
                    log.error(error)
                }
                let guidParts = guidLine.split(' ')
                guidParts.forEach((guidPart) => {
                    if (guidPart.length === 36) {
                        conf.set('power-save-guid', guidPart)
                        return exec(`powercfg -setactive ${guidPart}`)
                    }
                })
            })
        }
    })
}

function startDM() {
    conf.set('dm-already-stop', false)
    if (!conf.get('dm-already-start')) {
        conf.set('dm-already-start', true)
        notify('Power save mode has started')
        exec('powercfg -getactivescheme').stdout.on('data', function (activeScheme) {
            if (activeScheme) {
                let schemeParts = activeScheme.split(' ')
                schemeParts.forEach((schemePart) => {
                    if (schemePart.length === 36) {
                        conf.set('active-power-scheme', schemePart)
                    }
                })
            }
        })

        if (conf.get('power-save-guid')) {
            return goToPowerSaveMode(conf.get('power-save-guid'))
        }
        else {
            exec(`powercfg -import  %CD%\\app\\assets\\power\\power_save_suspend_5`, (error, guidLine, stderr) => {
                if (error) {
                    log.error(error)
                }
                let guidParts = guidLine.split(' ')
                guidParts.forEach((guidPart) => {
                    if (guidPart.length === 36) {
                        conf.set('power-save-guid', guidPart)
                        return goToPowerSaveMode(guidPart)
                    }
                })
            })
        }
    }
}

function stopDM() {
    conf.set('dm-already-start', false)
    if (!conf.get('dm-already-stop')) {
        conf.set('dm-already-stop', true)
        notify('Power save mode has ended')
        if (conf.get('active-power-scheme')) {
            exec(`powercfg -setactive ${conf.get('active-power-scheme')}`)
            conf.delete('active-power-scheme')
        }
    }
}