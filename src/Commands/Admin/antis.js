'use strict';
const { isModerationEnabled } = require('../../Plugin/moderationControl');
const { setAllModerationSettings } = require('../../Plugin/bulkModeration');
module.exports = {
    name: 'antis',
    alias: ['antisystem', 'antimoderation', 'moderation'],
    desc: 'Enable or disable all moderation antisystems in this group',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,
    reactions: { start: '🛡️', success: '✅' },
    execute: async (sock, m, { args, reply }) => {
        const subcommand = String(args[0] || 'status').toLowerCase();
        if (subcommand === 'status') {
            return reply(`*All Moderation Antis*: ${isModerationEnabled(m.chat) ? 'ON' : 'OFF'}\n\n` +
                `Controls every configured anti feature together, including group-management protections.\n` +
                `Usage: /antis on | /antis off`);
        }
        if (subcommand !== 'on' && subcommand !== 'off') {
            return reply('Usage: /antis on | /antis off | /antis status');
        }
        const enabled = subcommand === 'on';
        setAllModerationSettings(m.chat, enabled);
        return reply(`*All Moderation Antis* ${enabled ? 'enabled' : 'disabled'} for this group.\n` +
            `Every individual anti setting was ${enabled ? 'turned ON' : 'turned OFF'}.`);
    }
};
