const yts = require('yt-search');
const { downloadYouTube } = require('../../Plugin/socialDl');

module.exports = {
    name: 'video',
    alias: ['ytvideo', 'ytv'],
    desc: 'Download YouTube video',
    category: 'downloader',

    execute: async (sock, m, { text, args = [], reply, prefix = '.' } = {}) => {
        const query = String(text || args.join(' ') || m.quoted?.text || m.quoted?.body || '').trim();
        const react = emoji => sock.sendMessage(m.chat, { react: { text: emoji, key: m.key } }).catch(() => {});
        try {
            if (!query) return reply(`✘ Provide a video name\nExample: \`${prefix}video Alan Walker Lily\``);
            await react('🔎');
            const searchResult = await yts(query);
            const videos = Array.isArray(searchResult) ? searchResult : searchResult?.videos;
            if (!Array.isArray(videos) || !videos.length) {
                await react('🙈');
                return reply('𓄄 _*No video found*_');
            }
            const vid = videos.find(video => video?.url || video?.videoId);
            if (!vid) return reply('𓄄 _*No downloadable video found*_');
            const videoUrl = vid.url || `https://www.youtube.com/watch?v=${vid.videoId}`;
            await react('⬇️');
            const { buffer, mimetype } = await downloadYouTube(videoUrl);
            if (!buffer?.length) throw new Error('social-dl returned an empty video.');
            const channelHandle = extractChannelHandle(vid.author);
            await sock.sendMessage(m.chat, {
                video: buffer,
                mimetype: mimetype || 'video/mp4',
                fileName: 'youtube_video.mp4',
                caption: `☕︎ ${channelHandle} — ${vid.timestamp}`
            }, { quoted: m });
            await react('🐾');
        } catch (err) {
            console.error('[VIDEO SOCIAL-DL]', err?.stack || err);
            await react('😞');
            await reply(`✘ Error downloading video${err?.message ? `: ${err.message}` : ''}`);
        }
    }
};

function extractChannelHandle(author) {
    if (!author) return 'Unknown';
    const handleMatch = (author.url || '').match(/\/@([^/?#]+)/);
    return handleMatch ? `@${handleMatch[1]}` : (author.name || 'Unknown');
}
