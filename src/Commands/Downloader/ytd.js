'use strict';

const socialDl = require('../../Plugin/socialDl');
const PREFIX = process.env.PREFIX || '.';
const YOUTUBE_URL = /https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be)\/\S+/i;

function extractUrl(text) {
    const match = String(text || '').match(YOUTUBE_URL);
    return match ? match[0].replace(/[)>\].,;!?]+$/, '') : null;
}

function fileNameFor(ext, title = 'YouTube Media') {
    const safe = String(title).replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60) || 'YouTube_Media';
    return `${safe}.${ext}`;
}

async function sendFromSocialDl(sock, m, url, asAudio = false) {
    const { buffer, mimetype, extension } = await socialDl.downloadYouTube(url, { audioOnly: asAudio });
    await sock.sendMessage(m.chat, {
        [asAudio ? 'audio' : 'video']: buffer,
        mimetype,
        fileName: fileNameFor(extension || (asAudio ? 'mp3' : 'mp4'))
    }, { quoted: m });
    return true;
}

module.exports = {
    name: 'yt',
    alias: ['youtube', 'ytdl', 'youtubedownload'],
    desc: 'Download YouTube video or audio',
    category: 'Search',
    usage: `${PREFIX}yt <youtube url> [-a for audio]`,
    examples: [`.yt https://youtu.be/rsF9VaubHWM`, `.yt https://youtu.be/rsF9VaubHWM -a`],

    execute: async (sock, m, { args, reply }) => {
        const raw = (args.join(' ').trim()) || m.quoted?.body || m.quoted?.text || '';
        const asAudio = /(^|\s)(-a|--audio|mp3)(\s|$)/i.test(raw);
        const url = extractUrl(raw);
        if (!url) return reply(`⊘ *Usage:* ${PREFIX}yt <youtube url>\n📝 *Audio:* ${PREFIX}yt <url> -a`);

        await sock.sendMessage(m.chat, { react: { text: '📥', key: m.key } });
        try {
            await sendFromSocialDl(sock, m, url, asAudio);
            return sock.sendMessage(m.chat, { react: { text: '❤️‍🩹', key: m.key } });
        } catch (error) {
            console.error('[YT SOCIAL-DL]', error.message || error);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            return reply(`⊘ *Download failed.*\n${error.message || error}`);
        }
    }
};

module.exports.extractUrl = extractUrl;
module.exports.sendFromSocialDl = sendFromSocialDl;
