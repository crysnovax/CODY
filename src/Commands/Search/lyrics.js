// lyrics.js
const axios = require('axios');

module.exports = {
    name: 'lyrics',
    alias: ['lyric', 'songlyrics'],
    desc: 'Search and return song lyrics',
    category: 'Search',
    usage: `.lyrics <song title>`,
    examples: ['.lyrics Assurance by Davido', '.lyrics Shape of You'],
    reactions: { start: '📥', success: '❤️‍🩹', error: '❔' },

    execute: async (sock, m, { args, reply , prefix}) => {
        const query = args.join(' ').trim();
        if (!query) return reply(`${prefix}Usage: lyrics <song title>`);

        await sock.sendMessage(m.chat, { react: { text: '📥', key: m.key } });

        try {
            const { data } = await axios.get(`https://docs.prexzyapis.com/search/lyrics?title=${encodeURIComponent(query)}`, {
                timeout: 15000
            });

            if (!data.status || !data.data) {
                await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
                return reply(`No lyrics found for: ${query}`);
            }

            const song = data.data;
            
            // Build clean caption - NO EMOJIS
            let caption = `${song.title || 'Unknown'}\n`;
            caption += `${song.artist || 'Unknown'}\n\n`;
            caption += song.lyrics || 'No lyrics available';

            // Split if too long (WhatsApp limit 4096 chars)
            const maxLength = 4096;
            if (caption.length > maxLength) {
                const parts = caption.match(new RegExp(`[\\s\\S]{1,${maxLength}}`, 'g')) || [];
                for (const part of parts) {
                    await sock.sendMessage(m.chat, { text: part }, { quoted: m });
                }
            } else {
                await sock.sendMessage(m.chat, { text: caption }, { quoted: m });
            }

            await sock.sendMessage(m.chat, { react: { text: '❤️‍🩹', key: m.key } });

        } catch (error) {
            console.error('[LYRICS ERROR]', error.message);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            reply('Error fetching lyrics.');
        }
    }
};
