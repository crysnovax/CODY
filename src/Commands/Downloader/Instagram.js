'use strict';

const { downloadInstagram, sendDownloadedMedia } = require('../../Plugin/socialDl');

function findUrl(text) {
    return String(text || '').match(/https?:\/\/[^\s]+instagram\.com[^\s]*/i)?.[0]?.replace(/[)\]>.,;!?]+$/, '') || null;
}

module.exports = {
    name: 'ig',
    alias: ['instagram', 'insta', 'igdl'],
    desc: 'Download Instagram reels and videos',
    category: 'downloader',
    usage: '.ig <Instagram URL>',
    owner: false,

    execute: async (sock, m, { args, reply, quoted }) => {
        let url = findUrl(args.join(' '));
        if (!url) {
            const target = m.quoted || quoted;
            url = findUrl(target?.text || target?.body || target?.message?.conversation || target?.message?.extendedTextMessage?.text || target?.message?.imageMessage?.caption || target?.message?.videoMessage?.caption);
        }
        if (!url) return reply('𓄄 *Provide a valid Instagram URL!*\n\nUsage: `.ig https://instagram.com/reel/...`');

        await reply('_*✪ Downloading Instagram media...*_');
        try {
            const media = await downloadInstagram(url);
            await sendDownloadedMedia(sock, m, media, '📸 *Instagram Downloader*');
        } catch (error) {
            console.error('[IG DOWNLOAD]', error.message || error);
            return reply(`✘ Instagram download failed: ${error.message || error}`);
        }
    }
};

module.exports.findUrl = findUrl;
