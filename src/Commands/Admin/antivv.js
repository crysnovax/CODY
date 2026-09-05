const { createAntiMessageModeration } = require('../../Plugin/antiMessageModeration');

// ─── DETECTOR: does this message contain a view-once media envelope? ───
function isViewOnceMessage(message, seen = new WeakSet()) {
    if (!message || typeof message !== 'object' || seen.has(message)) return false;
    seen.add(message);

    if (message.viewOnceMessage || message.viewOnceMessageV2 || message.viewOnceMessageV2Extension) return true;
    for (const value of Object.values(message)) {
        if (value && typeof value === 'object' && isViewOnceMessage(value, seen)) return true;
    }
    return false;
}

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
