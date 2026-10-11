'use strict';
const {
    getParticipantCounts,
    getTrackingStartedAt,
    isBotParticipant,
} = require('../../Plugin/groupActivity');

const CHUNK_SIZE = 25;

module.exports = {
    name: 'listactive',
    alias: ['activeusers'],
    desc: 'Mention active group members with their tracked message counts',
    category: 'Group',
    groupOnly: true,
    adminOnly: true,
    usage: '.listactive',
    execute: async (sock, m, { reply }) => {
        const metadata = await sock.groupMetadata(m.chat).catch(() => null);
        if (!metadata?.participants) return reply('Could not read this group’s participants.');

        const counts = await getParticipantCounts(sock, m.chat, metadata.participants);
        const members = [];
        for (const row of counts) {
            if (!row.jid || await isBotParticipant(sock, row.participant)) continue;
            members.push(row);
        }
        // Participant metadata is not a ranking: WhatsApp may return members
        // in any order. Rank by message count first, then by most recent
        // activity so the displayed list is deterministic for ties.
        const active = members
            .filter(row => row.count > 0)
            .sort((left, right) =>
                right.count - left.count
                || (Number(right.lastAt) || 0) - (Number(left.lastAt) || 0)
                || String(left.jid).localeCompare(String(right.jid))
            );
        if (!active.length) return reply('No active members found yet; no member messages have been tracked.');

        const startedAt = getTrackingStartedAt(m.chat);
        const trackingNote = startedAt
            ? `Tracking began ${new Date(startedAt).toLocaleString()}. Earlier messages are not available.`
            : 'No group messages have been tracked yet.';
        for (let offset = 0; offset < active.length; offset += CHUNK_SIZE) {
            const chunk = active.slice(offset, offset + CHUNK_SIZE);
            const heading = offset === 0
                ? `*Active members (${active.length}/${members.length})*\n${trackingNote}\n\n`
                : `*Active members — continued (${offset + 1}-${offset + chunk.length}/${active.length})*\n\n`;
            const lines = chunk.map(row => `• @${row.jid.split('@')[0]} — ${row.count} message${row.count === 1 ? '' : 's'}`).join('\n');
            await sock.sendMessage(m.chat, {
                text: `${heading}${lines}`,
                mentions: chunk.map(row => row.jid),
            }, { quoted: m });
        }
    },
};
