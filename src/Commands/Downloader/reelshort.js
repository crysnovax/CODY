'use strict';

const createSocialVideoCommand = require('../../Plugin/socialVideoCommand');

module.exports = createSocialVideoCommand({
    name: 'reelshort',
    aliases: ['reelshortdl', 'rsdl'],
    label: 'ReelShort',
    emoji: '🎞️',
    hostPattern: '(?:[a-z0-9-]+\\.)*reelshort\\.com'
});
