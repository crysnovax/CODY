'use strict';

const createSocialVideoCommand = require('../../Plugin/socialVideoCommand');

module.exports = createSocialVideoCommand({
    name: 'dramafren',
    aliases: ['dramafrendl', 'dfren'],
    label: 'DramaFren',
    emoji: '🎞️',
    hostPattern: '(?:[a-z0-9-]+\\.)*dramafren\\.org'
});
