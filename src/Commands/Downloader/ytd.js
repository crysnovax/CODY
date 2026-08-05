// yt.js
const axios = require('axios');

module.exports = {
    name: 'yt',
    alias: ['youtube', 'ytdl', 'youtubedownload'],
    desc: 'Download YouTube video',
    category: 'Search',
    usage: `.yt <url>`,
    examples: ['.yt https://youtu.be/rsF9VaubHWM'],
    reactions: { start: '📥', success: '❤️‍🩹', error: '❔' },

    execute: async (sock, m, { args, reply }) => {
        const url = args[0]?.trim();
        if (!url) return reply(`${prefix}Usage: yt <url>`);

        await sock.sendMessage(m.chat, { react: { text: '📥', key: m.key } });

        try {
            const { data } = await axios.get(`https://docs.prexzyapis.com/download/youtube-video?url=${encodeURIComponent(url)}`, {
                timeout: 30000
            });

            if (!data.status || !data.download_url) {
                await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
                return reply(`No video found for: ${url}`);
            }

            const info = data.info || {};
            const caption = `${info.title || 'YouTube Video'} · ${info.quality || ''}`.trim();

            await sock.sendMessage(m.chat, {
                video: { url: data.download_url },
                caption: caption || '',
                mimetype: 'video/mp4'
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '❤️‍🩹', key: m.key } });

        } catch (error) {
            console.error('[YT ERROR]', error.message);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            reply('Error downloading video.');
        }
    }
};
