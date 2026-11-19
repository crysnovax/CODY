'use strict';

const crypto = require('crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const FormData = require('form-data');
const fetch = require('node-fetch');
const yts = require('yt-search');
const axios = require('axios');
const socialDl = require('../../Plugin/socialDl');
const { ACR_CLOUD } = require('../Core/•.js');

const execFileAsync = promisify(execFile);
const activeSessions = new Map();
const SESSION_TTL_MS = 10 * 60 * 1000;
const FALLBACK_THUMBNAIL = 'https://cdn.crysnova.qzz.io/files/1794083353032-2154fb90-2cab-45ca-bcbd-18c73fb6d478.jpeg';

function sessionKey(message) {
    const chat = message?.chat || message?.key?.remoteJid || '';
    const sender = message?.sender || message?.key?.participant || chat;
    return `${chat}:${sender}`;
}

function cleanFileName(value) {
    return String(value || 'shazam-track')
        .normalize('NFKD')
        .replace(/[^a-zA-Z0-9._ -]+/g, '')
        .trim()
        .replace(/[ .]+/g, '_')
        .slice(0, 90) || 'shazam-track';
}

function buildStringToSign(method, host, endpoint, dataType, signatureVersion, timestamp) {
    return [method, host, endpoint, dataType, signatureVersion, timestamp].join('\n');
}

function sign(string, secret) {
    return crypto.createHmac('sha1', secret).update(Buffer.from(string, 'utf8')).digest('base64');
}

function buildIdentifySignature(timestamp, config = ACR_CLOUD) {
    const stringToSign = buildStringToSign(
        'POST', config.host, config.endpoint, config.data_type,
        config.signature_version, timestamp
    );
    return sign(stringToSign, config.access_secret);
}

async function prepareAudioSample(buffer) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cody-shazam-'));
    const inputPath = path.join(directory, 'input-media');
    const outputPath = path.join(directory, 'sample.mp3');
    try {
        await fs.writeFile(inputPath, buffer);
        await execFileAsync('ffmpeg', [
            '-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath,
            '-vn', '-t', '15', '-acodec', 'libmp3lame', '-ar', '44100',
            '-ac', '1', '-b:a', '128k', outputPath
        ], { timeout: 120000 });
        const audio = await fs.readFile(outputPath);
        if (!audio.length) throw new Error('FFmpeg produced an empty audio sample.');
        return audio;
    } finally {
        await fs.rm(directory, { recursive: true, force: true }).catch(() => {});
    }
}

async function identifyAudio(buffer) {
    const required = ['host', 'endpoint', 'data_type', 'signature_version', 'access_key', 'access_secret'];
    if (required.some(key => !ACR_CLOUD?.[key])) throw new Error('ACRCloud credentials are not configured.');

    const sample = await prepareAudioSample(buffer);
    const timestamp = Math.floor(Date.now() / 1000);
    const form = new FormData();
    form.append('sample', sample, { filename: 'sample.mp3', contentType: 'audio/mpeg' });
    form.append('sample_bytes', sample.length);
    form.append('data_type', ACR_CLOUD.data_type);
    form.append('access_key', ACR_CLOUD.access_key);
    form.append('signature_version', ACR_CLOUD.signature_version);
    form.append('signature', buildIdentifySignature(timestamp));
    form.append('timestamp', timestamp);

    const response = await fetch(`https://${ACR_CLOUD.host}${ACR_CLOUD.endpoint}`, {
        method: 'POST',
        body: form,
        timeout: 30000
    });
    if (!response.ok) throw new Error(`ACRCloud request failed (${response.status}).`);
    const result = await response.json();
    if (result?.status?.code !== 0) {
        throw new Error(result?.status?.msg || result?.status?.message || 'No matching song was found.');
    }
    const track = result?.metadata?.music?.[0];
    if (!track) throw new Error('No matching song was found.');
    return track;
}

async function searchYouTube(title, artist) {
    try {
        const results = await yts(`${title} ${artist}`.trim());
        return results?.videos?.[0] || null;
    } catch (error) {
        console.warn('[SHAZAM YOUTUBE SEARCH]', error?.message || error);
        return null;
    }
}

async function downloadThumbnail(url) {
    for (const candidate of [url, FALLBACK_THUMBNAIL]) {
        if (!candidate) continue;
        try {
            const response = await axios.get(candidate, {
                responseType: 'arraybuffer',
                timeout: 12000,
                maxContentLength: 5 * 1024 * 1024,
                headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*' }
            });
            const thumbnail = Buffer.from(response.data);
            if (thumbnail.length) return thumbnail;
        } catch (error) {
            console.warn('[SHAZAM THUMBNAIL]', error?.message || error);
        }
    }
    return Buffer.alloc(0);
}

function formatTrack(track) {
    const artists = (track?.artists || []).map(item => item?.name).filter(Boolean).join(', ') || 'Unknown artist';
    const duration = Number(track?.duration_ms);
    return {
        title: track?.title || 'Unknown title',
        artist: artists,
        album: track?.album?.name || 'Unknown album',
        released: track?.release_date || 'N/A',
        duration: Number.isFinite(duration) && duration > 0 ? `${Math.round(duration / 1000)}s` : 'N/A',
        spotifyId: track?.external_metadata?.spotify?.track?.id || null,
        youtubeId: track?.external_metadata?.youtube?.vid || null
    };
}

