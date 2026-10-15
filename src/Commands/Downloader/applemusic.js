'use strict';

const { downloadAppleMusic } = require('../../Plugin/socialDl');
const PREFIX = process.env.PREFIX || '.';

function findUrl(text) {
    return String(text || '').match(/https?:\/\/(?:www\.)?music\.apple\.com\/[^\s]+/i)?.[0]?.replace(/[)\]>.,;!?]+$/, '') || null;
}
function safeFilename(title, extension) {
    const safe = String(title || 'Apple Music track').normalize('NFKD').replace(/[^\x00-\x7F]/g, '').replace(/[^a-zA-Z0-9._ -]/g, '').trim().replace(/\s+/g, '_').slice(0, 70);
    return `${safe || 'Apple_Music_track'}.${extension}`;
}

module.exports = {
    name: 'applemusic',
    alias: ['applemusicdl', 'appletrack'],
    desc: 'Download Apple Music tracks using a strict match, with official preview fallback',
    category: 'downloader',
    usage: `${PREFIX}applemusic <Apple Music URL>`,
    owner: false,

    execute: async (sock, m, { args, reply, quoted }) => {
        const target = m.quoted || quoted;
        const url = findUrl(args.join(' ') || target?.text || target?.body || target?.caption);
        if (!url) return reply(`Usage: ${PREFIX}applemusic <Apple Music URL>`);

        let stage = 'download';
        try {
            await sock.sendPresenceUpdate?.('composing', m.chat);
            const track = await downloadAppleMusic(url);
            const title = String(track.title || 'Apple Music track').slice(0, 120);
            const artist = String(track.artist || 'Unknown artist').slice(0, 100);
            const fallback = track.isPreviewFallback;
            const caption = fallback
                ? `♫ *${title}*\n🎤 ${artist}\n\nApple did not have a confident full-track match; sending the official preview.`
                : `♫ *${title}*\n🎤 ${artist}\n\nMatched audio source: ${track.audioSource || 'external source'}.`;

            if (track.thumbnail) {
                stage = 'send thumbnail';
                await sock.sendMessage(m.chat, { image: { url: track.thumbnail }, caption }, { quoted: m }).catch(error => console.warn('[APPLE MUSIC THUMBNAIL]', error.message));
            }
            stage = 'send audio';
            await sock.sendMessage(m.chat, {
                audio: track.buffer,
                mimetype: track.mimetype,
                fileName: safeFilename(title, track.extension),
                ptt: false
            }, { quoted: m });
        } catch (error) {
            console.error(`[APPLE MUSIC ${stage.toUpperCase()}]`, error.stack || error.message || error);
            await reply(stage === 'download'
                ? `Apple Music download failed: ${error.message || error}`
                : 'The audio was prepared, but WhatsApp could not send it.');
        }
    }
};

module.exports.findUrl = findUrl;
module.exports.safeFilename = safeFilename;
