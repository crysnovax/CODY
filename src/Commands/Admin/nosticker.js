'use strict';

const { createMediaAnti } = require('../../Plugin/mediaAnti');

const plugin = createMediaAnti({
    command: 'nosticker',
    aliases: ['antisticker', 'nostick'],
    label: 'No Sticker',
    description: 'Block sticker messages in groups',
    messageType: 'stickerMessage',
    violationLabel: 'sticker messages',
    databaseName: 'nosticker.json',
    warningDatabaseName: 'nosticker_warns.json'
});

plugin.handleNoSticker = plugin.handleAnti;
module.exports = plugin;
