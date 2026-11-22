'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const axios = require('axios');
const execFileAsync = promisify(execFile);
// Use the host's FFmpeg from PATH, matching the working tgsticker command.
// npm-bundled binaries are not reliably executable on the hosting container.
const ffmpegPath = 'ffmpeg';

const { Sticker } = require('../Utils/sticker-converter');
const { getStickerBranding } = require('../../Plugin/packname');

const GIPHY_API_KEY = process.env.GIPHY_API_KEY
    || Buffer.from('SzExdWVNUzRYUjRlVTRCNk1nRTRvc2NJUXpwVGNrNW4=', 'base64').toString('utf8');
const GIPHY_SEARCH_URL = 'https://api.giphy.com/v1/gifs/search';
const MAX_STICKERS = 25; // TEST - still 5, was 60
const MAX_STICKER_BYTES = 950 * 1024;
const MAX_SOURCE_BYTES = 30 * 1024 * 1024;
const CONCURRENCY = 3;
// SPEED FIX: fps 10 (was 15), 4s max (was 8s)
const ANIMATED_FILTER = 'fps=10,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=yuva420p';
const STATIC_FILTER = 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=yuva420p';

function pickAnimated(item) {
    const images = item?.images || {};
    // Small -> large, MP4 decodes way faster than GIF
    const candidates = [
        images.downsized_small,
        images.fixed_height_small,
        images.fixed_width_small,
        images.downsized,
        images.fixed_height,
        images.original
    ];
    for (const c of candidates) {
        if (c?.mp4) return { url: c.mp4, animated: true };
        if (c?.webp) return { url: c.webp, animated: Number(c.frames) > 1 };
        if (c?.url) return { url: c.url, animated: true };
    }
    return null;
}

function pickStatic(item) {
    const images = item?.images || {};
    const stills = [
        images.original_still,
        images.fixed_height_still,
        images.fixed_width_still,
        images.downsized_still,
        images.downsized_large_still,
        images.fixed_height_small_still
    ];
    for (const s of stills) {
        if (s?.url) return { url: s.url, animated: false };
    }
    return null;
}

// Half / half: wantAnimated = true for first half, false for second half
function chooseSource(item, wantAnimated = true) {
    if (wantAnimated) {
        return pickAnimated(item) || pickStatic(item);
    }
    // Static slot: prefer still, fallback to animated source but force first-frame only
    const still = pickStatic(item);
    if (still) return still;
    const anim = pickAnimated(item);
    if (anim) return { url: anim.url, animated: false };
    return null;
}

// NEW: parse --animated / --static flags
function parseStickerSearchArgs(args = []) {
    const lower = args.map(a => String(a).toLowerCase());
    const hasAnimated = lower.includes('--animated') || lower.includes('--anim');
    const hasStatic = lower.includes('--static') || lower.includes('--still');
    let mode = 'mix';
    if (hasAnimated && !hasStatic) mode = 'animated';
    else if (hasStatic && !hasAnimated) mode = 'static';
    else mode = 'mix'; // no flag, or both flags = mix
    // Strip all --flags so Giphy only gets the real query
    const query = args.filter(a => !String(a).startsWith('--')).join(' ').trim();
    return { query, mode };
}

function safePackName(query) {
    const clean = String(query || 'Sticker Search').replace(/[\r\n]+/g, ' ').trim();
    return `${clean || 'Sticker Search'} Stickers`.slice(0, 64);
}

async function downloadAsset(url) {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Invalid sticker URL.');
    const response = await axios.get(parsed.href, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: MAX_SOURCE_BYTES,
        maxBodyLength: MAX_SOURCE_BYTES,
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/gif,image/webp,image/jpeg,image/png,video/*,*/*;q=0.8' }
    });
    const buffer = Buffer.from(response.data || []);
    if (!buffer.length) throw new Error('Empty sticker download.');
    if (buffer.length > MAX_SOURCE_BYTES) throw new Error('Sticker source is too large.');
    return buffer;
}

