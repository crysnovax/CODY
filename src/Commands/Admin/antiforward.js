const { createAntiMessageModeration } = require('../../Plugin/antiMessageModeration');

function contextIsForwarded(contextInfo) {
    return contextInfo?.isForwarded === true || Number(contextInfo?.forwardingScore) > 0;
}

function isForwardedMessage(message, seen = new WeakSet()) {
    if (!message || typeof message !== 'object') return false;
    // The moderation framework passes a context object as argument 2. Only
    // use it as a traversal set when it actually supports Set/WeakSet APIs.
    const visited = seen && typeof seen.has === 'function' && typeof seen.add === 'function'
        ? seen
        : new WeakSet();
    if (visited.has(message)) return false;
    visited.add(message);

    if (contextIsForwarded(message.contextInfo)) return true;

    return Object.entries(message).some(([key, value]) => {
        // A reply embeds the original message under one of these fields. It
        // is the quoted author's content and must not make the replier look
        // like they forwarded something.
        if (key === 'quotedMessage' || key === 'quoted') return false;
        // Some WhatsApp envelopes copy the quoted message's forwarding flags
        // onto the reply's contextInfo. Ignore those flags when this context
        // also carries the quoted message, while preserving genuine forwards.
        if (key === 'contextInfo' && value && typeof value === 'object' &&
            (Object.prototype.hasOwnProperty.call(value, 'quotedMessage') ||
             Object.prototype.hasOwnProperty.call(value, 'quoted'))) {
            const context = { ...value };
            delete context.isForwarded;
            delete context.forwardingScore;
            return isForwardedMessage(context, visited);
        }
        if (Array.isArray(value)) {
            return value.some(item => isForwardedMessage(item, visited));
        }
        return isForwardedMessage(value, visited);
    });
}

const plugin = createAntiMessageModeration({
    command: 'antiforward',
    aliases: ['antifw', 'afw'],
    label: 'Anti Forward',
    description: 'Moderate forwarded messages',
    databaseName: 'antiforward.json',
    warningDatabaseName: 'antiforward_warns.json',
    detector: isForwardedMessage,
    violationLabel: 'forwarded messages'
});

plugin.handleAntiForward = plugin.handleModeration;
plugin.isForwardedMessage = isForwardedMessage;

module.exports = plugin;
