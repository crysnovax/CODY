const { downloadContentFromMessage } = require('plogme');
// Pure-JS exif writer (node-webpmux) instead of wa-sticker-formatter -> sharp.
const { addExif } = require('../../../library/exif');
const { getPackName } = require('../../Plugin/packname');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'stickerpk',
    alias: ['stpk', 'setpack', 'pk'],
    category: 'tools',
    desc: 'Steal sticker with CRYSNOVA AI pack and custom author name',
    usage: `${prefix}pk <author name> (reply to a sticker)`,

    execute: async (sock, m, { args, reply }) => {
        try {
            const author = args.join(' ').trim();
            if (!author) {
                return reply('_*⚉ Usage: .pk <author name> (reply to a sticker)*_');
            }

            const quoted = m.quoted ? m.quoted : m;
            const mime = (quoted.msg || quoted).mimetype || '';
            if (!/webp/.test(mime)) {
                return reply('_*⚉ Reply to a sticker.*_');
            }

            await sock.sendMessage(m.chat, { react: { text: '🥏', key: m.key } });

            // Download original sticker buffer
            const stream = await downloadContentFromMessage(quoted.msg || quoted, 'sticker');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            const originalSizeKB = buffer.length / 1024;

            // Detect if it's animated (WebP animation)
            const isAnimated = buffer.toString('hex', 0, 16).includes('414e494d'); // "ANIM" header in WebP

            let finalBuffer = buffer;
            let quality = 80; // start high

            // Helper to apply metadata (pure-JS, no sharp) — pack forced to ⚉ • <PACK_NAME> when set (@crysnovax—FIX06-08-26)
            const reencodeWithQuality = async () => {
                return await addExif(buffer, getPackName(), author, ['🔥']);
            };

            // If original is already under 500 KB, just apply metadata with high quality
            if (originalSizeKB <= 500) {
                finalBuffer = await reencodeWithQuality(80);
            } else {
                // Original too big – need compression
                // Try decreasing quality until it fits
                const qualities = [70, 60, 50, 40, 30];
                for (const q of qualities) {
                    finalBuffer = await reencodeWithQuality(q);
                    if (finalBuffer.length / 1024 <= 500) {
                        break;
                    }
                }

                // If still too big, use ffmpeg as last resort for animated stickers
                if (finalBuffer.length / 1024 > 500 && isAnimated) {
                    const tempDir = path.join(__dirname, '../../temp');
                    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

                    const inputPath = path.join(tempDir, `steal_${Date.now()}.webp`);
                    const outputPath = path.join(tempDir, `steal_out_${Date.now()}.webp`);

                    fs.writeFileSync(inputPath, buffer);

                    // Aggressive ffmpeg compression
                    const cmd = `ffmpeg -y -i "${inputPath}" -vf "fps=8,scale=512:512:force_original_aspect_ratio=increase,crop=512:512:(iw-ow)/2:(ih-oh)/2,format=yuva420p" -c:v libwebp -lossless 0 -q:v 30 -loop 0 -an -preset default -compression_level 6 "${outputPath}"`;

                    await new Promise((resolve, reject) => {
                        exec(cmd, (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });

                    finalBuffer = fs.readFileSync(outputPath);

                    // Cleanup
                    fs.unlinkSync(inputPath);
                    fs.unlinkSync(outputPath);

                    // Now apply metadata
                    if (finalBuffer.length / 1024 <= 500) {
                        finalBuffer = await addExif(finalBuffer, getPackName(), author, ['🔥']);
                    }
                }

                // Final check
                if (finalBuffer.length / 1024 > 500) {
                    await sock.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
                    return reply('_*✘ Sticker too complex to fit WhatsApp limit even after compression.*_');
                }
            }

            await sock.sendMessage(m.chat, { sticker: finalBuffer }, { quoted: m });
            await sock.sendMessage(m.chat, { react: { text: '😎', key: m.key } });

        } catch (err) {
            console.error('PK ERROR:', err);
            reply('_*✘ Failed to take sticker.*_');
        }
    }
};
