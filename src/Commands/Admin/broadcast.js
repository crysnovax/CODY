'use strict';
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
module.exports = {
    name: 'broadcast',
    alias: ['bc', 'broadcastall'],
    desc: 'Broadcast a quoted message or text to every participating group',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,
    reactions: { start: '📢', success: '✅' },
    execute: async (sock, m, { args, reply }) => {
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
                if (source && typeof sock.copyNForward === 'function') {
                    await sock.copyNForward(group, source, true);
                } else {
                    await sock.sendMessage(group, { text });
                }
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
