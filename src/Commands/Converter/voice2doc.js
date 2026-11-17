'use strict';
const { audioToDocument } = require('./audioToDocument');

module.exports = {
    name: 'voice2doc',
    alias: ['v2doc', 'voicedoc'],
    category: 'Converter',
    desc: 'Send a replied voice note as a downloadable document',
    usage: '.voice2doc (reply to a voice note)',
    reactions: { start: '📄', success: '✅', error: '✘' },
    execute: async (sock, m, { reply, prefix }) => audioToDocument(sock, m, m.quoted, { reply, prefix, voiceOnly: true }),
};
