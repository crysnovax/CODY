'use strict';
const {
    getParticipantCounts,
    getTrackingStartedAt,
    isBotParticipant,
} = require('../../Plugin/groupActivity');
const { formatBotDateTime } = require('../../Utils/timezone');

module.exports = {
    name: 'listinactive',
    alias: ['inactiveusers'],
    desc: 'Mention group members with no messages tracked since activity tracking began',
    category: 'Group',
    groupOnly: true,
    adminOnly: true,
    usage: '.listinactive',
    execute: async (sock, m, { reply }) => {
        const metadata = await sock.groupMetadata(m.chat).catch(() => null);
        if (!metadata?.participants) return reply('Could not read this group’s participants.');

        const counts = await getParticipantCounts(sock, m.chat, metadata.participants);
        const members = [];
        for (const row of counts) {
            if (!row.jid || await isBotParticipant(sock, row.participant)) continue;
            members.push(row);
        }
        const allInactive = members.filter(row => row.count === 0);
        if (!allInactive.length) return reply('No inactive members found; every listed member has sent at least one tracked message.');
        const startedAt = getTrackingStartedAt(m.chat);
        const trackingNote = startedAt
            ? `Tracking began ${formatBotDateTime(startedAt)}. Earlier messages are not available.`
            : 'No group messages have been tracked yet. Tracking begins when the next member message arrives.';
        const heading = `*Inactive members (${allInactive.length}/${members.length})*\n${trackingNote}\n\n`;
        const lines = allInactive.map(row => `• @${row.jid.split('@')[0]}`).join('\n');
        await sock.sendMessage(m.chat, {
            text: `${heading}${lines}`,
            mentions: allInactive.map(row => row.jid),
        }, { quoted: m });
    },
};
