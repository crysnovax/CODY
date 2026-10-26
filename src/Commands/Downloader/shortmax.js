'use strict';

const createSocialVideoCommand = require('../../Plugin/socialVideoCommand');

module.exports = createSocialVideoCommand({
    name: 'shortmax',
    aliases: ['shortmaxdl', 'smdl'],
    label: 'ShortMax',
    emoji: '🎞️',
    hostPattern: '(?:www\\.)?shorttv\\.live'
});
