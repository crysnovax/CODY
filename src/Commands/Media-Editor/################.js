const mumaker = require('mumaker');

module.exports = {
    name: 'blackpink',
    alias: [],
    desc: 'Create a Blackpink style logo text effect',
    category: 'textmaker',
    usage: `.blackpink <text>`,
    reactions: {
        start: '🖤',
        success: '💗'
    },

    execute: async (sock, m, { args, reply }) => {
        const text = args.join(' ');

        if (!text) {
            return reply(
                `╭─❍ *BLACKPINK TEXT*\n│\n│ ✘ Provide text\n│\n│ ⚉ Usage: .blackpink <text>\n│\n│ 𓄄 Example:\n│   .blackpink Nick\n╰──────────────────`
            );
        }

        try {
            const result = await mumaker.ephoto('https://en.ephoto360.com/create-a-blackpink-style-logo-with-members-signatures-810.html', text);

            if (!result || !result.image) {
                throw new Error('No image URL received from the API');
            }

            await sock.sendMessage(m.chat, {
                image: { url: result.image },
         //       caption: `╭─❍ *BLACKPINK TEXT*\n│\n│ ✓ Generated!\n│\n│ 𓃼 Text: ${text}\n│\n╰──────────────────`
            }, { quoted: m });

        } catch (err) {
            console.error('[BLACKPINK ERROR]', err.message);

            return reply(
                `╭─❍ *BLACKPINK TEXT*\n│\n│ ✘ Failed to generate\n│\n│ 𓄇 ${err.message}\n╰──────────────────`
            );
        }
    }
};
