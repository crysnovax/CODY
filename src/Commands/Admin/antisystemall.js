'use strict';
const { setAllModerationSettings, isAdminParticipant } = require('../../Plugin/bulkModeration');
module.exports = {
    name: 'antisystemall',
    alias: ['antisall', 'allantis'],
    desc: 'Bulk-toggle all antis in every group where you are an admin',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,
    reactions: { start: '🛡️', success: '😤' },
    execute: async (sock, m, { args, reply }) => {
        const action = String(args[0] || 'on').toLowerCase();
        if (!['on', 'off'].includes(action)) return reply('Usage: /antisystemall on | /antisystemall off');
        if (typeof sock.groupFetchAllParticipating !== 'function') return reply('Unable to fetch the groups right now.');
        const all = await sock.groupFetchAllParticipating().catch(() => null);
        if (!all) return reply('Unable to fetch the groups right now.');
        const candidates = [m.sender, m.key?.participant, m.key?.participantAlt];
        let changed = 0;
        let skipped = 0;
        for (const [jid, group] of Object.entries(all)) {
            if (!jid.endsWith('@g.us')) continue;
            const metadata = group?.participants ? group : await sock.groupMetadata(jid).catch(() => null);
            if (!isAdminParticipant(metadata, candidates)) { skipped++; continue; }
            setAllModerationSettings(jid, action === 'on');
            changed++;
        }
        return reply(`*Antisystemall complete*\n• Action: ${action.toUpperCase()}\n• Groups changed: ${changed}\n• Groups skipped (you are not an admin): ${skipped}`);
    }
};
