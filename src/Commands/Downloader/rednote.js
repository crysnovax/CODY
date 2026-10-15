'use strict';

const { downloadUniversal, sendDownloadedMedia } = require('../../Plugin/socialDl');
const PREFIX = process.env.PREFIX || '.';

function findUrl(text) {
    return String(text || '').match(/https?:\/\/(?:www\.)?(?:xiaohongshu\.com|xhslink\.com)\/[^\s]+/i)?.[0]?.replace(/[)\]>.,;!?]+$/, '') || null;
}

module.exports = {
    name: 'rednote',
    alias: ['xiaohongshu', 'xhs', 'red'],
    desc: 'Download public RedNote/Xiaohongshu videos and photo carousels',
    category: 'downloader',
    usage: `${PREFIX}rednote <RedNote URL>`,
    owner: false,

    execute: async (sock, m, { args, reply, quoted }) => {
        const target = m.quoted || quoted;
        const url = findUrl(args.join(' ') || target?.text || target?.body || target?.caption);
        if (!url) return reply(`Usage: ${PREFIX}rednote <RedNote/Xiaohongshu URL>`);
        try {
            await sock.sendPresenceUpdate?.('composing', m.chat);
            const media = await downloadUniversal(url);
            const result = await sendDownloadedMedia(sock, m, media, '📕 *RedNote Downloader*');
            if (result.failed) await reply(`Sent ${result.sent} of ${result.total} carousel images; ${result.failed} could not be sent.`);
        } catch (error) {
            console.error('[REDNOTE DOWNLOAD]', error.stack || error.message || error);
            await reply(`RedNote download failed: ${error.message || error}`);
        }
    }
};

module.exports.findUrl = findUrl;
