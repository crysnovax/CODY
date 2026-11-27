'use strict';

const { listThemes, resolveChatTarget, resolveTheme, themePayload } = require('./chat-customization');

module.exports = {
    name: 'theme',
    alias: [],
    category: 'Tools',
    desc: 'Change the chat theme in a DM or group',
    adminOnly: false,
    groupOnly: false,
    usage: '.theme [jid/lid/group-link] <theme|list> [--dark|--light]',
    execute: async (sock, m, { args = [], reply }) => {
        try {
            const resolved = await resolveChatTarget(sock, m, args);
            const cleanArgs = resolved.args.filter(arg => !/^--(?:dark|light)$/i.test(String(arg)));
            if (cleanArgs.length === 1 && /^list$/i.test(cleanArgs[0])) {
                return reply(`Available color-scheme themes:\n${listThemes().join('\n')}`);
            }
            const requested = cleanArgs.join(' ').trim();
            if (!requested) {
                return reply(`Available themes:\n${listThemes().join('\n')}\n\nExample: .theme emerald`);
            }
            const colorSchemeId = resolveTheme(requested);
            if (!colorSchemeId) return reply('Unknown theme. Try a name, a full color-scheme ID, or .theme list.');
            await sock.sendMessage(resolved.target, themePayload(colorSchemeId), { quoted: m });
            return reply(`Chat theme changed to ${colorSchemeId}${resolved.target !== m.chat ? ` for ${resolved.target}` : ''}.`);
        } catch (error) {
            return reply(`✘ Chat theme failed: ${error.message}`);
        }
    }
};
