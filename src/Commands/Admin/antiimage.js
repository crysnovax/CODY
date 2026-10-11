'use strict';
const { createMediaAnti } = require('../../Plugin/mediaAnti');
const plugin = createMediaAnti({
    command: 'antiimage',
    aliases: ['antiimg', 'noimage'],
    label: 'Anti Image',
    description: 'Block image messages in groups',
    messageType: 'imageMessage',
    violationLabel: 'image messages',
    databaseName: 'antiimage.json',
    warningDatabaseName: 'antiimage_warns.json'
});
plugin.handleAntiImage = plugin.handleAnti;
module.exports = plugin;
