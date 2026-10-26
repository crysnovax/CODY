'use strict';

const path = require('node:path');
const { mkdir, readFile, stat, unlink, writeFile } = require('node:fs/promises');
const { fromBuffer } = require('file-type');

let socialDlPromise;
const MAX_GALLERY_IMAGES = 10;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const TEMP_DIR = path.join(process.cwd(), 'cache', 'temp', 'social-dl');

function loadSocialDl() {
    if (!socialDlPromise) socialDlPromise = import('social-dl');
    return socialDlPromise;
}

function safeDownloadError(error) {
    const code = error?.code && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'PROVIDER_FAILURE';
    return new Error(`social-dl download failed (${code})`);
}

function isExpectedMediaType(detected, expectedType = {}, responseContentType) {
    const contentType = String(responseContentType || '').split(';')[0].trim().toLowerCase();
    const detectedMime = String(detected?.mime || '').toLowerCase();
    const isAudio = detectedMime.startsWith('audio/')
        || (detectedMime === 'video/mp4' && expectedType.audio && (detected.ext === 'm4a' || contentType === 'audio/mp4'));
    const isVideo = detectedMime.startsWith('video/')
        && !(detectedMime === 'video/mp4' && contentType.startsWith('audio/'));
    return expectedType.audio ? isAudio : isVideo;
}

async function saveToBuffer(save, expectedType) {
    await mkdir(TEMP_DIR, { recursive: true });
    const file = path.join(TEMP_DIR, `download-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.${expectedType.extension}`);
    try {
        const saveMetadata = await save(file);
        const fileInfo = await stat(file);
        if (!fileInfo.isFile() || fileInfo.size === 0) throw new Error('EMPTY_DOWNLOAD');
        const buffer = await readFile(file);
        const detected = await fromBuffer(buffer);
        if (!isExpectedMediaType(detected, expectedType, saveMetadata?.contentType)) throw new Error('MEDIA_TYPE_MISMATCH');
        return buffer;
    } catch (error) {
        if (error?.message === 'EMPTY_DOWNLOAD' || error?.message === 'MEDIA_TYPE_MISMATCH') throw error;
        throw safeDownloadError(error);
    } finally {
        await unlink(file).catch(() => {});
    }
}

async function downloadUrlToFile(url, file, referer) {
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error('INVALID_MEDIA_URL'); }
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('INVALID_MEDIA_URL');
    const response = await fetch(parsed, {
        headers: { Accept: '*/*', 'User-Agent': 'Mozilla/5.0', ...(referer ? { Referer: referer } : {}) },
        signal: AbortSignal.timeout(30_000),
        redirect: 'follow'
    });
    if (!response.ok) throw new Error(`MEDIA_HTTP_${response.status}`);
    const maxBytes = 100 * 1024 * 1024;
    const length = Number(response.headers.get('content-length'));
    if (length > maxBytes) throw new Error('MEDIA_TOO_LARGE');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > maxBytes) throw new Error('INVALID_MEDIA_SIZE');
    await writeFile(file, buffer);
    return { contentType: response.headers.get('content-type') || null };
}

async function downloadImageBuffer(url, referer) {
    let parsed;
    try { parsed = new URL(String(url)); } catch { throw new Error('INVALID_IMAGE_URL'); }
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('INVALID_IMAGE_URL');
    const response = await fetch(parsed, {
        headers: { Accept: 'image/*', 'User-Agent': 'Mozilla/5.0', ...(referer ? { Referer: referer } : {}) },
        signal: AbortSignal.timeout(30_000),
        redirect: 'follow'
    });
    if (!response.ok) throw new Error(`IMAGE_HTTP_${response.status}`);
    const length = Number(response.headers.get('content-length'));
    if (length > MAX_IMAGE_BYTES) throw new Error('IMAGE_TOO_LARGE');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error('INVALID_IMAGE_SIZE');
    const detected = await fromBuffer(buffer);
    const mimetype = detected?.mime || response.headers.get('content-type')?.split(';')[0];
    if (!mimetype?.startsWith('image/')) throw new Error('MEDIA_TYPE_MISMATCH');
    return { buffer, mimetype, url: parsed.href };
}

