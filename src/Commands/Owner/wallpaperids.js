'use strict';
const { THEME_IDS } = require('./wptest.js');
module.exports = {
    name: 'wallpaperids',
    alias: ['themeids'],
    desc: 'List WhatsApp Web chat-theme IDs available to the test command',
    category: 'Owner',
    ownerOnly: true,
    execute: async (sock, m, { reply }) => {
        const lines = THEME_IDS.map((id, index) => `${index + 1}. ${id} → ${id}@Tonal`).join('\n');
        return reply(
            '╭─❍ *WHATSAPP CHAT THEME IDs*\n│\n' + lines +
            '\n│\n│ Test one with:\n│ *.testwallpaper WhatsApp-Green*\n│\n│ These are confirmed theme IDs. Animated wallpaper IDs are separate.\n╰────────────────'
        );
    }
};
