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

// A reply carries the message it quotes inside `contextInfo.quotedMessage`
// (and the serializer exposes the same object as `.quoted`). Every anti-*
// detector must judge ONLY the message the member actually sent: when a
// detector walked the whole envelope it also found the quoted content, so
// replying to a forwarded / link / view-once / banned-word message flagged
// the *reply* and the replier was warned/kicked for someone else's message.
// stripQuotedDeep removes those subtrees while keeping the current message's
// own contextInfo — a genuinely forwarded message is still detected through
// its own isForwarded/forwardingScore. (@crysnovax—FIX22-09-26)
const QUOTED_KEYS = new Set(['quotedMessage', 'quoted']);

function stripQuotedDeep(value, seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return value;
    seen.add(value);
    if (Array.isArray(value)) return value.map(item => stripQuotedDeep(item, seen));
    const out = {};
    for (const [key, child] of Object.entries(value)) {
        if (QUOTED_KEYS.has(key)) continue;
        out[key] = stripQuotedDeep(child, seen);
    }
    return out;
}

module.exports = { BOT_OUTGOING_MARKER, stripBotMarker, stripBotMarkerDeep, stripQuotedDeep };
