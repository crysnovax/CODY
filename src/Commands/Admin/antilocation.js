'use strict';
const { createAntiMessageModeration } = require('../../Plugin/antiMessageModeration');
const { hasMessageType } = require('../../Plugin/mediaAnti');
const LOCATION_TYPES = ['locationMessage', 'liveLocationMessage', 'venueMessage'];
const plugin = createAntiMessageModeration({
    command: 'antilocation',
    aliases: ['noloc', 'antimap'],
    label: 'Anti Location',
    description: 'Block shared locations, live locations, and venues',
    databaseName: 'antilocation.json',
    warningDatabaseName: 'antilocation_warns.json',
    detector: payload => LOCATION_TYPES.some(type => hasMessageType(payload, type)),
    violationLabel: 'location shares'
});
plugin.handleAntiLocation = plugin.handleModeration;
plugin.LOCATION_TYPES = LOCATION_TYPES;
module.exports = plugin;
