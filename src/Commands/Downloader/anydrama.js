'use strict';

const createSocialVideoCommand = require('../../Plugin/socialVideoCommand');

module.exports = createSocialVideoCommand({
    name: 'anydrama',
    aliases: ['anydramadl', 'adrama'],
    label: 'AnyDrama',
    emoji: '🎞️',
    hostPattern: '(?:www\\.)?any-drama\\.com'
});