function buildCardText(song, video) {
    const lines = [
        '╭─❍ *SONG IDENTIFIED*',
        `│ 🎵 *Title:* ${song.title}`,
        `│ 🎤 *Artist:* ${song.artist}`,
        `│ 💿 *Album:* ${song.album}`,
        `│ 📅 *Released:* ${song.released}`,
        `│ ⏱ *Duration:* ${song.duration}`
    ];
    if (song.spotifyId) lines.push(`│ Spotify: https://open.spotify.com/track/${song.spotifyId}`);
    if (song.youtubeId) lines.push(`│ YouTube: https://youtube.com/watch?v=${song.youtubeId}`);
    if (video?.url) lines.push(`│ Source: ${video.url}`);
    lines.push('╰──────────────────', '', 'Choose a download format:');
    return lines.join('\n');
}

async function sendChoiceCard(sock, message, song, video, prefix = '.', thumbnailOverride = null) {
    const thumbnail = thumbnailOverride || await downloadThumbnail(FALLBACK_THUMBNAIL);
    const card = {
        title: 'New Cody • Online',
        subtitle: 'Type npm i plogme@2.2.5',
        text: buildCardText(song, video),
        thumbnail,
        buttons: [
            { id: `${prefix}shazam mp3`, text: '🎵 MP3' },
            { id: `${prefix}shazam mp4`, text: '🎬 MP4' }
        ]
    };

    if (typeof sock.sendLocationButtonCard === 'function') {
        return sock.sendLocationButtonCard(message.chat, card);
    }

    return sock.sendMessage(message.chat, {
        text: `${card.title}\n${card.subtitle}\n\n${card.text}\n\n${card.buttons.map(button => `${button.text}: ${button.id}`).join('\n')}`
    }, { quoted: message });
}

async function sendDownload(sock, message, format, reply) {
    const key = sessionKey(message);
    const session = activeSessions.get(key);
    if (!session || Date.now() - session.createdAt > SESSION_TTL_MS) {
        activeSessions.delete(key);
        return reply('No recent Shazam result was found. Reply to audio/video with .shazam first.');
    }
    if (!session.videoUrl) return reply('A YouTube match was not found for this song.');

    await sock.sendMessage(message.chat, { react: { text: '⬇️', key: message.key } }).catch(() => {});
    try {
        const media = await socialDl.downloadYouTube(session.videoUrl, { audioOnly: format === 'mp3' });
        if (format === 'mp3') {
            media.fileName = `${cleanFileName(session.title)}.mp3`;
        } else {
            media.fileName = `${cleanFileName(session.title)}.mp4`;
        }
        await socialDl.sendDownloadedMedia(sock, message, media, `🎵 *${session.title}*\nDownloaded with social-dl`);
        await sock.sendMessage(message.chat, { react: { text: '✨', key: message.key } }).catch(() => {});
    } catch (error) {
        console.error(`[SHAZAM ${format.toUpperCase()} SOCIAL-DL]`, error?.stack || error);
        await sock.sendMessage(message.chat, { react: { text: '❌', key: message.key } }).catch(() => {});
        return reply(`Could not download ${format.toUpperCase()}: ${error?.message || 'download failed'}`);
    }
}

module.exports = {
    name: 'shazam',
    alias: ['whatmusic', 'findaudio', 'identifyaudio'],
    desc: 'Identify replied audio/video and offer MP3 or MP4 downloads',
    category: 'Search',
    usage: '.shazam (reply to audio or video)',
    reactions: { start: '🎵', success: '✨', error: '❌' },
    execute: async (sock, message, { args = [], reply, prefix = '.' } = {}) => {
        const choice = String(args[0] || '').trim().toLowerCase();
        if (choice === 'mp3' || choice === 'mp4') {
            return sendDownload(sock, message, choice, reply);
        }

        const quoted = message.quoted;
        const mimetype = String(quoted?.mimetype || quoted?.msg?.mimetype || '');
        const messageType = String(quoted?.mtype || quoted?.type || '');
        const isSupported = /^(audio|video)\//i.test(mimetype)
            || /^(audio|video|ptv)Message$/i.test(messageType);
        if (!quoted || !isSupported || typeof quoted.download !== 'function') {
            return reply('Reply to an audio or video message with .shazam to identify its song.');
        }

        try {
            await sock.sendMessage(message.chat, { react: { text: '🔍', key: message.key } }).catch(() => {});
            const buffer = await quoted.download();
            if (!buffer?.length) throw new Error('Could not download the replied audio/video.');
            const recognized = await identifyAudio(buffer);
            const song = formatTrack(recognized);
            const video = await searchYouTube(song.title, song.artist);
            const videoUrl = video?.url || (song.youtubeId ? `https://www.youtube.com/watch?v=${song.youtubeId}` : null);
            activeSessions.set(sessionKey(message), {
                title: song.title,
                videoUrl,
                createdAt: Date.now()
            });
            for (const [key, session] of activeSessions) {
                if (Date.now() - session.createdAt > SESSION_TTL_MS) activeSessions.delete(key);
            }
            await sendChoiceCard(sock, message, song, video, prefix);
            await sock.sendMessage(message.chat, { react: { text: '✨', key: message.key } }).catch(() => {});
        } catch (error) {
            console.error('[SHAZAM ERROR]', error?.stack || error);
            await sock.sendMessage(message.chat, { react: { text: '❌', key: message.key } }).catch(() => {});
            return reply(`Could not identify the audio: ${error?.message || 'unknown error'}`);
        }
    },
    helpers: { sessionKey, cleanFileName, buildStringToSign, sign, buildIdentifySignature, formatTrack, buildCardText, sendChoiceCard, sendDownload },
    activeSessions
};
