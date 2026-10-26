'use strict';

const createSocialVideoCommand = require('../../Plugin/socialVideoCommand');

module.exports = createSocialVideoCommand({
    name: 'goodshort',
    aliases: ['goodshortdl', 'gsdl'],
    label: 'GoodShort',
    emoji: '🎞️',
    hostPattern: '(?:www\\.)?goodshort\\.com'
});
