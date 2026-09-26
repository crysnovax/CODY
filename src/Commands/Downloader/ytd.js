// yt.js — Downloads YouTube media.
// Primary path: hosted API. Fallback: local `ytsave` (yt-dlp) engine, which
// keeps .yt working when the API is rate-limited or offline.
const axios = require('axios');
const fs = require('node:fs');
const path = require('node:path');

const engine = require('../../Plugin/ytsaveEngine.js');

const YOUTUBE_URL = /https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be)\/\S+/i;
const MAX_PLAYLIST_ITEMS = 10;

function extractUrl(text) {
    const match = String(text || '').match(YOUTUBE_URL);
    return match ? match[0].replace(/[)>\].,;!?]+$/, '') : null;
}

function sendKeysFor(file) {
    const extension = path.extname(file).toLowerCase();
    if (extension === '.mp3') return { key: 'audio', mimetype: 'audio/mpeg' };
    if (extension === '.m4a') return { key: 'audio', mimetype: 'audio/mp4' };
    return { key: 'video', mimetype: 'video/mp4' };
}

async function sendFromApi(sock, m, url) {
    const { data } = await axios.get(
        `https://docs.prexzyapis.com/download/youtube-video?url=${encodeURIComponent(url)}`,
        { timeout: 30000 }
    );

    if (!data?.status || !data.download_url) return false;

    const info = data.info || {};
    await sock.sendMessage(m.chat, {
        video: { url: data.download_url },
        caption: `${info.title || 'YouTube Video'} · ${info.quality || ''}`.trim(),
        mimetype: 'video/mp4'
    }, { quoted: m });

    return true;
}

async function sendLocal(sock, m, url, format) {
    const result = engine.isPlaylistUrl(url)
        ? await engine.downloadPlaylist(url, { format })
        : await engine.downloadVideo(url, { format });

    if (!result.files.length) throw new Error('yt-dlp finished without producing a file');

    // A playlist can be arbitrarily long; send the head of it and drop the rest.
    const files = result.files.slice(0, MAX_PLAYLIST_ITEMS);

    try {
        for (const file of files) {
            const { key, mimetype } = sendKeysFor(file);

            await sock.sendMessage(m.chat, {
                [key]: fs.readFileSync(file),
                mimetype,
                ...(key === 'audio' ? { ptt: false } : {}),
                fileName: path.basename(file)
            }, { quoted: m });
        }

        return files.length;
    } finally {
        // Never leave a failed upload's temp files behind.
        engine.cleanup(result.files);
    }
}

module.exports = {
    name: 'yt',
    alias: ['youtube', 'ytdl', 'youtubedownload'],
    desc: 'Download YouTube video or audio (hosted API, local yt-dlp fallback)',
    category: 'Search',
    usage: `${prefix}yt <youtube url> [-a for mp3]`,
    examples: ['.yt https://youtu.be/rsF9VaubHWM', '.yt https://youtu.be/rsF9VaubHWM -a'],

    execute: async (sock, m, { args, reply }) => {
        const raw = (args.join(' ').trim()) || m.quoted?.body || m.quoted?.text || '';
        const asAudio = /(^|\s)(-a|--audio|mp3)(\s|$)/i.test(raw);
        const url = extractUrl(raw);

        if (!url) {
            return reply(`⊘ *Usage:* ${prefix}yt <youtube url>\n📝 *Audio:* ${prefix}yt <url> -a`);
        }

        await sock.sendMessage(m.chat, { react: { text: '📥', key: m.key } });

        try {
            if (await sendFromApi(sock, m, url)) {
                return sock.sendMessage(m.chat, { react: { text: '❤️‍🩹', key: m.key } });
            }
        } catch (error) {
            console.error('[YT API]', error.message || error);
        }

        try {
            await sendLocal(sock, m, url, asAudio ? 'mp3' : 'mp4');
            await sock.sendMessage(m.chat, { react: { text: '❤️‍🩹', key: m.key } });
        } catch (error) {
            console.error('[YT ytsave]', error.message || error);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            reply(`⊘ *Download failed.*\n${error.message}`);
        }
    }
};

// Kept public for focused command-level tests; the bot router still uses execute().
module.exports.extractUrl = extractUrl;
module.exports.sendKeysFor = sendKeysFor;
module.exports.sendFromApi = sendFromApi;
module.exports.sendLocal = sendLocal;