function imageUrlsFromInfo(info) {
    const directImages = Array.isArray(info?.images) ? info.images : [];
    const formatImages = Array.isArray(info?.formats)
        ? info.formats.filter(item => /^(?:jpe?g|png|webp|gif|avif)$/i.test(item?.type || '')).map(item => item.url)
        : [];
    const values = [...directImages, ...formatImages].map(item => typeof item === 'string' ? item : item?.url).filter(Boolean);
    return [...new Set(values)].slice(0, MAX_GALLERY_IMAGES);
}

async function downloadPhotoGallery(info, url) {
    const urls = imageUrlsFromInfo(info);
    if (!urls.length) throw new Error('NO_IMAGES');
    const results = await Promise.all(urls.map(async imageUrl => {
        try { return await downloadImageBuffer(imageUrl, url); }
        catch (error) { console.warn('[SOCIAL-DL IMAGE SKIPPED]', error.message); return null; }
    }));
    const images = results.filter(Boolean);
    if (!images.length) throw new Error('NO_DOWNLOADABLE_IMAGES');
    return {
        mediaType: 'photo',
        images,
        title: info.title || info.author || info.platform || 'Social media photos',
        author: info.author || info.artist || '',
        platform: info.platform || 'social media',
        totalImages: urls.length,
        skippedImages: urls.length - images.length,
        thumbnail: info.thumbnail || null
    };
}

async function downloadYouTube(url, { audioOnly = false } = {}) {
    const socialDl = await loadSocialDl();
    const type = audioOnly ? { extension: 'mp3', audio: true } : { extension: 'mp4', audio: false };
    const buffer = await saveToBuffer(file => socialDl.universalSave(url, file, { audioOnly }), type);
    return { buffer, title: undefined, mimetype: audioOnly ? 'audio/mpeg' : 'video/mp4', extension: type.extension, mediaType: audioOnly ? 'audio' : 'video' };
}

function universalOutputExtension(info, isAudio = false) {
    if (isAudio) return info?.downloadExtension || 'mp3';
    const extension = String(info?.downloadExtension || 'mp4').toLowerCase();
    return ['m3u8', 'mpd'].includes(extension) ? 'mp4' : extension;
}

function isDramaBoxShareUrl(url) {
    try {
        return new URL(String(url)).hostname.replace(/^www\./i, '').toLowerCase() === 'sharet.dramabox.com';
    } catch {
        return false;
    }
}

async function downloadDramaBoxViaWorker(url, { quality = 'best', lan } = {}) {
    const workerUrl = String(process.env.DRAMABOX_WORKER_URL || '').trim();
    if (!workerUrl) return null;
    let endpoint;
    try {
        endpoint = new URL(workerUrl);
    } catch {
        throw new Error('DRAMABOX_WORKER_URL is invalid');
    }
    const headers = { 'Content-Type': 'application/json', Accept: 'video/mp4' };
    const token = String(process.env.DRAMABOX_WORKER_TOKEN || '').trim();
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url, quality, lan: lan || undefined }),
        signal: AbortSignal.timeout(120_000)
    });
    if (!response.ok) {
        const detail = (await response.text()).slice(0, 240).replace(/\s+/g, ' ').trim();
        throw new Error(`DramaBox worker failed (${response.status})${detail ? `: ${detail}` : ''}`);
    }
    const contentType = response.headers.get('content-type') || 'video/mp4';
    if (!contentType.toLowerCase().startsWith('video/')) throw new Error('DramaBox worker returned a non-video response');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new Error('DramaBox worker returned an empty video');
    return {
        buffer,
        title: response.headers.get('x-dramabox-title') || 'DramaBox video',
        platform: 'dramabox',
        mimetype: contentType.split(';')[0],
        extension: 'mp4',
        mediaType: 'video'
    };
}

