'use strict';

const { downloadSpotify } = require('../../Plugin/socialDl');

function safeFilename(title) {
    const value = String(title || 'Spotify track')
        .normalize('NFKD')
        .replace(/[^\x00-\x7F]/g, '')
        .replace(/[^a-zA-Z0-9._ -]/g, '')
        .trim()
        .slice(0, 70);
    return `${value || 'Spotify track'}.mp3`;
}

module.exports = {
    name: 'spotify',
    alias: ['sp', 'spdl'],
    desc: 'Download Spotify tracks as MP3',
    category: 'Download',

    execute: async (sock, m, { args, reply }) => {
        const url = args[0] || m.quoted?.text || m.quoted?.caption;
        if (!url) return reply('Provide a Spotify track link.');

        try {
            await sock.sendPresenceUpdate('composing', m.chat);
            const track = await downloadSpotify(url);
            const title = String(track.title || 'Spotify track').slice(0, 120);
            const artist = String(track.artist || 'Unknown artist').slice(0, 100);

            if (track.thumbnail) {
                await sock.sendMessage(m.chat, {
                    image: { url: track.thumbnail },
                    caption: `🎧 *${title}*\n🎤 ${artist}\n\n_Your Spotify track is ready._`
                }, { quoted: m }).catch(error => console.warn('[SPOTIFY THUMBNAIL]', error.message));
            }

            await sock.sendMessage(m.chat, {
                audio: track.buffer,
                mimetype: 'audio/mpeg',
                fileName: safeFilename(title),
                ptt: false
            }, { quoted: m });
        } catch (error) {
            console.error('[SPOTIFY DOWNLOAD]', error.stack || error.message || error);
            const message = error?.message === 'Use a Spotify track link to download one song.'
                ? 'Please provide one Spotify track link.'
                : 'Could not download this Spotify track. Check that the link is public and try again.';
            await reply(message);
        }
    }
};
