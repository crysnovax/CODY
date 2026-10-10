'use strict';

const { createMediaAnti } = require('../../Plugin/mediaAnti');

const plugin = createMediaAnti({
    command: 'antiaudio',
    aliases: ['antiaud', 'noaudio'],
    label: 'Anti Audio',
    description: 'Block audio messages in groups',
    messageType: 'audioMessage',
    violationLabel: 'audio messages',
    databaseName: 'antiaudio.json',
    warningDatabaseName: 'antiaudio_warns.json'
});

plugin.handleAntiAudio = plugin.handleAnti;
module.exports = plugin;