function ffmpegArguments(inputPath, outputPath, animated, quality) {
    const args = ['-hide_banner', '-loglevel', 'error', '-y', '-threads', '2', '-i', inputPath];
    if (animated) args.push('-t', '4', '-vf', ANIMATED_FILTER);
    else args.push('-frames:v', '1', '-vf', STATIC_FILTER);
    args.push('-an', '-c:v', 'libwebp', '-lossless', '0', '-q:v', String(quality), '-compression_level', '4'); // was 6
    if (animated) args.push('-loop', '0');
    args.push(outputPath);
    return args;
}

async function convertSticker(source, index, runDir, pack, author) {
    const inputPath = path.join(runDir, `source_${index}`);
    fs.writeFileSync(inputPath, source.buffer);
    try {
        // SPEED FIX: only 2 tries (was 5). First try usually passes now because source is small.
        const qualities = source.animated ? [55, 35] : [75, 50];
        for (const quality of qualities) {
            const outputPath = path.join(runDir, `sticker_${index}_${quality}.webp`);
            try {
                await execFileAsync(ffmpegPath, ffmpegArguments(inputPath, outputPath, source.animated, quality), {
                    timeout: 60000,
                    maxBuffer: 8 * 1024 * 1024
                });
                let webp = await fs.promises.readFile(outputPath);
                if (!webp.length) continue;
                try {
                    webp = await new Sticker(webp, { pack, author, type: 'full', quality }).toBuffer();
                } catch {}
                if (webp.length <= MAX_STICKER_BYTES) {
                    const finalPath = path.join(runDir, `ready_${index}.webp`);
                    await fs.promises.writeFile(finalPath, webp);
                    return { path: finalPath, animated: source.animated };
                }
            } finally {
                await fs.promises.unlink(outputPath).catch(() => {});
            }
        }
        return null;
    } finally {
        await fs.promises.unlink(inputPath).catch(() => {});
    }
}

async function pool(items, limit, worker) {
    const output = new Array(items.length);
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
            const index = cursor++;
            try { output[index] = await worker(items[index], index); }
            catch (error) {
                console.warn(`[STICKERSEARCH] Item ${index + 1} failed:`, error?.message || error);
                output[index] = null;
            }
        }
    }));
    return output;
}

async function safeReply(reply, text) {
    if (typeof reply === 'function') await reply(text);
}

