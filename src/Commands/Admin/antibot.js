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
function hasBotEnvelope(value, seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return false;
    seen.add(value);
    // These fields are emitted by automation clients and are not present on
    // ordinary phone-authored chat messages. Keep this deliberately narrow.
    if (value.botMessageId || value.botMessageMetadata || value.automationContext) return true;
    return Object.values(value).some(child => hasBotEnvelope(child, seen));
}
function isBotLikeMessage(message, context = {}) {
    const id = extractMessageId(context.m, context.mek);
    return Boolean(matchedStamp(id) || hasBotEnvelope(message) || context.m?.isBaileys === true);
}

const plugin = createAntiMessageModeration({
    command: 'antibot',
    aliases: ['ab'],
    label: 'Anti-Bot',
    description: 'Flag messages carrying a known bot-library ID stamp',
    databaseName: 'antibot.json',
    warningDatabaseName: 'antibot_warns.json',
    // The shared moderation layer passes both raw content and message
    // context, so AntiBot can inspect IDs and explicit bot metadata.
    detector: isBotLikeMessage,
    violationLabel: 'known bot-library message stamps'
    // No deleteMessage override — falls through to antiMessageModeration.js's
    // own default: sock.sendMessage(m.chat, { delete: m.key }). That's a
    // plain single-message delete, not the status-broadcast revoke path that
    // broke in antigroupstatus.js (relayMessage-not-a-function was specific
    // to deleteGroupStatus's custom multi-candidate key building — it never
    // touched this default path). No reason to disable it here.
});

// The shared moderation layer now passes message context to the detector.
// Do not gate only on the ID: different bot forks use different IDs.
const originalHandleModeration = plugin.handleModeration;
plugin.handleModeration = async (sock, m, mek) => originalHandleModeration(sock, m, mek);

plugin.matchedStamp = matchedStamp;
plugin.KNOWN_BOT_ID_STAMPS = KNOWN_BOT_ID_STAMPS;
plugin.handleAntiBot = plugin.handleModeration;

module.exports = plugin;

