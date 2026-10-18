'use strict';

const {
    addPermit,
    listPermits,
    removePermit,
    resolvePermitTarget,
} = require('../../Plugin/antiPermit');

module.exports = {
    name: 'permit',
    alias: ['antipermit', 'antiimmune'],
    desc: 'Allow a trusted non-admin user to bypass message-based antisystem moderation in this group',
    category: 'Owner',
    ownerOnly: true,
    groupOnly: true,
    reactions: { start: '🛡️', success: '✅' },
    execute: async (sock, m, { args, reply, prefix, isOwner }) => {
        if (!isOwner) return;
        const action = String(args?.[0] || 'add').toLowerCase();
        if (action === 'list') {
            const permits = listPermits(m.chat);
            if (!permits.length) return reply('No anti-system permits are configured for this group.');
            return reply(`*Anti-system permits for this group*\n\n${permits.map(jid => `• @${jid.split('@')[0]}`).join('\n')}\n\nThese users bypass message-based anti moderation only; they do not become WhatsApp admins.`, { mentions: permits });
        }

        const removing = ['remove', 'del', 'delete', 'revoke', 'unpermit'].includes(action);
        const targetText = removing ? args.slice(1).join(' ') : args.join(' ');
        const target = await resolvePermitTarget(sock, m, targetText);
        if (!target) {
            return reply(`Usage:\n• ${prefix}permit @user (or reply to a user)\n• ${prefix}permit remove @user\n• ${prefix}permit list`);
        }

        if (removing) {
            const result = removePermit(m.chat, target);
            if (!result.changed) return reply(`@${target.split('@')[0]} is not in this group's anti-system permit list.`, { mentions: [target] });
            return reply(`Anti-system immunity revoked for @${target.split('@')[0]}.`, { mentions: [target] });
        }

        const result = addPermit(m.chat, target);
        if (!result.changed) return reply(`@${target.split('@')[0]} is already permitted in this group.`, { mentions: [target] });
        return reply(`@${target.split('@')[0]} is now immune to message-based antisystem moderation in this group.\n_This does not grant WhatsApp admin or bot-command privileges._`, { mentions: [target] });
    },
};
