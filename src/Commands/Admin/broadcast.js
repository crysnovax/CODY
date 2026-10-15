'use strict';
const { canRunBroadcast, broadcastAccessMessage } = require('../../Plugin/broadcastAccess');
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function findPollCreation(message, seen = new WeakSet()) {
    if (!message || typeof message !== 'object') return null;
    if (seen.has(message)) return null;
    seen.add(message);

    for (const [key, value] of Object.entries(message)) {
        if (/^pollCreationMessage(?:V\d+)?$/.test(key) && value && typeof value === 'object') {
            return value;
        }
        const found = findPollCreation(value, seen);
        if (found) return found;
    }
    return null;
}

function getPollPayload(source) {
    const poll = findPollCreation(source?.message || source);
    if (!poll?.name || !Array.isArray(poll.options) || !poll.options.length) return null;

    const values = poll.options
        .map(option => typeof option === 'string' ? option : option?.optionName)
        .filter(Boolean);
    if (!values.length) return null;

    return {
        poll: {
            name: poll.name,
            values,
            selectableCount: Number(poll.selectableOptionsCount || poll.selectableCount || 1)
        }
    };
}

async function sendBroadcastContent(sock, jid, source, text) {
    if (source) {
        const pollPayload = getPollPayload(source);
        if (pollPayload) return sock.sendMessage(jid, pollPayload);

        // Use the native forward payload first. Unlike the older
        // copyNForward helper, this preserves the complete WebMessageInfo
        // envelope, including media, view-once wrappers, status mentions,
        // albums, carousels, and bot/rich response messages.
        if (typeof sock.sendMessage === 'function') {
            try {
                return await sock.sendMessage(jid, { forward: source, force: true });
            } catch (error) {
                // Some older plogme builds do not implement the native
                // forward payload; retain compatibility with those builds.
                if (typeof sock.copyNForward !== 'function') throw error;
                return sock.copyNForward(jid, source, true);
            }
        }
        if (typeof sock.copyNForward === 'function') return sock.copyNForward(jid, source, true);
        throw new Error('No message-forwarding method is available');
    }
    return sock.sendMessage(jid, { text });
}
module.exports = {
    name: 'broadcast',
    alias: ['bc', 'broadcastall'],
    desc: 'Broadcast a quoted message or text to every participating group',
    category: 'Admin',
    groupOnly: false,
    adminOnly: false,
    reactions: { start: '📢', success: '✅' },
    execute: async (sock, m, { args, reply, isOwner, isDual, isAdmin, isGroupAdmin }) => {
        if (!canRunBroadcast(m, { isOwner, isDual, isAdmin, isGroupAdmin })) {
            return reply(broadcastAccessMessage(m));
        }
        if (typeof sock.groupFetchAllParticipating !== 'function') return reply('Unable to fetch groups right now.');
        const source = m.quoted?.fakeObj || null;
        const text = args.join(' ').trim();
        if (!source && !text) return reply('Reply to any message and use /broadcast, or use /broadcast <text>.');
        const all = await sock.groupFetchAllParticipating().catch(() => null);
        const groups = Object.keys(all || {}).filter(jid => jid.endsWith('@g.us'));
        if (!groups.length) return reply('No participating groups were found.');
        let sent = 0;
        let failed = 0;
        for (const group of groups) {
            try {
                await sendBroadcastContent(sock, group, source, text);
                sent++;
                await sleep(250);
            } catch (error) {
                failed++;
                console.error('[BROADCAST]', group, error?.message || error);
            }
        }
        return reply(`📢 *Broadcast complete*\n• Sent: ${sent}\n• Failed: ${failed}\n• Content: ${source ? 'original quoted message' : 'text'}`);
    }
};
module.exports.sendBroadcastContent = sendBroadcastContent;
module.exports.getPollPayload = getPollPayload;