async function downloadUniversal(url, { audioOnly = false, noWatermark = false, quality, lan } = {}) {
    const socialDl = await loadSocialDl();
    const dramaBoxShare = isDramaBoxShareUrl(url);
    if (dramaBoxShare) {
        const workerResult = await downloadDramaBoxViaWorker(url, { quality, lan });
        if (workerResult) return workerResult;
    }
    const platform = dramaBoxShare ? 'dramafren' : socialDl.detectPlatform(url);
    if (platform === 'applemusic') return downloadAppleMusic(url);
    if (platform === 'audiomack') return downloadAudiomack(url);
    if (platform === 'spotify') return downloadSpotify(url);
    const universalOptions = { audioOnly, noWatermark };
    if (quality) universalOptions.quality = quality;
    if (lan) universalOptions.lan = lan;
    const info = dramaBoxShare && typeof socialDl.dramafrenDl === 'function'
        ? await socialDl.dramafrenDl(url, universalOptions)
        : await socialDl.universalDl(url, universalOptions);
    const images = imageUrlsFromInfo(info);
    if (info?.mediaType === 'photo' || images.length) return downloadPhotoGallery({ ...info, images }, url);

    const isAudio = audioOnly || info?.mediaType === 'audio';
    const extension = audioOnly ? 'mp3' : universalOutputExtension(info, isAudio);
    const saveOptions = { audioOnly: isAudio, noWatermark };
    if (quality) saveOptions.quality = quality;
    if (lan) saveOptions.lan = lan;
    const save = dramaBoxShare && typeof socialDl.dramafrenSave === 'function'
        ? socialDl.dramafrenSave
        : socialDl.universalSave;
    const buffer = await saveToBuffer(file => save(url, file, saveOptions), { extension, audio: isAudio });
    return {
        buffer,
        title: info?.title || '',
        author: info?.author || info?.artist || '',
        platform: info?.platform || 'social media',
        thumbnail: info?.thumbnail || null,
        isPreviewFallback: info?.isPreviewFallback === true,
        audioSource: info?.audioSource || null,
        mimetype: isAudio ? (extension === 'mp3' ? 'audio/mpeg' : 'audio/mp4') : 'video/mp4',
        extension,
        mediaType: isAudio ? 'audio' : 'video'
    };
}

async function downloadTikTok(url) {
    return downloadUniversal(url, { noWatermark: true });
}

async function downloadInstagram(url, format = 'mp4') {
    const socialDl = await loadSocialDl();
    const audio = format === 'mp3';
    const extension = audio ? 'mp3' : 'mp4';
    const buffer = await saveToBuffer(file => socialDl.instagramSave(url, file), { extension, audio });
    return { buffer, mimetype: audio ? 'audio/mpeg' : 'video/mp4', extension, mediaType: audio ? 'audio' : 'video' };
}

async function downloadFacebook(url, format = 'mp4') {
    const socialDl = await loadSocialDl();
    const audio = format === 'mp3';
    const extension = audio ? 'mp3' : 'mp4';
    const buffer = await saveToBuffer(file => socialDl.facebookSave(url, file), { extension, audio });
    return { buffer, mimetype: audio ? 'audio/mpeg' : 'video/mp4', extension, mediaType: audio ? 'audio' : 'video' };
}

async function downloadSpotify(url) {
    const socialDl = await loadSocialDl();
    const info = await socialDl.spotifyDl(url);
    if (info?.type && info.type !== 'track') throw new Error('Use a Spotify track link to download one song.');
    const buffer = await saveToBuffer(file => socialDl.spotifySaveMatched(info, file), { extension: 'mp3', audio: true });
    return { buffer, title: info.title || 'Spotify track', artist: info.artist || info.author || 'Unknown artist', thumbnail: info.thumbnail || null, audioSource: info.audioSource || info.matchedSource?.platform || null, mimetype: 'audio/mpeg', extension: 'mp3', mediaType: 'audio' };
}

async function downloadAppleMusic(url) {
    const socialDl = await loadSocialDl();
    const info = await socialDl.applemusicDl(url);
    const isPreviewFallback = info.isPreviewFallback === true;
    const extension = isPreviewFallback ? 'm4a' : 'mp3';
    const buffer = await saveToBuffer(file => isPreviewFallback
        ? downloadUrlToFile(info.previewUrl, file, 'https://music.apple.com/')
        : socialDl.saveMatchedAudio(info, file), { extension, audio: true });
    return {
        buffer,
        title: info.title || 'Apple Music track',
        artist: info.artist || info.author || 'Unknown artist',
        album: info.album || '',
        thumbnail: info.thumbnail || null,
        audioSource: info.audioSource || null,
        isPreviewFallback,
        mimetype: extension === 'mp3' ? 'audio/mpeg' : 'audio/mp4',
        extension,
        mediaType: 'audio'
    };
}

