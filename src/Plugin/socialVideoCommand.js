'use strict';

const { downloadUniversal, sendDownloadedMedia } = require('./socialDl');
const PREFIX = process.env.PREFIX || '.';
const OPTION_USAGE = '[--best | --quality best|720p|480p] [--lan <code>] [--no-watermark]';

function createSocialVideoCommand({ name, aliases = [], label, emoji = '🎬', hostPattern }) {
    const urlPattern = new RegExp(`https?:\\/\\/(?:${hostPattern})(?::\\d+)?(?:\\/[^\\s]*)?`, 'i');
    const trimPunctuation = value => value.replace(/[)\]>.,;!?"']+$/, '');

    function findUrl(text) {
        const match = String(text || '').match(urlPattern)?.[0];
        return match ? trimPunctuation(match) : null;
    }

    function parseOptions(text) {
        const tokens = String(text || '').trim().split(/\s+/).filter(Boolean);
        const options = {};
        for (let i = 0; i < tokens.length; i += 1) {
            const token = tokens[i];
            if (token === '--best') options.quality = 'best';
            else if (token === '--quality') {
                const quality = tokens[++i];
                if (!['best', '720p', '480p'].includes(quality)) {
                    return { error: '--quality must be best, 720p, or 480p.' };
                }
                options.quality = quality;
            } else if (token === '--lan' || token === '--lang') {
                const lan = tokens[++i];
                if (!lan || lan.startsWith('-')) return { error: `${token} requires a language code, such as en.` };
                options.lan = lan;
            } else if (token === '--no-watermark') options.noWatermark = true;
            else if (token.startsWith('-')) return { error: `Unsupported option: ${token}.` };
        }
        return { options };
    }

    const usage = `Usage: ${PREFIX}${name} <${label} URL> ${OPTION_USAGE}`;

    return {
        name,
        alias: aliases,
        desc: `Download public ${label} videos; supports --best, --quality, --lan/--lang, and --no-watermark`,
        category: 'downloader',
        usage,
        owner: false,

        execute: async (sock, m, { args = [], reply = async () => {}, quoted } = {}) => {
            const target = m.quoted || quoted;
            const text = Array.isArray(args) ? args.join(' ') : String(args || '');
            const input = [text, target?.text, target?.body, target?.caption].filter(Boolean).join(' ');
            const url = findUrl(input);
            if (!url) return reply(usage);

            const parsed = parseOptions(input);
            if (parsed.error) return reply(`${parsed.error}\n${usage}`);

            try {
                await sock.sendPresenceUpdate?.('composing', m.chat);
                const media = await downloadUniversal(url, parsed.options);
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
