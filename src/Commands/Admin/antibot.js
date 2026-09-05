const { createAntiMessageModeration } = require('../../Plugin/antiMessageModeration');

// ─── KNOWN BOT-LIBRARY MESSAGE-ID STAMPS ───
// Some Baileys-lineage forks embed a literal marker string inside every
// generated message ID (see generics.js's generateMessageIDV2 — itsliaaa's
// lineage embeds "STARFALL" at a hash-derived position; plogme
// will embed "PLOGME" from v2.7.1 onward at a fixed position). A message ID
// containing one of these strings was built by that specific library — a
// real WhatsApp client (iOS, Android, Web, Desktop) has no reason to ever
// produce these substrings, since they aren't part of WhatsApp's own ID
// format. This is a genuine signature match, not a heuristic.
//
// IMPORTANT — what this does NOT do: this only catches bots built on a
// library that happens to use one of these known stamps. A bot on a
// different Baileys fork, on whiskeysockets/baileys directly, or on a
// non-Baileys WhatsApp automation tool generates IDs with none of these
// substrings and will NOT be caught by this check. This is a real, solid
// signal for this specific family of bots — it is not a universal bot
// detector, and should not be described as one.
const KNOWN_BOT_ID_STAMPS = ['STARFALL', 'PLOGME'];

function matchedStamp(messageId) {
    const id = String(messageId || '').toUpperCase();
    return KNOWN_BOT_ID_STAMPS.find(stamp => id.includes(stamp)) || null;
}

function extractMessageId(m, mek) {
    return mek?.key?.id || m?.key?.id || null;
}

function isKnownBotStampMessage(message, context = {}) {
    // The detector signature in createAntiMessageModeration passes the raw
    // WhatsApp message content, not m/mek directly — the message ID has to
    // travel through context instead, set by the caller below.
    return Boolean(context.messageId && matchedStamp(context.messageId));
}

const plugin = createAntiMessageModeration({
    command: 'antibot',
    aliases: ['ab'],
    label: 'Anti-Bot',
    description: 'Flag messages carrying a known bot-library ID stamp',
    databaseName: 'antibot.json',
    warningDatabaseName: 'antibot_warns.json',
    // detector is called by antiMessageModeration.js as detector(message) —
    // it does not receive m/mek/context, only the raw message object. Since
    // the actual signal here lives in the message ID (outside the message
    // content itself), the real check happens in the handleModeration
    // override below, which does have access to m/mek. This detector is a
    // permissive pass-through so createAntiMessageModeration's own gating
    // logic doesn't reject it before the ID check ever runs.
    detector: () => true,
    violationLabel: 'known bot-library message stamps'
    // No deleteMessage override — falls through to antiMessageModeration.js's
    // own default: sock.sendMessage(m.chat, { delete: m.key }). That's a
    // plain single-message delete, not the status-broadcast revoke path that
    // broke in antigroupstatus.js (relayMessage-not-a-function was specific
    // to deleteGroupStatus's custom multi-candidate key building — it never
    // touched this default path). No reason to disable it here.
});

const originalHandleModeration = plugin.handleModeration;
plugin.handleModeration = async (sock, m, mek) => {
    const messageId = extractMessageId(m, mek);
    const stamp = matchedStamp(messageId);
    if (!stamp) return false; // no known stamp — not flagged, defer entirely to original gating for anything else
    return originalHandleModeration(sock, m, mek);
};

plugin.matchedStamp = matchedStamp;
plugin.KNOWN_BOT_ID_STAMPS = KNOWN_BOT_ID_STAMPS;
plugin.handleAntiBot = plugin.handleModeration;

module.exports = plugin;

