'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const axios = require('axios');

function resolveFfmpegPath() {
    const candidates = [];
    if (process.env.FFMPEG_PATH) candidates.push(process.env.FFMPEG_PATH);
    try { candidates.push(require('@ffmpeg-installer/ffmpeg').path); } catch {}
    try { candidates.push(require('ffmpeg-static')); } catch {}
    return candidates.find(candidate =>
        typeof candidate === 'string' && candidate.length > 0 && fs.existsSync(candidate)
    ) || 'ffmpeg';
}

const ffmpegPath = resolveFfmpegPath();
const { Sticker } = require('../Utils/sticker-converter');
const { getStickerBranding } = require('../../Plugin/packname');

const execFileAsync = promisify(execFile);
const GIPHY_API_KEY = process.env.GIPHY_API_KEY
    || Buffer.from('SzExdWVNUzRYUjRlVTRCNk1nRTRvc2NJUXpwVGNrNW4=', 'base64').toString('utf8');
const GIPHY_SEARCH_URL = 'https://api.giphy.com/v1/gifs/search';
const MAX_STICKERS = 60;
const MAX_STICKER_BYTES = 950 * 1024;
const MAX_SOURCE_BYTES = 30 * 1024 * 1024;
const CONCURRENCY = 3;
const ANIMATED_FILTER = 'fps=15,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=yuva420p';
const STATIC_FILTER = 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=yuva420p';

function chooseSource(item) {
    const images = item?.images || {};
    const original = images.original || images.downsized_large || images.fixed_height;
    const still = images.original_still || images.fixed_height_still || images.preview_gif;
    const url = original?.url || still?.url;
    if (!url) return null;

    const frameCount = Number(original?.frames);
    const hasFrameCount = original?.frames !== undefined && Number.isFinite(frameCount);
    const animated = hasFrameCount
        ? frameCount > 1
        : /\.(?:gif|mp4|webm)(?:[?#]|$)/i.test(url);
    if (!animated && still?.url) return { url: still.url, animated: false };
    return { url, animated };
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
    const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath];
    if (animated) args.push('-t', '8', '-vf', ANIMATED_FILTER);
    else args.push('-frames:v', '1', '-vf', STATIC_FILTER);
    args.push('-an', '-c:v', 'libwebp', '-lossless', '0', '-q:v', String(quality), '-compression_level', '6');
    if (animated) args.push('-loop', '0');
    args.push(outputPath);
    return args;
}

async function convertSticker(source, index, runDir, pack, author) {
    const inputPath = path.join(runDir, `source_${index}`);
    fs.writeFileSync(inputPath, source.buffer);
    try {
        const qualities = source.animated ? [65, 50, 40, 30, 22] : [82, 68, 54, 40, 28];
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
    desc: 'Search Giphy and send up to 60 animated/static stickers together as a WhatsApp sticker pack',
    category: 'Search',
    usage: '.stickersearch <query>',
    reactions: { start: '🍁', success: '🔖', error: '😢' },
    limits: { maxStickers: MAX_STICKERS, maxStickerBytes: MAX_STICKER_BYTES },
    helpers: { chooseSource, safePackName, ffmpegArguments, convertSticker, pool, ffmpegPath },

    execute: async (sock, message, { args = [], reply, senderName } = {}) => {
        const query = args.join(' ').trim();
        const chat = message.chat || message.from || message.key?.remoteJid;
        if (!query) {
            return safeReply(reply,
                '🍁 *Sticker Search*\n\nUsage: .stickersearch <query>\nExamples: .stickersearch cat, .stickersearch anime happy'
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
            await safeReply(reply, `🍁 Found ${items.length} results for “${query}”. Preparing one sticker pack (up to ${MAX_STICKERS})…`);

            const selected = items.map((item, index) => ({ item, index, source: chooseSource(item) }))
                .filter(entry => entry.source);
            const processed = await pool(selected, CONCURRENCY, async entry => {
                const buffer = await downloadAsset(entry.source.url);
                return convertSticker({ ...entry.source, buffer }, entry.index, runDir, pack, brandAuthor);
            });
            const stickers = processed.filter(Boolean).slice(0, MAX_STICKERS);
            if (!stickers.length) throw new Error('Could not process any search results into WhatsApp stickers.');

            const packName = safePackName(query);
            await sock.sendMessage(chat, {
                cover: { url: stickers[0].path },
                stickers: stickers.map(sticker => ({ data: { url: sticker.path } })),
                name: packName,
                publisher: brandAuthor,
                description: `Giphy sticker search: ${query}`.slice(0, 128)
            }, { quoted: message });

            const animated = stickers.filter(sticker => sticker.animated).length;
            const still = stickers.length - animated;
            const skipped = items.length - stickers.length;
            await safeReply(reply,
                `📦 Sent *${stickers.length}* stickers as one pack (${animated} animated, ${still} static).` +
                (skipped ? ` ${skipped} result${skipped === 1 ? '' : 's'} could not be converted.` : '')
            );
            await sock.sendMessage(chat, { react: { text: '💯', key: message.key } }).catch(() => {});
        } catch (error) {
            console.error('[STICKERSEARCH]', error?.stack || error);
            await sock.sendMessage(chat, { react: { text: '❔', key: message.key } }).catch(() => {});
            const status = error?.response?.status;
            const messageText = status === 429
                ? 'Giphy rate limit reached. Try again later.'
                : `Sticker search failed: ${error?.message || 'unknown error'}`;
            await safeReply(reply, messageText);
        } finally {
            await fs.promises.rm(runDir, { recursive: true, force: true }).catch(() => {});
        }
    }
};
