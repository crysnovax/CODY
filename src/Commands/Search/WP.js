const axios = require('axios');
const config = require('../../../settings/config');

const BOT_NAME = config.botname || process.env.BOTNAME || 'CRYSNOVA';
const PRIMARY_API = 'https://wallpaper.crysnovax.link/api/search';
const FALLBACK_API = 'https://wallhaven.cc/api/v1/search';
const IMAGE_TIMEOUT = 30000;

function normalizeResults(data) {
    const raw = Array.isArray(data) ? data : (data?.results || data?.data || data?.wallpapers || []);
    return raw.map(item => ({
        ...item,
        proxy: item.proxy || item.path || item.thumbs?.original || item.thumbs?.large || item.url
    })).filter(item => /^https?:\/\//i.test(String(item.proxy || '')));
}

async function searchWallpapers(query) {
    try {
        const response = await axios.get(PRIMARY_API, {
            params: { query },
            timeout: 20000,
            validateStatus: () => true
        });
        if (response.status < 200 || response.status >= 300 || response.data?.status === false) {
            throw new Error(response.data?.details || response.data?.error || `Wallpaper API HTTP ${response.status}`);
        }
        const results = normalizeResults(response.data);
        if (results.length) return { results, source: 'CRYSNOVA Wallpaper API' };
        throw new Error('CRYSNOVA Wallpaper API returned no results');
    } catch (primaryError) {
        console.warn('[WALLPAPER] Primary API unavailable:', primaryError.message);
        const response = await axios.get(FALLBACK_API, {
            params: { q: query, sorting: 'relevance', page: 1 },
            timeout: 20000
        });
        const results = normalizeResults(response.data);
        if (!results.length) throw new Error('No wallpapers returned by either provider');
        return { results, source: 'Wallhaven fallback' };
    }
}

async function downloadImageBuffer(url) {
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: IMAGE_TIMEOUT,
        maxContentLength: 20 * 1024 * 1024,
        maxBodyLength: 20 * 1024 * 1024,
        validateStatus: status => status >= 200 && status < 300,
        headers: { Accept: 'image/*', 'User-Agent': 'CODY-Wallpaper/2.0' }
    });
    const buffer = Buffer.from(response.data);
    if (!buffer.length) throw new Error('empty image response');
    return { buffer, mimetype: response.headers?.['content-type'] || 'image/jpeg' };
}

async function resolveImages(results) {
    const resolved = await Promise.all(results.slice(0, 10).map(async wallpaper => {
        try {
            const media = await downloadImageBuffer(wallpaper.proxy);
            return { ...wallpaper, ...media };
        } catch (error) {
            console.warn('[WALLPAPER] Image skipped:', wallpaper.proxy, error.message);
            return null;
        }
    }));
    return resolved.filter(Boolean);
}

function buildAlbumItems(images) {
    return images.map(wallpaper => ({
        type: 'image',
        image: {
            // sendAlbumMessage intentionally uses the original URL in every image slot.
            // This avoids the corrupted preview-only rendering seen with the old carousel.
            url: wallpaper.proxy,
            sourceUrl: wallpaper.proxy,
            imageHighResUrl: wallpaper.proxy,
            mimetype: wallpaper.mimetype
        }
    }));
}

async function sendWallpaperAlbum(sock, jid, images, query, source, quoted) {
    const items = buildAlbumItems(images);
    const sent = await sock.sendAlbumMessage(jid, items, {
        quoted,
        text: `🖼️ WALLPAPER SEARCH: ${query}`,
        footer: `Found ${images.length} results · ${source}`
    });
    if (!sent?.key?.id && !sent?.message?.key?.id && !sent?.id) {
        throw new Error('carousel send returned no message key');
    }
    return sent;
}

module.exports = {
    name: 'wallpaper',
    alias: ['wlp', 'wall'],
    desc: 'Search for beautiful wallpapers',
    category: 'Search',
    usage: '.wallpaper <query>',

    execute: async (sock, m, { args, reply }) => {
        const query = args.join(' ').trim();
        if (!query) return reply('_Provide a wallpaper query to search._');

        try {
            await sock.sendMessage(m.chat, { react: { text: '🖼️', key: m.key } });
            const { results, source } = await searchWallpapers(query);
            const images = await resolveImages(results);
            if (!images.length) throw new Error('Wallpaper URLs were returned, but none could be downloaded');

            if (images.length < 2) throw new Error('At least two wallpaper images are required for an album');
            await sendWallpaperAlbum(sock, m.chat, images.slice(0, 10), query, source, m);
            await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });
        } catch (error) {
            console.error('[WALLPAPER]', error.stack || error.message);
            await reply(`✘ Wallpaper search failed: ${error.message}`);
        }
    }
};

module.exports.normalizeResults = normalizeResults;
module.exports.searchWallpapers = searchWallpapers;
module.exports.downloadImageBuffer = downloadImageBuffer;
module.exports.resolveImages = resolveImages;
module.exports.buildAlbumItems = buildAlbumItems;
module.exports.sendWallpaperAlbum = sendWallpaperAlbum;
