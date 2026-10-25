'use strict';

const {
    canManageAllAdmin,
    isAllAdminEnabled,
    setAllAdminEnabled,
} = require('../../Plugin/allAdminAccess');

module.exports = {
    name: 'alladmin',
    alias: [],
    desc: 'Let WhatsApp group admins run regular Admin-category bot commands in this group',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,
    usage: '.alladmin on | off | status',
    reactions: { start: '🛡️', success: '✅', error: '❔' },

    execute: async (sock, m, { args = [], reply, prefix = '.', isAdmin = false }) => {
        const groupContext = { isGroup: Boolean(m?.isGroup), isAdmin: Boolean(isAdmin) };
        if (!canManageAllAdmin(groupContext)) {
            return reply('Only a WhatsApp admin of this group can change `.alladmin`.');
        }

        const action = String(args[0] || 'status').trim().toLowerCase();
        const current = isAllAdminEnabled(m.chat);
        if (action === 'status') {
            return reply(`*All Admin Commands*: ${current ? 'ON' : 'OFF'} for this group.\n\n` +
                `When ON, WhatsApp admins may use regular commands in the Admin category without being added as sudo or dual. Commands explicitly marked owner-only or privileged remain protected.\n` +
                `Usage: ${prefix}alladmin on | off | status`);
        }

        if (!['on', 'off', 'enable', 'disable'].includes(action)) {
            return reply(`Usage: ${prefix}alladmin on | off | status`);
        }

        const enabled = action === 'on' || action === 'enable';
        try {
            setAllAdminEnabled(m.chat, enabled);
        } catch (error) {
            console.error('[ALLADMIN] Could not save group setting:', error.message);
            return reply('Could not save this group setting. Check that the bot can write to its database directory.');
        }

        return reply(`*All Admin Commands* are now ${enabled ? 'ON' : 'OFF'} for this group.\n` +
            (enabled
                ? 'Group admins can use regular Admin-category bot commands without sudo/dual. Explicit owner-only and privileged commands remain locked.'
                : 'The group-specific admin access setting has been disabled. Existing command permissions apply.'));
    },
};
