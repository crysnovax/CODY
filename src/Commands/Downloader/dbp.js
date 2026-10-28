'use strict';

const { downloadUniversal, sendDownloadedMedia } = require('../../Plugin/socialDl');
const { processDramaBoxPersonalVideo } = require('../../Plugin/dramaboxPersonalProcessor');

const URL_PATTERN = /https?:\/\/(?:[a-z0-9-]+\.)*dramabox(?:db)?\.com(?::\d+)?(?:\/[^\s]*)?/i;
const PREFIX = process.env.PREFIX || '.';
const USAGE = `Usage: ${PREFIX}dbp [wm] <DramaBox URL>`;

function trimPunctuation(value) {
    return value.replace(/[)\]>.,;!?"']+$/, '');
}

function findUrl(text) {
    const match = String(text || '').match(URL_PATTERN)?.[0];
    return match ? trimPunctuation(match) : null;
}

async function execute(sock, m, { args = [], reply = async () => {}, quoted } = {}) {
    const target = m.quoted || quoted;
    const text = Array.isArray(args) ? args.join(' ') : String(args || '');
    const addWatermark = (Array.isArray(args) ? args : text.trim().split(/\s+/))
        .some(value => String(value).toLowerCase() === 'wm');
    const input = [text, target?.text, target?.body, target?.caption].filter(Boolean).join(' ');
    const url = findUrl(input);
    if (!url) return reply(USAGE);

    try {
        await sock.sendPresenceUpdate?.('composing', m.chat);
        const downloaded = await downloadUniversal(url, { quality: 'best' });
        const processed = await processDramaBoxPersonalVideo(downloaded, { watermark: addWatermark });
        await sendDownloadedMedia(sock, m, processed, '🎞️ *DramaBox Personal Downloader*');
    } catch (error) {
        console.error('[DRAMABOX PERSONAL]', error.stack || error.message || error);
        await reply(`DramaBox personal download failed: ${error.message || error}`);
    }
}

module.exports = {
    name: 'dbp',
    alias: ['dramaboxcustom', 'dboxcustom'],
    desc: 'Download and lightly personalize authorized DramaBox videos',
    category: 'downloader',
    usage: USAGE,
    owner: false,
    execute,
    findUrl
};
