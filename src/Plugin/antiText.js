'use strict';

// CODY appends this invisible character to outgoing text/captions. Anti
// handlers must not treat the implementation marker as user content.
const BOT_OUTGOING_MARKER = '\u200e';

function stripBotMarker(value) {
    return typeof value === 'string' ? value.split(BOT_OUTGOING_MARKER).join('') : value;
}

function stripBotMarkerDeep(value, seen = new WeakSet()) {
    if (typeof value === 'string') return stripBotMarker(value);
    if (!value || typeof value !== 'object' || seen.has(value)) return value;
    seen.add(value);
    if (Array.isArray(value)) return value.map(item => stripBotMarkerDeep(item, seen));
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, stripBotMarkerDeep(child, seen)]));
}

module.exports = { BOT_OUTGOING_MARKER, stripBotMarker, stripBotMarkerDeep };
