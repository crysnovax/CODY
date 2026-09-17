'use strict';

const fs = require('fs');
const path = require('path');

// Extracted from the current WhatsApp Web chat-theme enum. These are theme
// families; the wire message uses the corresponding @Tonal colorSchemeId.
const THEME_IDS = [
    'WhatsApp-Green',
    'Pearl-Indigo',
    'Tyrian-Purple',
    'Sunset-Orange',
    'Merino-Teal',
    'Royal-Blue',
    'Dark-Cerulean',
    'Charcoal-Green',
    'Persian-Plum',
    'Dune-Mono',
    'Default-Blue',
    'Default-Mono',
    'Sky-Blue',
    'Brown',
    'Cream',
    'Emerald',
    'Lemon',
    'Lime',
    'Pink',
    'Red',
    'Sunrise-Orange',
    'Warm-Yellow'
];

const ASSET_DIR = path.join(__dirname, '../../Assets/feature-tests');
const STICKER = path.join(ASSET_DIR, 'test-sticker.webp');
const STICKER_AUDIO = path.join(ASSET_DIR, 'test-sticker-audio.ogg');

function themeList() {
    return THEME_IDS.map((id, index) => `${index + 1}. ${id}  →  ${id}@Tonal`).join('\n');
}

module.exports = {
    name: 'teststicker',
    alias: ['wptest', 'wallpaperids', 'testwallpaper'],
    desc: 'Test sticker audio and WhatsApp chat themes',
    category: 'Owner',
    ownerOnly: true,
    usage: '.teststicker | .wallpaperids | .testwallpaper <theme-id> | .testwallpaper animated <id>',
    execute: async (sock, m, { args, reply }) => {
        const action = String(args[0] || 'sticker').toLowerCase();

        if (action === 'ids' || action === 'list' || action === 'wallpaperids') {
            return reply(
                '╭─❍ *WHATSAPP CHAT THEME IDs*\n' +
                '│\n' + themeList() +
                '\n│\n│ Test one with:\n│ *.testwallpaper WhatsApp-Green*\n│\n│ These are confirmed theme IDs. Animated wallpaper IDs are a separate private catalog.\n╰────────────────'
            );
        }

        if (action === 'animated') {
            const animatedId = args[1];
            if (!animatedId) {
                return reply('Usage: .testwallpaper animated <real WhatsApp animated wallpaper ID>');
            }
            try {
                await sock.sendMessage(m.chat, {
                    chatTheme: {
                        animatedWallpaper: { id: animatedId, dimLevel: 0.25 }
                    }
                }, { quoted: m });
                return reply(`Animated wallpaper payload sent for ID: ${animatedId}`);
            } catch (error) {
                return reply(`✘ Animated wallpaper failed: ${error.message}`);
            }
        }

        if (action === 'theme' || action === 'testwallpaper' || THEME_IDS.includes(args[0])) {
            const themeId = action === 'theme' || action === 'testwallpaper' ? args[1] : args[0];
            const selected = THEME_IDS.find(id => id.toLowerCase() === String(themeId || '').toLowerCase());
            if (!selected) return reply('Unknown theme ID. Use .wallpaperids to list valid IDs.');
            try {
                await sock.sendMessage(m.chat, {
                    chatTheme: { chatThemeId: selected }
                }, { quoted: m });
                return reply(`Chat theme payload sent: ${selected} (${selected}@Tonal)`);
            } catch (error) {
                return reply(`✘ Chat theme failed: ${error.message}`);
            }
        }

        if (!fs.existsSync(STICKER) || !fs.existsSync(STICKER_AUDIO)) {
            return reply('✘ Test media assets are missing from CODY.');
        }

        try {
            await sock.sendMessage(m.chat, {
                sticker: { url: STICKER },
                stickerAudio: { url: STICKER_AUDIO }
            }, { quoted: m });
            return reply('✓ Sticker with embedded audio sent.');
        } catch (error) {
            return reply(`✘ Sticker/audio test failed: ${error.message}`);
        }
    }
};

module.exports.THEME_IDS = THEME_IDS;
