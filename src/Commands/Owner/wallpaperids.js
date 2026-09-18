'use strict';
const { THEME_IDS } = require('./wptest.js');
module.exports = {
    name: 'wallpaperids',
    alias: ['themeids'],
    desc: 'List WhatsApp chat color-scheme IDs',
    category: 'Owner',
    ownerOnly: true,
    execute: async (sock, m, { reply }) => {
        const lines = THEME_IDS.map((id, index) => `${index + 1}. ${id} → ${id}@Tonal`).join('\n');
        return reply(
            '╭─❍ *WHATSAPP CHAT COLOR SCHEMES*\n│\n' + lines +
            '\n│\n│ Test one with:\n│ *.testwallpaper WhatsApp-Green*\n│\n│ These are static color-scheme IDs, not animated wallpaper IDs.\n│ Animated wallpapers require a separate real asset ID.\n╰────────────────'
        );
    }
};
