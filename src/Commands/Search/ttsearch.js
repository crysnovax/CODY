// tiktok.js (TikWM version)
const axios = require('axios');

module.exports = {
    name: 'tiktoksearch',
    alias: ['ttsearch', 'tiktoks'],
    desc: 'Search TikTok and return the closest match',
    category: 'Search',
    usage: `.tiktok <search query>`,
    examples: ['.tiktok AI automation', '.tt Ronaldo funny'],
    reactions: { start: '📥', success: '❤️‍🩹', error: '❔' },

    execute: async (sock, m, { args, reply }) => {
        const query = args.join(' ').trim();
        if (!query) return reply(`${prefix}Usage: tiktok <query>`);

        await sock.sendMessage(m.chat, { react: { text: '📥', key: m.key } });

        try {
            const response = await axios.get(`https://tikwm.com/api/feed/search?keywords=${encodeURIComponent(query)}&count=1`, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const videos = response.data?.data?.videos || [];
            if (!videos.length) {
                await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
                return reply(`No results for: ${query}`);
            }

            const video = videos[0];
            const videoUrl = video.play || video.wmplay;
            const caption = `@${video.author?.unique_id || 'unknown'} · ${video.duration || 0}s`;

            await sock.sendMessage(m.chat, {
                video: { url: videoUrl },
                caption: caption,
                mimetype: 'video/mp4'
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '❤️‍🩹', key: m.key } });

        } catch (error) {
            console.error('[TIKTOK ERROR]', error.message);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            reply('Error fetching video.');
        }
    }
};
