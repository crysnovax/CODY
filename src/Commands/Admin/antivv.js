const { createAntiMessageModeration } = require('../../Plugin/antiMessageModeration');

// View Once is a protocol envelope, not a media-type whitelist. Detect all
// current wrappers at any nesting depth so manually sent V1/V2 messages are
// treated the same as CODY-generated messages.
const { isViewOnce } = require('../../Plugin/viewOnce');
const isViewOnceMessage = message => isViewOnce(message);

const plugin = createAntiMessageModeration({
    command: 'antivv',
    aliases: ['antiviewonce', 'antivo'],
    label: 'Anti View-Once',
    description: 'Block view-once media messages in groups',
    databaseName: 'antivv.json',
    warningDatabaseName: 'antivv_warns.json',
    detector: isViewOnceMessage,
    violationLabel: 'view-once messages'
});

plugin.handleAntiVV = plugin.handleModeration;
plugin.isViewOnceMessage = isViewOnceMessage;

module.exports = plugin;
