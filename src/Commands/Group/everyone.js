'use strict';

const { canTag, quotedText, sendGroupTag } = require('../../Plugin/groupTag');

module.exports = {
    name: 'everyone',
    alias: [],
    desc: 'Post a green group tag using your text or a replied-to message',
    category: 'Group',
    groupOnly: true,
    // Let the command apply its own mode-sensitive access rule. The command
    // router otherwise silences all non-sudo commands while the bot is private.
    allowInPrivateMode: true,
    usage: `${global.prefix ?? '.'}everyone <text> (or reply to a text message)`,
    reactions: { start: '👥', success: '📢', error: '❌' },

    execute: async (sock, m, {
        args = [], prefix = '.', reply,
        config, getVar, isAdmin, isOwner, isSudo, isDual, groupMeta
    }) => {
        try {
            if (!canTag({ config, getVar, isAdmin, isOwner, isSudo, isDual })) {
                return reply(`ⓘ Only group admins/moderators or bot staff can use ${prefix}everyone while the bot is private.`);
            }

            const text = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim()
                || quotedText(m);
            if (!text) {
                return reply(
                    `Provide text for the group tag, or reply to a text message.\n` +
                    `Example: ${prefix}everyone hello`
                );
            }

            return await sendGroupTag(sock, m, groupMeta, text);
        } catch (error) {
            return reply(`♲ Failed to tag everyone: ${error?.message || error}`);
        }
    }
};
