'use strict';

const createSocialVideoCommand = require('../../Plugin/socialVideoCommand');

module.exports = createSocialVideoCommand({
    name: 'dramabox',
    aliases: ['dramaboxdl', 'dbox'],
    label: 'DramaBox',
    emoji: '🎞️',
    hostPattern: '(?:[a-z0-9-]+\\.)*dramabox(?:db)?\\.com'
});
