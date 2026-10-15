'use strict';

const { downloadUniversal, sendDownloadedMedia } = require('../../Plugin/socialDl');

function extractUrl(text) {
    return String(text || '').match(/https?:\/\/\S+/i)?.[0]?.replace(/[)\]>.,;!?]+$/, '') || null;
}

function normalizeResult(data) {
    const root = data?.result || data?.data || {};
    const raw = Array.isArray(root.fb_bos) ? root.fb_bos : [];
    const media = raw.map(item => ({
        kind: String(item.type || '').startsWith('m4') ? 'audio' : 'video',
        url: item.original_url || item.url
    })).filter(item => item.url);
    const video = root.without_water_mark_mp4 || root.video || root.video_url;
    const audio = root.mp3 || root.audio || root.audio_url;
    if (video) media.push({ kind: 'video', url: video });
    if (audio) media.push({ kind: 'audio', url: audio });
    const images = Array.isArray(root.pics)
        ? root.pics
            .map(item => typeof item === 'string' ? item : item?.url)
            .filter(item => {
                try {
                    const parsed = new URL(item);
                    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
                } catch {
                    return false;
                }
            })
        : [];
    return {
        video: media.find(item => item.kind === 'video')?.url || null,
        audio: media.find(item => item.kind === 'audio')?.url || null,
        images, media,
        platform: data?.platform || root.platform || 'Media',
        author: root.author || root.username || root.uploader || data?.creator || '',
        title: String(root.desc || root.description || root.title || data?.message || '').trim(),
        duration: Number(root.duration || root.duration_seconds) || 0,
        thumbnail: null
    };
}

function buildCaption(media) {
    const parts = [`🌐 ${media.platform}`];
    if (media.author) parts.push(`👤 ${media.author}`);
    if (media.duration) parts.push(`⏱️ ${media.duration}s`);
    return media.title ? `${parts.join(' · ')}\n\n${media.title}` : parts.join(' · ');
}

module.exports = {
    name: 'unidownload',
    alias: ['unid', 'udl', 'downloadall'],
    desc: 'Download media from supported social platforms',
    category: 'Search',
    usage: '.unidownload <url>',
    reactions: { start: '📥', success: '❤️‍🩹', error: '❔' },

    execute: async (sock, m, { args, reply }) => {
        const url = extractUrl(args.join(' ').trim());
        if (!url) return reply('Usage: .unidownload <url>');
        await sock.sendMessage(m.chat, { react: { text: '📥', key: m.key } });
        try {
            const media = await downloadUniversal(url);
            const result = await sendDownloadedMedia(sock, m, media, `🌐 *${media.platform || 'Social'} Downloader*`);
            if (result.failed) await reply(`Sent ${result.sent} of ${result.total} carousel images; ${result.failed} could not be sent.`);
            await sock.sendMessage(m.chat, { react: { text: '❤️‍🩹', key: m.key } });
        } catch (error) {
            console.error('[UNIDOWNLOAD ERROR]', error.message || error);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } }).catch(() => {});
            return reply(`✘ Universal download failed: ${error.message || error}`);
        }
    }
};

module.exports.extractUrl = extractUrl;
module.exports.normalizeResult = normalizeResult;
module.exports.buildCaption = buildCaption;
