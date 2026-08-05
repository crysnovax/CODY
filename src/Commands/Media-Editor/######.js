const mumaker = require('mumaker');

module.exports = {
    name: 'metallic',
    alias: [],
    desc: 'Create a decorative 3D metal text effect',
    category: 'textmaker',
    usage: `.metallic <text>`,
    reactions: {
        start: '⚙️',
        success: '🪙'
    },

    execute: async (sock, m, { args, reply }) => {
        const text = args.join(' ');

        if (!text) {
            return reply(
                `╭─❍ *METALLIC TEXT*\n│\n│ ✘ Provide text\n│\n│ ⚉ Usage: .metallic <text>\n│\n│ 𓄄 Example:\n│   .metallic Nick\n╰──────────────────`
            );
        }

        try {
            const result = await mumaker.ephoto('https://en.ephoto360.com/impressive-decorative-3d-metal-text-effect-798.html', text);

            if (!result || !result.image) {
                throw new Error('No image URL received from the API');
            }

            await sock.sendMessage(m.chat, {
                image: { url: result.image },
      //          caption: `╭─❍ *METALLIC TEXT*\n│\n│ ✓ Generated!\n│\n│ 𓃼 Text: ${text}\n│\n╰──────────────────`
            }, { quoted: m });

        } catch (err) {
            console.error('[METALLIC ERROR]', err.message);

            return reply(
                `╭─❍ *METALLIC TEXT*\n│\n│ ✘ Failed to generate\n│\n│ 𓄇 ${err.message}\n╰──────────────────`
            );
        }
    }
};
