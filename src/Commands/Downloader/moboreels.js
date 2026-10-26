'use strict';

const createSocialVideoCommand = require('../../Plugin/socialVideoCommand');

module.exports = createSocialVideoCommand({
    name: 'moboreels',
    aliases: ['moboreelsdl', 'mobodl'],
    label: 'MoboReels',
    emoji: '🎞️',
    hostPattern: '(?:[a-z0-9-]+\\.)*moboreels\\.com'
});
