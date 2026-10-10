'use strict';
const { createAntiMessageModeration } = require('../../Plugin/antiMessageModeration');
const { hasMessageType } = require('../../Plugin/mediaAnti');
const EVENT_TYPES = ['eventMessage', 'groupEventMessage', 'calendarMessage'];
const plugin = createAntiMessageModeration({
    command: 'antievent',
    aliases: ['noevent'],
    label: 'Anti Event',
    description: 'Block WhatsApp group event messages',
    databaseName: 'antievent.json',
    warningDatabaseName: 'antievent_warns.json',
    detector: payload => EVENT_TYPES.some(type => hasMessageType(payload, type)),
    violationLabel: 'group events'
});
plugin.handleAntiEvent = plugin.handleModeration;
plugin.EVENT_TYPES = EVENT_TYPES;
module.exports = plugin;
