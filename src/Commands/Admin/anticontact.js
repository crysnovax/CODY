'use strict';
const { createAntiMessageModeration } = require('../../Plugin/antiMessageModeration');
const { hasMessageType } = require('../../Plugin/mediaAnti');
const CONTACT_TYPES = ['contactMessage', 'contactMessageV2', 'contactMessageV3', 'contactsArrayMessage'];
const plugin = createAntiMessageModeration({
    command: 'anticontact',
    aliases: ['nocontact', 'anticard'],
    label: 'Anti Contact',
    description: 'Block shared contact cards and contact lists',
    databaseName: 'anticontact.json',
    warningDatabaseName: 'anticontact_warns.json',
    detector: payload => CONTACT_TYPES.some(type => hasMessageType(payload, type)),
    violationLabel: 'contact cards'
});
plugin.handleAntiContact = plugin.handleModeration;
plugin.CONTACT_TYPES = CONTACT_TYPES;
module.exports = plugin;
