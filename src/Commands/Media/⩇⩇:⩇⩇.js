const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
// Pure-JS exif writer (node-webpmux) instead of wa-sticker-formatter -> sharp.
const { addExif } = require('../../../library/exif');
const { getStickerBranding } = require('../../Plugin/packname');

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
            const quotedText = m.quoted.text;
            const match = quotedText.match(/https?:\/\/t\.me\/addstickers\/[^\s]+/i);
            if (match) {
                link = match[0];
            }
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
        // PACK_NAME branding — ⚉ • <PACK_NAME>, author from STICKER_AUTHOR (@crysnovax—FIX09-08-26)
        const { pack: brandPack, author: brandAuthor } = getStickerBranding();

        const botToken = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
        if (!botToken) return safeReply('✘ Telegram sticker support is not configured on this deployment.');

        // Local temp dir for this run's processed .webp files, since the pack
        // API takes file urls, not buffers.
        const tempDir = path.join(__dirname, '../../temp');
        const runDir = path.join(tempDir, `tgpack_${Date.now()}`);

        try {
            const res = await fetch(
                `https://api.telegram.org/bot${botToken}/getStickerSet?name=${packName}`
            );
            const data = await res.json();

            if (!data.ok) {
                throw new Error(data.description || 'Invalid sticker pack');
            }

            const stickers = data.result.stickers.slice(0, 60);

            if (stickers.length === 0) {
                throw new Error('Sticker pack is empty');
            }

            if (!fs.existsSync(runDir)) {
                fs.mkdirSync(runDir, { recursive: true });
            }

            const stickerFiles = [];
            let count = 0;

            for (const sticker of stickers) {
                try {
                    const fileRes = await fetch(
                        `https://api.telegram.org/bot${botToken}/getFile?file_id=${sticker.file_id}`
                    );
                    const fileData = await fileRes.json();

                    if (!fileData.ok) continue;

                    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
                    const imgRes = await fetch(fileUrl);
                    if (!imgRes.ok) continue;

                    let buffer = Buffer.from(await imgRes.arrayBuffer());
                    const isVideo = sticker.is_video || false;
                    let finalBuffer = buffer;

                    if (isVideo) {
                        try {
                            const timestamp = Date.now();
                            const input = path.join(runDir, `src_${timestamp}_${count}.webm`);
                            const output = path.join(runDir, `out_${timestamp}_${count}.webp`);

                            fs.writeFileSync(input, buffer);

                            const cmd = `ffmpeg -y -i "${input}" -vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512:(iw-ow)/2:(ih-oh)/2,format=yuva420p,fps=15" -c:v libwebp -lossless 0 -q:v 70 -loop 0 -an -preset default -compression_level 6 "${output}"`;

                            await new Promise((resolve, reject) => {
                                exec(cmd, (err) => {
                                    if (err) reject(err);
                                    else resolve();
                                });
                            });

                            finalBuffer = fs.readFileSync(output);

                            try {
                                fs.unlinkSync(input);
                            } catch (e) {}

                        } catch (ffmpegErr) {
                            finalBuffer = buffer;
                        }
                    }

                    try {
                        finalBuffer = await addExif(finalBuffer, brandPack, brandAuthor, ['🔥']);
                    } catch (stickerErr) {}

                    // Write processed sticker to disk so it can be referenced by
                    // file url in the pack payload below.
                    const outPath = path.join(runDir, `sticker_${count}.webp`);
                    fs.writeFileSync(outPath, finalBuffer);
                    stickerFiles.push(outPath);
                    count++;

                } catch (err) {}
            }

            if (count === 0) {
                throw new Error('Failed to process any stickers from this pack.');
            }

            await sock.sendMessage(chatId, {
                cover: { url: stickerFiles[0] },
                stickers: stickerFiles.map(p => ({ data: { url: p } })),
                name: packName,
                publisher: 'CRYSNOVA',
                description: '@crysnovax/baileys ˗ˏˋ ☏ ˎˊ˗'
            });

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
    }
};
