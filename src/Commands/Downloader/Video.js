const yts = require('yt-search');
const { downloadYouTube } = require('../../Plugin/socialDl');

module.exports = {
    name: 'video',
    alias: ['ytvideo', 'ytv'],
    desc: 'Download YouTube video',
    category: 'downloader',

    execute: async (sock, m, { text, reply, prefix = '.' }) => {
        try {
            if (!text) return reply(`✘ Provide a video name\nExample: \`${prefix}video Alan Walker Lily\``);
            await sock.sendMessage(m.chat, { react: { text: '🔎', key: m.key } });
            const { videos } = await yts(text);
            if (!videos.length) {
                await sock.sendMessage(m.chat, { react: { text: '🙈', key: m.key } });
                return reply('𓄄 _*No video found*_');
            }
            const vid = videos[0];
            await sock.sendMessage(m.chat, { react: { text: '⬇️', key: m.key } });
            const { buffer, mimetype } = await downloadYouTube(vid.url);
            const channelHandle = extractChannelHandle(vid.author);
            await sock.sendMessage(m.chat, {
                video: buffer,
                mimetype,
                fileName: 'youtube_video.mp4',
                caption: `☕︎ ${channelHandle} — ${vid.timestamp}`
            }, { quoted: m });
            await sock.sendMessage(m.chat, { react: { text: '🐾', key: m.key } });
        } catch (err) {
            console.log(err);
            await sock.sendMessage(m.chat, { react: { text: '😞', key: m.key } });
            reply('✘ Error downloading video');
        }
    }
};

function extractChannelHandle(author) {
    if (!author) return 'Unknown';
    const handleMatch = (author.url || '').match(/\/@([^/?#]+)/);
    return handleMatch ? `@${handleMatch[1]}` : (author.name || 'Unknown');
}
