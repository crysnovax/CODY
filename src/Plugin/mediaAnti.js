'use strict';

const { createAntiMessageModeration } = require('./antiMessageModeration');

function hasMessageType(value, messageType, seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return false;
    seen.add(value);
    return Object.entries(value).some(([key, child]) =>
        key === messageType || hasMessageType(child, messageType, seen)
    );
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
