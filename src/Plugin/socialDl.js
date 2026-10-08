'use strict';

const path = require('node:path');
const { mkdir, readFile, stat, unlink } = require('node:fs/promises');
const { fromBuffer } = require('file-type');

let socialDlPromise;

function loadSocialDl() {
    if (!socialDlPromise) socialDlPromise = import('social-dl');
    return socialDlPromise;
}

function safeDownloadError(error) {
    const code = error?.code && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'PROVIDER_FAILURE';
    return new Error(`social-dl download failed (${code})`);
}

async function saveToBuffer(save, expectedType) {
    const dir = path.join(process.cwd(), 'cache', 'temp', 'social-dl');
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `download-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.${expectedType.extension}`);
    try {
        await save(file);
        const fileInfo = await stat(file);
        if (!fileInfo.isFile() || fileInfo.size === 0) throw new Error('EMPTY_DOWNLOAD');
        const buffer = await readFile(file);
        const detected = await fromBuffer(buffer);
        const isAudio = detected?.mime?.startsWith('audio/') || (detected?.mime === 'video/mp4' && expectedType.audio && detected.ext === 'm4a');
        const isVideo = detected?.mime?.startsWith('video/');
        if (expectedType.audio ? !isAudio : !isVideo) throw new Error('MEDIA_TYPE_MISMATCH');
        return buffer;
    } catch (error) {
        if (error?.message === 'EMPTY_DOWNLOAD' || error?.message === 'MEDIA_TYPE_MISMATCH') throw error;
        throw safeDownloadError(error);
    } finally {
        await unlink(file).catch(() => {});
    }
}

async function downloadYouTube(url, { audioOnly = false } = {}) {
    const socialDl = await loadSocialDl();
    const type = audioOnly ? { extension: 'm4a', audio: true } : { extension: 'mp4', audio: false };
    const buffer = await saveToBuffer(file => socialDl.universalSave(url, file, { audioOnly }), type);
    return { buffer, title: undefined, mimetype: audioOnly ? 'audio/mp4' : 'video/mp4', extension: type.extension };
}

async function downloadUniversal(url, { audioOnly = false } = {}) {
    const socialDl = await loadSocialDl();
    const type = audioOnly ? { extension: 'm4a', audio: true } : { extension: 'mp4', audio: false };
    const buffer = await saveToBuffer(file => socialDl.universalSave(url, file, { audioOnly }), type);
    return { buffer, mimetype: audioOnly ? 'audio/mp4' : 'video/mp4', extension: type.extension };
}

async function downloadTikTok(url) {
    const socialDl = await loadSocialDl();
    const buffer = await saveToBuffer(file => socialDl.universalSave(url, file, { noWatermark: true }), { extension: 'mp4', audio: false });
    return { buffer, mimetype: 'video/mp4', extension: 'mp4' };
}

async function downloadInstagram(url, format = 'mp4') {
    const socialDl = await loadSocialDl();
    const audio = format === 'mp3';
    const extension = audio ? 'mp3' : 'mp4';
    const buffer = await saveToBuffer(file => socialDl.instagramSave(url, file), { extension, audio });
    return { buffer, mimetype: audio ? 'audio/mpeg' : 'video/mp4', extension };
}

async function downloadFacebook(url, format = 'mp4') {
    const socialDl = await loadSocialDl();
    const audio = format === 'mp3';
    const extension = audio ? 'mp3' : 'mp4';
    const buffer = await saveToBuffer(file => socialDl.facebookSave(url, file), { extension, audio });
    return { buffer, mimetype: audio ? 'audio/mpeg' : 'video/mp4', extension };
}

async function downloadSpotify(url) {
    const socialDl = await loadSocialDl();
    const info = await socialDl.spotifyDl(url);
    if (info?.type && info.type !== 'track') {
        throw new Error('Use a Spotify track link to download one song.');
    }
    const buffer = await saveToBuffer(
        file => socialDl.spotifySaveMatched(info, file),
        { extension: 'mp3', audio: true }
    );
    return {
        buffer,
        title: info.title || 'Spotify track',
        artist: info.artist || info.author || 'Unknown artist',
        thumbnail: info.thumbnail || null,
        mimetype: 'audio/mpeg',
        extension: 'mp3'
    };
}

module.exports = {
    loadSocialDl,
    downloadYouTube,
    downloadUniversal,
    downloadTikTok,
    downloadInstagram,
    downloadFacebook,
    downloadSpotify,
    safeDownloadError
};