module.exports = {
    name: 'stickersearch',
    alias: ['searchsticker', 'stikersearch', 'gifsticker'],
    desc: 'Search Giphy and send up to 5 stickers as one pack - mix / --animated / --static',
    category: 'Search',
    usage: '.stickersearch <query> [--animated | --static]',
    reactions: { start: '🍁', success: '🔖', error: '😢' },
    limits: { maxStickers: MAX_STICKERS, maxStickerBytes: MAX_STICKER_BYTES },
    helpers: { chooseSource, pickAnimated, pickStatic, parseStickerSearchArgs, safePackName, ffmpegArguments, convertSticker, pool, ffmpegPath },

    execute: async (sock, message, { args = [], reply, senderName } = {}) => {
        const { query, mode } = parseStickerSearchArgs(args);
        const chat = message.chat || message.from || message.key?.remoteJid;
        if (!query) {
            return safeReply(reply,
                '🍁 *Sticker Search*\n\n' +
                'Usage: .stickersearch <query> [--animated | --static]\n' +
                'Examples:\n' +
                '.stickersearch Ronaldo\n' +
                '.stickersearch Ronaldo --animated\n' +
                '.stickersearch Ronaldo --static'
            );
        }
        if (!GIPHY_API_KEY) return safeReply(reply, 'GIPHY_API_KEY is not configured.');

        const runDir = path.join(os.tmpdir(), `cody-stickersearch-${process.pid}-${Date.now()}`);
        try {
            await fs.promises.mkdir(runDir, { recursive: true });
            await sock.sendMessage(chat, { react: { text: '🍁', key: message.key } }).catch(() => {});
            const response = await axios.get(GIPHY_SEARCH_URL, {
                params: {
                    q: query,
                    api_key: GIPHY_API_KEY,
                    limit: MAX_STICKERS,
                    rating: 'r'
                },
                timeout: 30000
            });
            const items = (Array.isArray(response.data?.data) ? response.data.data : []).slice(0, MAX_STICKERS);
            if (!items.length) {
                await sock.sendMessage(chat, { react: { text: '❔', key: message.key } }).catch(() => {});
                return safeReply(reply, '`No stickers found. Try another search.`');
            }

            const { pack: brandPack, author: brandAuthor } = getStickerBranding();
            const pack = senderName ? `${brandPack} · ${String(senderName).slice(0, 24)}` : brandPack;

            // MODE: animated = all animated, static = all static, mix = half/half
            let animatedTarget, staticTarget;
            if (mode === 'animated') {
                animatedTarget = MAX_STICKERS;
                staticTarget = 0;
            } else if (mode === 'static') {
                animatedTarget = 0;
                staticTarget = MAX_STICKERS;
            } else {
                animatedTarget = Math.ceil(MAX_STICKERS / 2); // 3 when MAX=5, 30 when MAX=60
                staticTarget = MAX_STICKERS - animatedTarget; // 2 when MAX=5, 30 when MAX=60
            }

            const preparingText = mode === 'animated'
                ? `🍁 Found ${items.length} results for “${query}”. Preparing ${animatedTarget} animated…`
                : mode === 'static'
                    ? `🍁 Found ${items.length} results for “${query}”. Preparing ${staticTarget} static…`
                    : `🍁 Found ${items.length} results for “${query}”. Preparing ${animatedTarget} animated + ${staticTarget} static…`;
            await safeReply(reply, preparingText);

            const selected = items.map((item, index) => {
                let wantAnimated;
                if (mode === 'animated') wantAnimated = true;
                else if (mode === 'static') wantAnimated = false;
                else wantAnimated = index < animatedTarget;
                return { item, index, wantAnimated, source: chooseSource(item, wantAnimated) };
            }).filter(entry => entry.source);

            const processed = await pool(selected, CONCURRENCY, async entry => {
                const buffer = await downloadAsset(entry.source.url);
                return convertSticker({ ...entry.source, buffer }, entry.index, runDir, pack, brandAuthor);
            });
            const stickers = processed.filter(Boolean).slice(0, MAX_STICKERS);
            if (!stickers.length) throw new Error('Could not process any search results into WhatsApp stickers.');

            // SEND AS PACK - same shape as tgsticker
            const packName = safePackName(query);
            await sock.sendMessage(chat, {
                cover: { url: stickers[0].path },
                stickers: stickers.map(sticker => ({ data: { url: sticker.path } })),
                name: packName,
                publisher: brandAuthor,
                description: `Giphy ${mode} stickers: ${query}`.slice(0, 128)
            }, { quoted: message });

            const animated = stickers.filter(sticker => sticker.animated).length;
            const still = stickers.length - animated;
            const skipped = items.length - stickers.length;
           
            await sock.sendMessage(chat, { react: { text: '💯', key: message.key } }).catch(() => {});
        } catch (error) {
            console.error('[STICKERSEARCH]', error?.stack || error);
            await sock.sendMessage(chat, { react: { text: '❔', key: message.key } }).catch(() => {});
            const status = error?.response?.status;
            const messageText = status === 429
                ? '【entity-Giphy¦canonical_name=Giphy】 rate limit reached. Try again later.'
                : `Sticker search failed: ${error?.message || 'unknown error'}`;
            await safeReply(reply, messageText);
        } finally {
            await fs.promises.rm(runDir, { recursive: true, force: true }).catch(() => {});
        }
    }
};
