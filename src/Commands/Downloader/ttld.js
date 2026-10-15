'use strict';

const socialDl = require('../../Plugin/socialDl');

function findUrl(text) {
    return String(text || '').match(/https?:\/\/(?:www\.|vm\.|vt\.)?tiktok\.com\/\S+/i)?.[0]?.replace(/[)\]>.,;!?]+$/, '') || null;
}

module.exports = {
    name: 'ttld',
    alias: [],
    desc: 'Download TikTok videos without watermark',
    category: 'Downloader',
    usage: `${process.env.PREFIX || '.'}ttld <TikTok URL>`,
    reactions: { start: '🎵', success: '✨', error: '❔' },

    execute: async (sock, m, { args, reply, prefix, quoted }) => {
        let url = findUrl(args.join(' '));
        if (!url) {
            const target = m.quoted || quoted;
            url = findUrl(target?.text || target?.body || target?.message?.conversation || target?.message?.extendedTextMessage?.text);
        }
        if (!url) return reply(`╭─❍ *TIKTOK DOWNLOADER*\n│\n│ ⚉ *Usage:* ${prefix || '.'}ttld <TikTok URL>\n╰──────────────────`);

        await sock.sendMessage(m.chat, { react: { text: '🎵', key: m.key } });
        const progressMsg = await sock.sendMessage(m.chat, { text: '🎵 *Fetching TikTok...*\n\n🔍 Resolving URL...' });
        try {
            await sock.sendMessage(m.chat, { text: '🎵 *Fetching TikTok...*\n\n▰▰▰▱▱▱▱▱▱▱ 30%\n\n🔍 Downloading with social-dl...', edit: progressMsg.key });
            const media = await socialDl.downloadTikTok(url);
            await sock.sendMessage(m.chat, { text: '🎵 *Fetching TikTok...*\n\n▰▰▰▰▰▰▰▰▰▰ 100%\n\n🔍 Done!', edit: progressMsg.key });
            await sock.sendMessage(m.chat, { delete: progressMsg.key });
            const result = await socialDl.sendDownloadedMedia(sock, m, media, '🎵 *TikTok Downloader*');
            if (result.failed) await reply(`Sent ${result.sent} of ${result.total} carousel images; ${result.failed} could not be sent.`);
            await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });
        } catch (error) {
            console.error('[TTLD SOCIAL-DL]', error.message || error);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            await sock.sendMessage(m.chat, { text: `🏗️ TikTok download failed: ${error.message || error}`, edit: progressMsg.key });
        }
    }
};

module.exports.findUrl = findUrl;
