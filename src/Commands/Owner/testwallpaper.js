'use strict';
const { THEME_IDS } = require('./wptest.js');
module.exports = {
    name: 'testwallpaper',
    alias: ['testtheme'],
    desc: 'Send a WhatsApp chat theme or animated-wallpaper payload',
    category: 'Owner',
    ownerOnly: true,
    usage: '.testwallpaper <theme-id> | .testwallpaper animated <id>',
    execute: async (sock, m, { args, reply }) => {
        const action = String(args[0] || '').toLowerCase();
        if (action === 'animated') {
            const id = args[1];
            if (!id) return reply('Usage: .testwallpaper animated <real animated wallpaper ID>');
            try {
                await sock.sendMessage(m.chat, {
                    chatTheme: { animatedWallpaper: { id, dimLevel: 0.25 } }
                }, { quoted: m });
                return reply(`Animated wallpaper payload sent for ID: ${id}`);
            } catch (error) {
                return reply(`✘ Animated wallpaper failed: ${error.message}`);
            }
        }

        const selected = THEME_IDS.find(id => id.toLowerCase() === action);
        if (!selected) return reply('Unknown theme ID. Use .wallpaperids first.');
        try {
            await sock.sendMessage(m.chat, {
                chatTheme: { chatThemeId: selected }
            }, { quoted: m });
            return reply(`Chat theme payload sent: ${selected} (${selected}@Tonal)`);
        } catch (error) {
            return reply(`✘ Chat theme failed: ${error.message}`);
        }
    }
};
