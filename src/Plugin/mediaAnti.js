'use strict';

const { createAntiMessageModeration } = require('./antiMessageModeration');

function hasMessageType(value, messageType, seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return false;
    seen.add(value);
    return Object.entries(value).some(([key, child]) => {
        // A quoted message belongs to the original sender, not to the
        // member who replied to it. Keep this guard in the primitive
        // detector too because callers may pass a raw WhatsApp envelope.
        if (key === 'quotedMessage' || key === 'quoted') return false;
        return key === messageType || hasMessageType(child, messageType, seen);
    });
}

function createMediaAnti({ command, aliases, label, description, messageType, violationLabel, databaseName, warningDatabaseName }) {
    const plugin = createAntiMessageModeration({
        command,
        aliases,
        label,
        description,
        databaseName,
        warningDatabaseName,
        detector: message => hasMessageType(message, messageType),
        violationLabel
    });
    plugin.hasMessageType = value => hasMessageType(value, messageType);
    plugin.handleAnti = plugin.handleModeration;
    return plugin;
}

module.exports = { createMediaAnti, hasMessageType };
