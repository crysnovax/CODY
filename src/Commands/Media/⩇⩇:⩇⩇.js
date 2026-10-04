const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { addExif } = require('../../../library/exif');
const { getStickerBranding } = require('../../Plugin/packname');

// WhatsApp caps a single sticker at 1 MB. 15% headroom for the exif chunk
// addExif appends after encoding.
const STICKER_LIMIT = 950 * 1024;

// Concurrent sticker pipelines. Telegram tolerates ~30 req/sec; 6 is safe
// and turns a 90s sequential pack into ~15s.
const CONCURRENCY = 6;

// Cache getStickerSet responses so repeat calls on the same pack skip the API.
const PACK_TTL_MS = 5 * 60 * 1000;
const packCache = new Map();

// Shared 512x512 centre-crop filter.
const CROP_VF =
    'scale=512:512:force_original_aspect_ratio=increase,' +
    'crop=512:512:(iw-ow)/2:(ih-oh)/2';

// Promise wrapper around exec.
function run(cmd) {
    return new Promise((resolve, reject) =>
        exec(cmd, { maxBuffer: 16 * 1024 * 1024 }, (err, stdout) =>
            err ? reject(err) : resolve(stdout)
        )
    );
}

// Read duration from a .webm so we can compute a target bitrate that fits.
// Telegram caps video stickers at ~3s, so that's the fallback.
async function ffprobeDuration(inputPath) {
    try {
        const out = await run(
            `ffprobe -v error -show_entries format=duration ` +
            `-of default=noprint_wrappers=1:nokey=1 "${inputPath}"`
        );
        const d = parseFloat(String(out).trim());
        return Number.isFinite(d) && d > 0 ? d : 3;
    } catch {
        return 3;
    }
}

// One-shot video encode targeting a specific bitrate. Replaces the old
// q-ladder — we compute the bitrate up front and trust ffmpeg to hit it.
async function encodeVideo(inputPath, outputPath, bitrateKbps) {
    const cmd =
        `ffmpeg -y -i "${inputPath}" ` +
        `-vf "${CROP_VF},format=yuva420p,fps=15" ` +
        `-c:v libwebp -lossless 0 -b:v ${bitrateKbps}k ` +
        `-maxrate ${bitrateKbps}k -bufsize ${bitrateKbps * 2}k ` +
        `-loop 0 -an -compression_level 6 "${outputPath}"`;
    await run(cmd);
    return fs.readFileSync(outputPath);
}

// Static re-encode. Only used for oversized static webp, which is rare.
async function encodeStatic(inputPath, outputPath, q) {
    const cmd =
        `ffmpeg -y -i "${inputPath}" ` +
        `-vf "${CROP_VF}" ` +
        `-c:v libwebp -lossless 0 -q:v ${q} "${outputPath}"`;
    await run(cmd);
    return fs.readFileSync(outputPath);
}

// Minimal concurrency pool — no deps. Preserves input order in the result.
async function pool(items, limit, worker) {
    const results = new Array(items.length);
    let cursor = 0;
    const runners = Array.from(
        { length: Math.min(limit, items.length) },
        async () => {
            while (cursor < items.length) {
                const i = cursor++;
                try {
                    results[i] = await worker(items[i], i);
                } catch {
                    results[i] = null;
                }
            }
        }
    );
    await Promise.all(runners);
    return results;
}

// Cached getStickerSet. The response already tells us is_video / is_animated
// / file_size for every sticker, which the pre-filter and encoder both use.
async function fetchStickerSet(botToken, name) {
    const cached = packCache.get(name);
    if (cached && cached.expires > Date.now()) return cached.data;

    const res = await fetch(
        `https://api.telegram.org/bot${botToken}/getStickerSet?name=${name}`
    );
    const data = await res.json();

    if (data.ok) {
        packCache.set(name, { data, expires: Date.now() + PACK_TTL_MS });
    }
    return data;
}

