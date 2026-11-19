'use strict';

module.exports = {
    name: 'togglehistory',
    alias: ['grouphistory'],
    category: 'Admin',
    desc: 'Set whether all group members may share recent group history',
    usage: '.togglehistory <on|off>',
    groupOnly: true,
    adminOnly: true,
    reactions: { start: '🕘', success: '✅', error: '❌' },

    execute: async (sock, m, { args = [], reply, prefix = '.' } = {}) => {
        const groupJid = m?.chat || '';
        if (!groupJid.endsWith('@g.us')) {
            return reply('This command can only be used in a group.');
        }

        const mode = String(args[0] || '').trim().toLowerCase();
        if (!['on', 'off'].includes(mode)) {
            return reply(`Usage: ${prefix}togglehistory <on|off>\nOn allows all members to share group history; off limits sharing to admins.`);
        }

        if (typeof sock.toggleGroupHistory !== 'function') {
            return reply('This WhatsApp connection does not support group-history settings.');
        }

        try {
            await sock.toggleGroupHistory(groupJid, mode === 'on');
            return reply(mode === 'on'
                ? 'Group history sharing is enabled for all members.'
                : 'Group history sharing is now limited to admins.');
        } catch (error) {
            console.error('[TOGGLEHISTORY ERROR]', error?.stack || error);
            return reply(`Could not update group-history sharing: ${error?.message || 'unknown error'}`);
        }
    }
};