async function downloadAudiomack(url) {
    const socialDl = await loadSocialDl();
    const info = await socialDl.audiomackDl(url);
    const format = info.formats?.find(item => item?.url && /^audio\//i.test(item.contentType || '')) || info.formats?.[0];
    if (!format?.url) throw new Error('AUDIOMACK_AUDIO_NOT_FOUND');
    const buffer = await saveToBuffer(file => downloadUrlToFile(format.url, file, url), { extension: info.downloadExtension || 'm4a', audio: true });
    return {
        buffer,
        title: info.title || 'Audiomack track',
        artist: info.artist || info.author || 'Unknown artist',
        album: info.album || '',
        thumbnail: info.thumbnail || null,
        mimetype: info.downloadExtension === 'mp3' ? 'audio/mpeg' : 'audio/mp4',
        extension: info.downloadExtension || 'm4a',
        mediaType: 'audio'
    };
}

async function sendDownloadedMedia(sock, m, media, caption = '⬇️ *Social Downloader*') {
    if (media?.mediaType === 'photo' && Array.isArray(media.images)) {
        if (media.images.length > 1 && typeof sock.sendAlbumMessage === 'function' && media.images.every(image => image.url)) {
            try {
                const items = media.images.map(image => ({
                    type: 'image',
                    image: { url: image.url, sourceUrl: image.url, imageHighResUrl: image.url, mimetype: image.mimetype }
                }));
                const sentAlbum = await sock.sendAlbumMessage(m.chat, items, {
                    quoted: m,
                    text: `${caption}${media.title ? `\n${media.title}` : ''}`,
                    footer: `Photo carousel · ${media.images.length} images`
                });
                if (sentAlbum?.key?.id || sentAlbum?.message?.key?.id || sentAlbum?.id) {
                    return { sent: media.images.length, total: media.images.length, failed: 0, album: true };
                }
            } catch (error) {
                console.warn('[SOCIAL-DL ALBUM FALLBACK]', error.message);
            }
        }
        const sent = [];
        const failures = [];
        for (const [index, image] of media.images.entries()) {
            const imageCaption = index === 0
                ? `${caption}${media.title ? `\n${media.title}` : ''}\n🖼️ ${index + 1}/${media.images.length}`
                : `🖼️ ${index + 1}/${media.images.length}`;
            try {
                await sock.sendMessage(m.chat, { image: image.buffer, mimetype: image.mimetype, caption: imageCaption }, { quoted: index === 0 ? m : undefined });
                sent.push(index);
            } catch (error) {
                failures.push({ index, error });
                console.warn('[SOCIAL-DL IMAGE SEND SKIPPED]', index + 1, error.message);
            }
        }
        if (!sent.length) throw new Error('WHATSAPP_COULD_NOT_SEND_IMAGES');
        return { sent: sent.length, total: media.images.length, failed: failures.length, album: false };
    }

    if (media?.mediaType === 'audio' || /^audio\//i.test(media?.mimetype || '')) {
        await sock.sendMessage(m.chat, { audio: media.buffer, mimetype: media.mimetype || 'audio/mpeg', fileName: media.fileName || `download.${media.extension || 'mp3'}`, ptt: false, caption }, { quoted: m });
        return { sent: 1, total: 1, failed: 0 };
    }
    if (/^image\//i.test(media?.mimetype || '')) {
        await sock.sendMessage(m.chat, { image: media.buffer, mimetype: media.mimetype, caption }, { quoted: m });
        return { sent: 1, total: 1, failed: 0 };
    }
    await sock.sendMessage(m.chat, { video: media.buffer, mimetype: media.mimetype || 'video/mp4', caption }, { quoted: m });
    return { sent: 1, total: 1, failed: 0 };
}

module.exports = {
    loadSocialDl,
    downloadYouTube,
    downloadUniversal,
    downloadTikTok,
    downloadInstagram,
    downloadFacebook,
    downloadSpotify,
    downloadAppleMusic,
    downloadAudiomack,
    downloadImageBuffer,
    sendDownloadedMedia,
    saveToBuffer,
    safeDownloadError,
    isExpectedMediaType,
    universalOutputExtension,
    isDramaBoxShareUrl,
    downloadDramaBoxViaWorker
};
