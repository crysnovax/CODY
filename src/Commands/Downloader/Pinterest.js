'use strict';

const { downloadUniversal, sendDownloadedMedia } = require('../../Plugin/socialDl');

function findUrl(text) {
    return String(text || '').match(/https?:\/\/(?:www\.)?(?:pinterest\.com|pin\.it)\/[^\s]+/i)?.[0]?.replace(/[)\]>.,;!?]+$/, '') || null;
}

module.exports = {
    name: 'pinterest',
    alias: ['pin', 'pindl'],
    desc: 'Download Pinterest media',
    category: 'downloader',
    usage: '.pinterest <URL>',
    owner: false,

    execute: async (sock, m, { args, reply, quoted }) => {
        let url = findUrl(args.join(' '));
        if (!url) {
            const target = m.quoted || quoted;
            url = findUrl(target?.text || target?.body || target?.message?.conversation || target?.message?.extendedTextMessage?.text || target?.message?.imageMessage?.caption || target?.message?.videoMessage?.caption);
        }
        if (!url) return reply('𓄄 *Provide a valid Pinterest URL!*\n\nUsage: `.pinterest https://...`');

        await reply('_*✪ Downloading Pinterest media...*_');
        try {
            const media = await downloadUniversal(url);
            const result = await sendDownloadedMedia(sock, m, media, '⬇️ *Pinterest Downloader*');
            if (result.failed) await reply(`Sent ${result.sent} of ${result.total} carousel images; ${result.failed} could not be sent.`);
        } catch (error) {
            console.error('[PINTEREST DOWNLOAD]', error.message || error);
            return reply(`✘ Pinterest download failed: ${error.message || error}`);
        }
    }
};

module.exports.findUrl = findUrl;
