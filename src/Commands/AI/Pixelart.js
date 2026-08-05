const axios = require("axios");
const config = require("../../../settings/config");

// Use AI image API base from config (or fallback to direct URL)
const IMAGE_API_BASE = process.env.IMAGE_API_BASE || config.api?.imageBase || '';

module.exports = {
    name: 'pixelart',
    alias: ['pixelai', '8bit', 'retroart'],
    category: 'AI',
    desc: 'Generate pixel art AI images powered by CRYSNOVA',

    execute: async (sock, m, { args, reply , prefix}) => {
        try {
            if (!args.length) {
                return reply(`${prefix}ಠ_ಠ *PIXEL ART AI*\n\nUsage: pixelart <prompt>\nExample: .pixelart cyberpunk city`);
            }

            const basePrompt = args.join(' ').trim();
            if (!basePrompt) return reply('✘ Give a valid prompt');

            await sock.sendPresenceUpdate('composing', m.chat);
            await sock.sendMessage(m.chat, { react: { text: '👾', key: m.key } });

            // Enhance prompt for pixel art style
            const enhancedPrompt = `${basePrompt}, pixel art, 8-bit style, retro gaming aesthetic, crisp pixels`;
            const negative = `blurry, smooth, realistic, 3d render, photorealistic, high resolution, anti-aliasing`;

            // Build URL from configurable base
            const url = `${IMAGE_API_BASE}/pixel-art?prompt=${encodeURIComponent(enhancedPrompt)}&negative_prompt=${encodeURIComponent(negative)}`;

            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 60000
            });

            if (!response.data) return reply('✘ Failed to generate pixel art');

            const buffer = Buffer.from(response.data);

            await sock.sendMessage(m.chat, {
                image: buffer,
                caption: `𖣘 *PIXEL ART*\n\n👾 ${basePrompt}\n\n_⚉ 8-bit retro style | CRYSNOVA_`
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '✓', key: m.key } });

        } catch (err) {
            console.error('[PIXELART ERROR]', err);
            reply('✘ Failed to generate pixel art');
        }
    }
};
