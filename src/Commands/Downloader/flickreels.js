'use strict';

const createSocialVideoCommand = require('../../Plugin/socialVideoCommand');

module.exports = createSocialVideoCommand({
    name: 'flickreels',
    aliases: ['flickreelsdl', 'frdl'],
    label: 'FlickReels',
    emoji: '🎞️',
    hostPattern: '(?:www\\.)?flickreels\\.net'
});