module.exports = {
    name: 'tgsticker',
    alias: ['tg', 'telegramsticker', 'tgs'],
    desc: 'Download Telegram sticker pack and send as one WhatsApp sticker pack',
    category: 'Tools',
    usage: '.tg <Telegram sticker URL>',
    examples: ['.tg https://t.me/addstickers/HoppersCartoon'],
    reactions: { start: '📦', success: '🍃', error: '🕸️' },

    execute: async (sock, m, { args, reply }) => {
        let link = args[0];
        const chatId = m.chat || m.from || m.key?.remoteJid;

        if (m.quoted && m.quoted.text) {
            const match = m.quoted.text.match(/https?:\/\/t\.me\/addstickers\/[^\s]+/i);
            if (match) link = match[0];
        }

        const safeReply = async (text) => {
            try {
                if (reply && typeof reply === 'function') {
                    await reply(text);
                } else if (sock && sock.sendMessage && chatId) {
                    await sock.sendMessage(chatId, { text });
                }
            } catch (e) {}
        };

        if (!link || !link.includes('t.me/addstickers/')) {
            return safeReply(
                `📦 *TELEGRAM STICKER DOWNLOADER*\n\n` +
                `*Usage:* .tg <Telegram sticker URL>\n\n` +
                `*Example:* .tg https://t.me/addstickers/HoppersCartoon\n\n` +
                `Or reply to a message containing a Telegram sticker link.`
            );
        }

        try {
            await sock.sendMessage(chatId, { react: { text: '📦', key: m.key } });
        } catch (e) {}

        const packName = link.split('t.me/addstickers/')[1].split(/[?#]/)[0];
        const { pack: brandPack, author: brandAuthor } = getStickerBranding();

        const botToken = String(
            process.env.TELEGRAM_BOT_TOKEN ||
            '8785971951:AAEpZnwIrkH7zpmNK3Dwtzr8xgymLPBuppE'
        ).trim();
        if (!botToken) {
            return safeReply('✘ Telegram sticker support is not configured on this deployment.');
        }

        const tempDir = path.join(__dirname, '../../temp');
        const runDir = path.join(tempDir, `tgpack_${Date.now()}`);

        try {
            const data = await fetchStickerSet(botToken, packName);

            if (!data.ok) {
                throw new Error(data.description || 'Invalid sticker pack');
            }

            // WhatsApp caps a single pack payload at ~60 stickers.
            const all = data.result.stickers.slice(0, 60);
            if (all.length === 0) throw new Error('Sticker pack is empty');

            // Pre-filter: drop Lottie .tgs before we pay a getFile round-trip
            // for them. Telegram flags these as is_animated && !is_video.
            const candidates = all.filter(
                (s) => !(s.is_animated && !s.is_video)
            );

            if (!fs.existsSync(runDir)) {
                fs.mkdirSync(runDir, { recursive: true });
            }

            // Each worker handles one sticker: fetch -> normalise -> exif ->
            // write to disk. Returns the path, or null to skip the sticker.
            const results = await pool(candidates, CONCURRENCY, async (sticker, i) => {
                try {
                    const fileRes = await fetch(
                        `https://api.telegram.org/bot${botToken}/getFile?file_id=${sticker.file_id}`
                    );
                    const fileData = await fileRes.json();
                    if (!fileData.ok) return null;

                    const filePath = fileData.result.file_path || '';
                    // Belt-and-braces: some packs mislabel .tgs as static.
                    if (filePath.endsWith('.tgs')) return null;

                    const imgRes = await fetch(
                        `https://api.telegram.org/file/bot${botToken}/${filePath}`
                    );
                    if (!imgRes.ok) return null;

                    const raw = Buffer.from(await imgRes.arrayBuffer());
                    const isVideo = !!sticker.is_video;

                    let finalBuffer;

                    if (!isVideo && raw.length <= STICKER_LIMIT) {
                        // Fast path: static webp already small enough. No ffmpeg.
                        finalBuffer = raw;

                    } else if (isVideo) {
                        // Video path: compute a bitrate that fits under the cap
                        // in one pass, no quality ladder.
                        const input = path.join(runDir, `v_in_${i}.webm`);
                        const output = path.join(runDir, `v_out_${i}.webp`);
                        fs.writeFileSync(input, raw);
                        try {
                            const dur = await ffprobeDuration(input);
                            const targetBytes = STICKER_LIMIT * 0.85;
                            const br = Math.max(
                                80,
                                Math.floor((targetBytes * 8) / dur / 1000)
                            );
                            finalBuffer = await encodeVideo(input, output, br);
                        } finally {
                            try { fs.unlinkSync(input); } catch {}
                            try { fs.unlinkSync(output); } catch {}
                        }
                        if (finalBuffer.length > STICKER_LIMIT) return null;

                    } else {
                        // Oversized static: short quality ladder. Rare.
                        const input = path.join(runDir, `s_in_${i}.webp`);
                        fs.writeFileSync(input, raw);
                        finalBuffer = raw;
                        try {
                            for (const q of [85, 70, 55, 40]) {
                                const output = path.join(runDir, `s_out_${i}_q${q}.webp`);
                                try {
                                    finalBuffer = await encodeStatic(input, output, q);
                                } finally {
                                    try { fs.unlinkSync(output); } catch {}
                                }
                                if (finalBuffer.length <= STICKER_LIMIT) break;
                            }
                        } finally {
                            try { fs.unlinkSync(input); } catch {}
                        }
                        if (finalBuffer.length > STICKER_LIMIT) return null;
                    }

                    try {
                        finalBuffer = await addExif(
                            finalBuffer, brandPack, brandAuthor, ['🔥']
                        );
                    } catch {}

                    if (finalBuffer.length > STICKER_LIMIT) return null;

                    const outPath = path.join(runDir, `sticker_${i}.webp`);
                    fs.writeFileSync(outPath, finalBuffer);
                    return outPath;
                } catch {
                    return null;
                }
            });

            // pool preserves input order, so filtering keeps pack order intact.
            const stickerFiles = results.filter(Boolean);

            if (stickerFiles.length === 0) {
                throw new Error('Failed to process any stickers from this pack.');
            }

            const skipped = all.length - stickerFiles.length;

            await sock.sendMessage(chatId, {
                cover: { url: stickerFiles[0] },
                stickers: stickerFiles.map((p) => ({ data: { url: p } })),
                name: packName,
                publisher: 'CRYSNOVA',
                description: 'plogme ˗ˏˋ ☏ ˎˊ˗',
            });

            if (skipped > 0) {
                await safeReply(
                    `📦 Sent *${stickerFiles.length}* stickers ` +
                    `(${skipped} skipped — unsupported format or too large).`
                );
            }

            try {
                await sock.sendMessage(chatId, { react: { text: '🍃', key: m.key } });
            } catch (e) {}

        } catch (err) {
            try {
                await sock.sendMessage(chatId, { react: { text: '🕸️', key: m.key } });
            } catch (e) {}

            const isPackLimitErr = /exceeds the maximum limit of 60/i.test(err.message || '');
            if (!isPackLimitErr) {
                await safeReply(`⩇⩇:⩇⩇ *Error:* ${err.message}`);
            }
        } finally {
            try {
                fs.rmSync(runDir, { recursive: true, force: true });
            } catch (e) {}
        }
    },
};
