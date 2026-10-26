'use strict';

const createSocialVideoCommand = require('../../Plugin/socialVideoCommand');

module.exports = createSocialVideoCommand({
    name: 'flextv',
    aliases: ['flextvdl', 'flexdl'],
    label: 'FlexTV',
    emoji: '🎞️',
    hostPattern: '(?:[a-z0-9-]+\\.)*flextv\\.cc'
});
