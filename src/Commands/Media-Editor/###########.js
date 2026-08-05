const mumaker = require('mumaker');

module.exports = {
    name: 'ice',
    alias: [],
    desc: 'Create an ice/frozen text effect',
    category: 'textmaker',
    usage: `.ice <text>`,
    reactions: {
        start: '❄️',
        success: '🧊'
    },

    execute: async (sock, m, { args, reply }) => {
        const text = args.join(' ');

        if (!text) {
            return reply(
                `╭─❍ *ICE TEXT*\n│\n│ ✘ Provide text\n│\n│ ⚉ Usage: .ice <text>\n│\n│ 𓄄 Example:\n│   .ice Nick\n╰──────────────────`
            );
        }

        try {
            const result = await mumaker.ephoto('https://en.ephoto360.com/ice-text-effect-online-101.html', text);

            if (!result || !result.image) {
                throw new Error('No image URL received from the API');
            }

            await sock.sendMessage(m.chat, {
                image: { url: result.image },
      //          caption: `╭─❍ *ICE TEXT*\n│\n│ ✓ Generated!\n│\n│ 𓃼 Text: ${text}\n│\n╰──────────────────`
            }, { quoted: m });

        } catch (err) {
            console.error('[ICE ERROR]', err.message);

            return reply(
                `╭─❍ *ICE TEXT*\n│\n│ ✘ Failed to generate\n│\n│ 𓄇 ${err.message}\n╰──────────────────`
            );
        }
    }
};
