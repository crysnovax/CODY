const mumaker = require('mumaker');

module.exports = {
    name: 'hacker',
    alias: [],
    desc: 'Create an anonymous hacker cyan neon text effect',
    category: 'textmaker',
    usage: `.hacker <text>`,
    reactions: {
        start: '💻',
        success: '⌨️'
    },

    execute: async (sock, m, { args, reply }) => {
        const text = args.join(' ');

        if (!text) {
            return reply(
                `╭─❍ *HACKER TEXT*\n│\n│ ✘ Provide text\n│\n│ ⚉ Usage: .hacker <text>\n│\n│ 𓄄 Example:\n│   .hacker Nick\n╰──────────────────`
            );
        }

        try {
            const result = await mumaker.ephoto('https://en.ephoto360.com/create-anonymous-hacker-avatars-cyan-neon-677.html', text);

            if (!result || !result.image) {
                throw new Error('No image URL received from the API');
            }

            await sock.sendMessage(m.chat, {
                image: { url: result.image },
        //        caption: `╭─❍ *HACKER TEXT*\n│\n│ ✓ Generated!\n│\n│ 𓃼 Text: ${text}\n│\n╰──────────────────`
            }, { quoted: m });

        } catch (err) {
            console.error('[HACKER ERROR]', err.message);

            return reply(
                `╭─❍ *HACKER TEXT*\n│\n│ ✘ Failed to generate\n│\n│ 𓄇 ${err.message}\n╰──────────────────`
            );
        }
    }
};
