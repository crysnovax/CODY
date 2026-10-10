'use strict';
const { createAntiMessageModeration } = require('../../Plugin/antiMessageModeration');

function hasVoiceNote(value, seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return false;
    seen.add(value);
    return Object.entries(value).some(([key, child]) =>
        (key === 'audioMessage' && child?.ptt === true)
        || key === 'voiceMessage'
        || hasVoiceNote(child, seen)
    );
}

const plugin = createAntiMessageModeration({
    command: 'antivoice',
    aliases: ['novoice', 'antivn'],
    label: 'Anti Voice Note',
    description: 'Block voice notes while allowing regular audio files',
    databaseName: 'antivoice.json',
    warningDatabaseName: 'antivoice_warns.json',
    detector: payload => hasVoiceNote(payload),
    violationLabel: 'voice notes'
});
plugin.hasVoiceNote = hasVoiceNote;
plugin.handleAntiVoice = plugin.handleModeration;
module.exports = plugin;
