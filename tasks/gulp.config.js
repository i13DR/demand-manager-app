'use strict'

var path = require('path')

const appPackage = require('../app/package.json')

module.exports = {
    // All js which is needed to be vet
    appjs: [
        './app/**/*.js',
        '!./app/node_modules/**',
        './tasks/**/*.js'
    ],
    appVersion: appPackage.version,
    awsRegion: 'eu-central-1',
    awsS3BucketName: 'demand-manager-resources',
    awsS3UpdateKeyPrefix: 'updates/latest/',
    awsS3ArchivedUpdateKeyPrefix: 'updates/older/',
    awsS3Win64Dir: 'win64',
    awsS3Win32Dir: 'win32',
    awsS3Linux64Dir: 'linux64',
    awsS3Linux32Dir: 'linux32',
    awsS3OSXDir: 'osx',
    baseDir: path.resolve(__dirname, '..') + '/',
    distDir: 'dist/',
    distWin64Dir: 'win/',
    distWin32Dir: 'win-ia32/',
    distLinux64Dir: '',
    distLinux32Dir: '',
    distOSXDir: '',
    latestBuildVersionFile: 'buildVersion',
    latestBuildVersionDir: 'dist/latestReleased/'
}