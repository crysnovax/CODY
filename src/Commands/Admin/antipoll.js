'use strict';
const { createAntiMessageModeration } = require('../../Plugin/antiMessageModeration');
const { hasMessageType } = require('../../Plugin/mediaAnti');
const POLL_TYPES = ['pollCreationMessage', 'pollCreationMessageV2', 'pollCreationMessageV3', 'pollCreationMessageV4'];
const plugin = createAntiMessageModeration({
    command: 'antipoll',
    aliases: ['nopoll'],
    label: 'Anti Poll',
    description: 'Block poll creation messages in groups',
    databaseName: 'antipoll.json',
    warningDatabaseName: 'antipoll_warns.json',
    detector: payload => POLL_TYPES.some(type => hasMessageType(payload, type)),
    violationLabel: 'polls'
});
plugin.handleAntiPoll = plugin.handleModeration;
plugin.POLL_TYPES = POLL_TYPES;
module.exports = plugin;
