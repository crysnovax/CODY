const mumaker = require('mumaker');

module.exports = {
    name: 'neont',
    alias: [],
    desc: 'Create a colorful neon light text effect',
    category: 'textmaker',
    usage: `.neont <text>`,
    reactions: {
        start: '💫',
        success: '🌟'
    },

    execute: async (sock, m, { args, reply }) => {
        const text = args.join(' ');

        if (!text) {
            return reply(
                `╭─❍ *NEON TEXT*\n│\n│ ✘ Provide text\n│\n│ ⚉ Usage: .neont <text>\n│\n│ 𓄄 Example:\n│   .neont Nick\n╰──────────────────`
            );
        }

        try {
            const result = await mumaker.ephoto('https://en.ephoto360.com/create-colorful-neon-light-text-effects-online-797.html', text);

            if (!result || !result.image) {
                throw new Error('No image URL received from the API');
            }

            await sock.sendMessage(m.chat, {
                image: { url: result.image },
              //  caption: `╭─❍ *NEON TEXT*\n│\n│ ✓ Generated!\n│\n│ 𓃼 Text: ${text}\n│\n╰──────────────────`
            }, { quoted: m });

        } catch (err) {
            console.error('[NEONT ERROR]', err.message);

            return reply(
                `╭─❍ *NEON TEXT*\n│\n│ ✘ Failed to generate\n│\n│ 𓄇 ${err.message}\n╰──────────────────`
            );
        }
    }
};
