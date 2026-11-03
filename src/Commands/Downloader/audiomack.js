'use strict';

const { downloadAudiomack } = require('../../Plugin/socialDl');
const PREFIX = process.env.PREFIX || '.';

function findUrl(text) {
    return String(text || '').match(/https?:\/\/(?:www\.)?audiomack\.com\/[^\s]+/i)?.[0]?.replace(/[)\]>.,;!?]+$/, '') || null;
}
function safeFilename(title) {
    const safe = String(title || 'Audiomack track').normalize('NFKD').replace(/[^\x00-\x7F]/g, '').replace(/[^a-zA-Z0-9._ -]/g, '').trim().replace(/\s+/g, '_').slice(0, 70);
    return `${safe || 'Audiomack_track'}.m4a`;
}

module.exports = {
    name: 'audiomack',
    alias: ['audiomackdl', 'amdl', 'amk'],
    desc: 'Download public Audiomack tracks',
    category: 'downloader',
    usage: `${PREFIX}audiomack <Audiomack URL>`,
    owner: false,

    execute: async (sock, m, { args, reply, quoted }) => {
        const target = m.quoted || quoted;
        const url = findUrl(args.join(' ') || target?.text || target?.body || target?.caption);
        if (!url) return reply(`Usage: ${PREFIX}audiomack <Audiomack URL>`);
        let stage = 'download';
        try {
            await sock.sendPresenceUpdate?.('composing', m.chat);
            const result = await downloadAudiomack(url);
            const tracks = result?.mediaType === 'audio-album' ? result.tracks : [result];
            for (const [index, track] of tracks.entries()) {
                const title = String(track.title || `Audiomack track ${index + 1}`).slice(0, 120);
                const artist = String(track.artist || 'Unknown artist').slice(0, 100);
                if (track.thumbnail) {
                    stage = 'send thumbnail';
                    await sock.sendMessage(m.chat, { image: { url: track.thumbnail }, caption: `🎧 *${title}*\n🎤 ${artist}\n\n${result?.mediaType === 'audio-album' ? `Audiomack album · ${index + 1}/${tracks.length}` : 'Audiomack track'}` }, { quoted: m }).catch(error => console.warn('[AUDIOMACK THUMBNAIL]', error.message));
                }
                stage = 'send audio';
                await sock.sendMessage(m.chat, { audio: track.buffer, mimetype: track.mimetype || 'audio/mp4', fileName: safeFilename(title), ptt: false }, { quoted: m });
            }
            if (result?.mediaType === 'audio-album' && result.failedTracks) await reply(`Sent ${tracks.length} of ${result.totalTracks} Audiomack album tracks; ${result.failedTracks} failed.`);
        } catch (error) {
            console.error(`[AUDIOMACK ${stage.toUpperCase()}]`, error.stack || error.message || error);
            await reply(stage === 'download' ? `Audiomack download failed: ${error.message || error}` : 'The audio was prepared, but WhatsApp could not send it.');
        }
    }
};

module.exports.findUrl = findUrl;
module.exports.safeFilename = safeFilename;
