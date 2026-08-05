const mumaker = require('mumaker');

module.exports = {
    name: 'thunder',
    alias: [],
    desc: 'Create a thunder/lightning text effect',
    category: 'textmaker',
    usage: `.thunder <text>`,
    reactions: {
        start: '🌩️',
        success: '⚡'
    },

    execute: async (sock, m, { args, reply }) => {
        const text = args.join(' ');

        if (!text) {
            return reply(
                `╭─❍ *THUNDER TEXT*\n│\n│ ✘ Provide text\n│\n│ ⚉ Usage: .thunder <text>\n│\n│ 𓄄 Example:\n│   .thunder Nick\n╰──────────────────`
            );
        }

        try {
            const result = await mumaker.ephoto('https://en.ephoto360.com/thunder-text-effect-online-97.html', text);

            if (!result || !result.image) {
                throw new Error('No image URL received from the API');
            }

            await sock.sendMessage(m.chat, {
                image: { url: result.image },
           //     caption: `╭─❍ *THUNDER TEXT*\n│\n│ ✓ Generated!\n│\n│ 𓃼 Text: ${text}\n│\n╰──────────────────`
            }, { quoted: m });

        } catch (err) {
            console.error('[THUNDER ERROR]', err.message);

            return reply(
                `╭─❍ *THUNDER TEXT*\n│\n│ ✘ Failed to generate\n│\n│ 𓄇 ${err.message}\n╰──────────────────`
            );
        }
    }
};
