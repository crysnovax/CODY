'use strict';
const { audioToDocument } = require('./audioToDocument');

module.exports = {
    name: 'audio2doc',
    alias: ['a2doc', 'audiodoc'],
    category: 'Converter',
    desc: 'Send a replied audio file as a downloadable document',
    usage: '.audio2doc (reply to an audio file)',
    reactions: { start: '📄', success: '✅', error: '✘' },
    execute: async (sock, m, { reply, prefix }) => audioToDocument(sock, m, m.quoted, { reply, prefix, audioOnly: true }),
};
