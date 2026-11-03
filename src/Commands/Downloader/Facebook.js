'use strict';

const { downloadFacebook, sendDownloadedMedia } = require('../../Plugin/socialDl');

function findUrl(text) {
    return String(text || '').match(/https?:\/\/[^\s]+(?:facebook\.com|fb\.watch)[^\s]*/i)?.[0]?.replace(/[)\]>.,;!?]+$/, '') || null;
}

module.exports = {
    name: 'fb',
    alias: ['facebook', 'fbdown'],
    desc: 'Download Facebook video',
    category: 'downloader',
    usage: '.fb <Facebook URL>',
    owner: false,

    execute: async (sock, m, { args, reply, quoted }) => {
        let url = findUrl(args.join(' '));
        if (!url) {
            const target = m.quoted || quoted;
            url = findUrl(target?.text || target?.body || target?.message?.conversation || target?.message?.extendedTextMessage?.text || target?.message?.imageMessage?.caption || target?.message?.videoMessage?.caption);
        }
        if (!url) return reply('𓄄 *Provide a valid Facebook URL!*\n\nUsage: `.fb https://facebook.com/...`');

        await reply('_*✪ Downloading Facebook media...*_');
        try {
            const media = await downloadFacebook(url);
            await sendDownloadedMedia(sock, m, media, '📘 *Facebook Downloader*');
        } catch (error) {
            console.error('[FB DOWNLOAD]', error.message || error);
            return reply(`✘ Facebook download failed: ${error.message || error}`);
        }
    }
};

module.exports.findUrl = findUrl;
