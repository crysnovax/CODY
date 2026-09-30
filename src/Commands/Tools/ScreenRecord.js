'use strict';

const axios = require('axios');

const SNAPSHOT_API = 'https://snapshot.xwolf.space/api';
const RECORD_ENDPOINT = `${SNAPSHOT_API}/record`;
const URL_PATTERN = /(https?:\/\/[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s]*)/g;

function normalizeUrl(value) {
    const candidate = String(value || '').trim().replace(/[),.;!?]+$/, '');
    if (!candidate) return null;
    const url = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) return null;
        return parsed.toString();
    } catch {
        return null;
    }
}

function extractUrls(sources) {
    return [...new Set(
        (String(sources || '').match(URL_PATTERN) || [])
            .map(normalizeUrl)
            .filter(Boolean)
    )];
}

function recordingViewport(command) {
    const normalized = String(command || '').toLowerCase();
    return normalized === 'wssrmobile' || normalized === 'screenrecordmobile' ? 'mobile' : 'desktop';
}

async function downloadRecording(targetUrl, viewport = 'desktop', httpClient = axios) {
    const metadataResponse = await httpClient.get(RECORD_ENDPOINT, {
        params: { siteUrl: targetUrl, viewport },
        timeout: 120000
    });
    const metadata = metadataResponse?.data;
    if (!metadata || metadata.status === 'failed') {
        throw new Error(metadata?.error || 'Snapshot could not record the site.');
    }
    if (metadata.status && metadata.status !== 'completed') {
        throw new Error(`Snapshot recording did not complete (status: ${metadata.status}).`);
    }
    if (!metadata.videoUrl) throw new Error('Snapshot returned no video URL.');

    const videoUrl = new URL(metadata.videoUrl, `${SNAPSHOT_API}/`).toString();
    const videoResponse = await httpClient.get(videoUrl, {
        responseType: 'arraybuffer',
        timeout: 120000,
        maxContentLength: 50 * 1024 * 1024,
        maxBodyLength: 50 * 1024 * 1024
    });
    const contentType = String(videoResponse.headers?.['content-type'] || '').toLowerCase();
    if (contentType && !contentType.includes('video') && !contentType.includes('octet-stream')) {
        throw new Error(`Snapshot video endpoint returned ${contentType}, not an MP4.`);
    }
    const buffer = Buffer.from(videoResponse.data);
    if (!buffer.length) throw new Error('Snapshot returned an empty video.');
    return buffer;
}

module.exports = {
    name: 'wssr',
    alias: ['screenrecord', 'screenrec', 'recordsite', 'wssrmobile'],
    category: 'Tools',
    desc: 'Record a website and return a clean video',

    async execute(sock, m, { args = [], reply }) {
        const command = String(m.body || '').trim().split(/\s+/)[0].replace(/^./, '');
        const sources = [
            args.join(' '),
            m.quoted?.body || '',
            m.quoted?.text || '',
            m.quoted?.caption || ''
        ].join(' ').trim();
        const urls = extractUrls(sources);

        if (!sources) return reply('*_✘ Add a link*_');
        if (!urls.length) return reply('_*𓄄 No valid urls found*_');

        const viewport = recordingViewport(command);
        for (const targetUrl of urls) {
            try {
                const buffer = await module.exports.downloadRecording(targetUrl, viewport);
                // Deliberately send no caption or progress text: the result is video alone.
                await sock.sendMessage(m.chat, {
                    video: buffer,
                    mimetype: 'video/mp4',
                    fileName: 'website-screen-recording.mp4'
                }, { quoted: m });
            } catch (error) {
                await reply(`_*𓄄 Failed for:*_ ${targetUrl}\n${error.message}`);
            }
        }
    },

    extractUrls,
    normalizeUrl,
    recordingViewport,
    downloadRecording
};
