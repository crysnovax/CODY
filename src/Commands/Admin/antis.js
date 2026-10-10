'use strict';

const { isModerationEnabled, setModerationEnabled } = require('../../Plugin/moderationControl');

module.exports = {
    name: 'antis',
    alias: ['antisystem', 'antimoderation', 'moderation'],
    desc: 'Enable or disable all passive moderation antisystems in this group',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,
    reactions: { start: '🛡️', success: '✅' },
    execute: async (sock, m, { args, reply }) => {
        const subcommand = String(args[0] || 'status').toLowerCase();
        if (subcommand === 'status') {
            return reply(`*Moderation Antis*: ${isModerationEnabled(m.chat) ? 'ON' : 'OFF'}\n\n` +
                `Controls the passive group moderation antis only.\n` +
                `Usage: /antis on | /antis off`);
        }
        if (subcommand !== 'on' && subcommand !== 'off') {
            return reply('Usage: /antis on | /antis off | /antis status');
        }
        const enabled = subcommand === 'on';
        setModerationEnabled(m.chat, enabled);
        return reply(`*Moderation Antis* ${enabled ? 'enabled' : 'disabled'} for this group.\n` +
            (enabled ? 'Individual anti settings still apply.' : 'Individual anti settings were not changed.'));
    }
};
