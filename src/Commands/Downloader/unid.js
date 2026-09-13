// unid (universal downloader) — powered by the prexzy aio v2 endpoint.
//
// GET https://prexzyapis.com/download/aiov2?url=<encoded>
//   { status, platform, result: { without_water_mark_mp4, water_mark_mp4, mp3,
//     desc, author, thumb, cover, pics: [...] } }
//
// The old docs.prexzyapis.com/download/aio endpoint is retired.
const axios = require('axios');

const API_URL = 'https://prexzyapis.com/download/aiov2?url=';
const MAX_IMAGES = 10;

function pickUrl(...values) {
    return values.find(value => typeof value === 'string' && /^https?:\/\//i.test(value)) || null;
}

function normalizeResult(data) {
    const result = data?.result || data?.data || {};

    const video = pickUrl(
        result.without_water_mark_mp4,
        result.without_water_mark_video,
        result.water_mark_mp4,
        result.water_mark_video,
        result.no_watermark,
        result.video,
        result.hd,
        result.sd,
        result.url
    );
    const audio = pickUrl(result.mp3, result.music, result.audio, result.audio_url);

    const images = [];
    const rawPics = result.pics || result.images || result.photos || [];
    if (Array.isArray(rawPics)) {
        for (const item of rawPics) {
            const url = typeof item === 'string' ? item : pickUrl(item?.url, item?.image, item?.download, item?.src);
            if (url) images.push(url);
        }
    }

    return {
        video,
        audio,
        images,
        platform: data?.platform || result.platform || 'Media',
        author: result.author || result.username || result.uploader || '',
        title: (result.desc || result.description || result.title || '').trim(),
        duration: Number(result.duration) || 0,
        thumbnail: pickUrl(result.thumb, result.cover, result.thumbnail)
    };
}

function buildCaption(media) {
    const parts = [`🌐 ${media.platform}`];
    if (media.author) parts.push(`👤 ${media.author}`);
    if (media.duration) parts.push(`⏱️ ${media.duration}s`);
    let caption = parts.join(' · ');
    if (media.title) {
        const title = media.title.length > 220 ? `${media.title.slice(0, 220)}...` : media.title;
        caption += `\n\n${title}`;
    }
    return caption;
}

module.exports = {
    name: 'unidownload',
    alias: ['unid', 'udl', 'downloadall'],
    desc: 'Download from all social media platforms',
    category: 'Search',
    usage: '.unidownload <url>',
    examples: ['.unidownload https://vt.tiktok.com/ZSCBFL8DM/'],
    reactions: { start: '📥', success: '❤️‍🩹', error: '❔' },

    execute: async (sock, m, { args, reply }) => {
        const url = args[0]?.trim();
        if (!url) return reply('Usage: .unidownload <url>');

        await sock.sendMessage(m.chat, { react: { text: '📥', key: m.key } });

        try {
            const { data } = await axios.get(API_URL + encodeURIComponent(url), { timeout: 30000 });

            if (data?.status === false || data?.success === false || !data?.result) {
                await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
                return reply(`No media found for: ${url}`);
            }

            const media = normalizeResult(data);
            const caption = buildCaption(media);
            let delivered = 0;

            if (media.video) {
                await sock.sendMessage(m.chat, {
                    video: { url: media.video },
                    mimetype: 'video/mp4',
                    caption
                }, { quoted: m });
                delivered++;
            }

            for (const image of media.images.slice(0, MAX_IMAGES)) {
                await sock.sendMessage(m.chat, {
                    image: { url: image },
                    caption: delivered === 0 ? caption : ''
                }, { quoted: m });
                delivered++;
            }

            if (!media.video && media.audio) {
                await sock.sendMessage(m.chat, {
                    audio: { url: media.audio },
                    mimetype: 'audio/mpeg'
                }, { quoted: m });
                delivered++;
            }

            if (!delivered) {
                await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
                return reply(`No downloadable media found for: ${url}`);
            }

            await sock.sendMessage(m.chat, { react: { text: '❤️‍🩹', key: m.key } });
        } catch (error) {
            console.error('[UNIDOWNLOAD ERROR]', error.message);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } }).catch(() => {});
            reply('Error downloading media.');
        }
    }
};

module.exports.normalizeResult = normalizeResult;
