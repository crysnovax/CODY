'use strict';

const { THEME_IDS, resolveTheme, themePayload } = require('./chat-customization');

module.exports = {
    name: 'theme',
    alias: [],
    category: 'Tools',
    desc: 'Change the chat theme in a DM or group',
    adminOnly: false,
    groupOnly: false,
    usage: '.theme <default|blue|emerald|pink|red|purple|green|theme-id>',
    execute: async (sock, m, { args = [], reply }) => {
        const requested = args.join(' ').trim();
        if (!requested) {
            return reply(`Available themes:\n${[...new Set(Object.values(THEME_IDS))].join('\n')}\n\nExample: .theme emerald`);
        }
        const colorSchemeId = resolveTheme(requested);
        if (!colorSchemeId) return reply('Unknown theme. Try: default, blue, emerald, pink, red, purple, green, or a full color-scheme ID.');
        try {
            await sock.sendMessage(m.chat, themePayload(colorSchemeId), { quoted: m });
            return reply(`Chat theme changed to ${colorSchemeId}.`);
        } catch (error) {
            return reply(`✘ Chat theme failed: ${error.message}`);
        }
    }
};
