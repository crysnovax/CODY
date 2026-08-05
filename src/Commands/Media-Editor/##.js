const mumaker = require('mumaker');

module.exports = {
    name: 'purplet',
    alias: [],
    desc: 'Create a purple text effect',
    category: 'textmaker',
    usage: `.purplet <text>`,
    reactions: {
        start: '💜',
        success: '🟣'
    },

    execute: async (sock, m, { args, reply }) => {
        const text = args.join(' ');

        if (!text) {
            return reply(
                `╭─❍ *PURPLE TEXT*\n│\n│ ✘ Provide text\n│\n│ ⚉ Usage: .purplet <text>\n│\n│ 𓄄 Example:\n│   .purplet Nick\n╰──────────────────`
            );
        }

        try {
            const result = await mumaker.ephoto('https://en.ephoto360.com/purple-text-effect-online-100.html', text);

            if (!result || !result.image) {
                throw new Error('No image URL received from the API');
            }

            await sock.sendMessage(m.chat, {
                image: { url: result.image },
           //     caption: `╭─❍ *PURPLE TEXT*\n│\n│ ✓ Generated!\n│\n│ 𓃼 Text: ${text}\n│\n╰──────────────────`
            }, { quoted: m });

        } catch (err) {
            console.error('[PURPLET ERROR]', err.message);

            return reply(
                `╭─❍ *PURPLE TEXT*\n│\n│ ✘ Failed to generate\n│\n│ 𓄇 ${err.message}\n╰──────────────────`
            );
        }
    }
};
