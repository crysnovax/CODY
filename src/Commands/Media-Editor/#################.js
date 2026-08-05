const mumaker = require('mumaker');

module.exports = {
    name: 'arena',
    alias: [],
    desc: 'Create an Arena of Valor style text effect',
    category: 'textmaker',
    usage: `.arena <text>`,
    reactions: {
        start: '🎬',
        success: '✨'
    },

    execute: async (sock, m, { args, reply }) => {
        const text = args.join(' ');

        if (!text) {
            return reply(
                `╭─❍ *ARENA TEXT*\n│\n│ ✘ Provide text\n│\n│ ⚉ Usage: .arena <text>\n│\n│ 𓄄 Example:\n│   .arena Nick\n╰──────────────────`
            );
        }

        try {
            const result = await mumaker.ephoto('https://en.ephoto360.com/create-cover-arena-of-valor-by-mastering-360.html', text);

            if (!result || !result.image) {
                throw new Error('No image URL received from the API');
            }

            await sock.sendMessage(m.chat, {
                image: { url: result.image },
         //       caption: `╭─❍ *ARENA TEXT*\n│\n│ ✓ Generated!\n│\n│ 𓃼 Text: ${text}\n│\n╰──────────────────`
            }, { quoted: m });

        } catch (err) {
            console.error('[ARENA ERROR]', err.message);

            return reply(
                `╭─❍ *ARENA TEXT*\n│\n│ ✘ Failed to generate\n│\n│ 𓄇 ${err.message}\n╰──────────────────`
            );
        }
    }
};
