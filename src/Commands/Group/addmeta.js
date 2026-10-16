'use strict';

const { resolveGroupTarget } = require('./gsdm');

module.exports = {
    name: 'addmeta',
    alias: ['metagroup', 'addmetabot'],
    desc: 'Add Meta AI to a group',
    category: 'Group',
    groupOnly: false,
    usage: '.addmeta here | <group link> | <group JID>',
    execute: async (sock, m, { args = [], reply }) => {
        const input = String(args.join(' ').trim());
        if (!input) {
            return reply('`✘ Usage: .addmeta here | <group link> | <group JID>`');
        }

        try {
            let groupJid;
            if (input.toLowerCase() === 'here') {
                if (!String(m.chat || '').endsWith('@g.us')) {
                    return reply('`✘ Use .addmeta here inside a group, or provide a group link/JID`');
                }
                groupJid = m.chat;
            } else {
                groupJid = await resolveGroupTarget(sock, input);
            }
            if (!groupJid) return reply('`✘ Provide a valid WhatsApp group link or group JID`');
            if (typeof sock.aiGroupAddBot !== 'function') {
                throw new Error('This Baileys runtime does not support adding Meta AI to groups');
            }

            await sock.aiGroupAddBot(groupJid);
            return reply(`Meta AI ┊ invoked`);
        } catch (error) {
            console.error('[ADDMETA ERROR]', error);
            return reply(`\`✘ ${error.message || 'Unable to add Meta AI to that group'}\``);
        }
    }
};
