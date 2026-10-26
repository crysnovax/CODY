'use strict';

const { downloadUniversal, sendDownloadedMedia } = require('./socialDl');
const PREFIX = process.env.PREFIX || '.';

function createSocialVideoCommand({ name, aliases = [], label, emoji = '🎬', hostPattern }) {
    const urlPattern = new RegExp(`https?:\\/\\/(?:${hostPattern})(?::\\d+)?(?:\\/[^\\s]*)?`, 'i');
    const trimPunctuation = value => value.replace(/[)\]>.,;!?"']+$/, '');

    function findUrl(text) {
        const match = String(text || '').match(urlPattern)?.[0];
        return match ? trimPunctuation(match) : null;
    }

    return {
        name,
        alias: aliases,
        desc: `Download public ${label} videos`,
        category: 'downloader',
        usage: `${PREFIX}${name} <${label} URL>`,
        owner: false,

        execute: async (sock, m, { args = [], reply = async () => {}, quoted } = {}) => {
            const target = m.quoted || quoted;
            const text = Array.isArray(args) ? args.join(' ') : String(args || '');
            const url = findUrl(text || target?.text || target?.body || target?.caption);
            if (!url) return reply(`Usage: ${PREFIX}${name} <${label} URL>`);

            try {
                await sock.sendPresenceUpdate?.('composing', m.chat);
                const media = await downloadUniversal(url);
                const result = await sendDownloadedMedia(sock, m, media, `${emoji} *${label} Downloader*`);
                if (result.failed) await reply(`Sent ${result.sent} of ${result.total} carousel images; ${result.failed} could not be sent.`);
            } catch (error) {
                console.error(`[${name.toUpperCase()} DOWNLOAD]`, error.stack || error.message || error);
                await reply(`${label} download failed: ${error.message || error}`);
            }
        },

        findUrl
    };
}

module.exports = createSocialVideoCommand;
