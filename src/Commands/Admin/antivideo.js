'use strict';

const { createMediaAnti } = require('../../Plugin/mediaAnti');

const plugin = createMediaAnti({
    command: 'antivideo',
    aliases: ['antivd', 'novideo'],
    label: 'Anti Video',
    description: 'Block video messages in groups',
    messageType: 'videoMessage',
    violationLabel: 'video messages',
    databaseName: 'antivideo.json',
    warningDatabaseName: 'antivideo_warns.json'
});

plugin.handleAntiVideo = plugin.handleAnti;
module.exports = plugin;
