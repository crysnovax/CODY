const axios = require("axios");
const config = require("../../../settings/config");

// Use gateway from config
const GATEWAY_URL = process.env.GATEWAY_URL || config.api?.gateway || '';

module.exports = {
    name: 'horror',
    alias: ['scary', 'creep', 'nightmare'],
    category: 'AI',
    desc: 'Generate horror AI images powered by CRYSNOVA',

    execute: async (sock, m, { args, reply , prefix}) => {
        try {
            if (!args.length) {
                return reply(`${prefix}ಠ_ಠ *HORROR AI*\n\nUsage: horror <prompt>\n       .horror cinematic <prompt>`);
            }

            let isCinematic = false;

            if (args[0].toLowerCase() === 'cinematic') {
                isCinematic = true;
                args.shift();
            }

            const basePrompt = args.join(' ').trim();
            if (!basePrompt) return reply('✘ Give a valid prompt');

            await sock.sendPresenceUpdate('composing', m.chat);
            await sock.sendMessage(m.chat, { react: { text: '🎭', key: m.key } });

            // Enhance prompt based on style
            const enhancedPrompt = isCinematic
                ? `${basePrompt}, cinematic horror, film grain, dramatic lighting, wide shot, 8k, ultra detailed`
                : `${basePrompt}, dark atmosphere, horror style, detailed, chilling`;

            // Call gateway /generate-image endpoint with category 'horror'
            const response = await axios.post(
                `${GATEWAY_URL}/generate-image`,
                {
                    category: 'horror',
                    prompt: enhancedPrompt
                },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 60000
                }
            );

            const imageUrl = response.data?.url;
            if (!imageUrl) return reply('✘ Failed to generate horror image');

            await sock.sendMessage(m.chat, {
                image: { url: imageUrl },
                caption: `𖣘 *HORROR AI*\n\n🎭 ${basePrompt}\n${isCinematic ? '—͟͟͞͞ CINEMATIC' : ''}\n\n_⚉ CRYSNOVA Gateway_`
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '✓', key: m.key } });

        } catch (err) {
            console.error('[HORROR ERROR]', err);
            reply('✘ Failed to summon nightmare');
        }
    }
};
