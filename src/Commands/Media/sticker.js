const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
// Use the pure-JS exif writer (node-webpmux) instead of wa-sticker-formatter,
// which pulls in the native "sharp" module and crashes on hosts without a
// prebuilt sharp binary (e.g. bot-hosting.net linux-x64).
const { addExif } = require('../../../library/exif');
const { getVar } = require('../../Plugin/configManager');

module.exports = {
    name: 'sticker',
    alias: ['s', 'stick'],
    category: 'Media',

    execute: async (sock, m, { reply }) => {
        // Resolve PACK_NAME at execution time so setvar takes effect without restart
        const rawPack = getVar('PACK_NAME') || process.env.PACK_NAME || getVar('BOT_NAME') || process.env.BOT_NAME || 'crysnovax';
        const stickerPack = `⚉ • ${rawPack}`;
        const stickerAuthor = getVar('STICKER_AUTHOR') || process.env.STICKER_AUTHOR || getVar('PACK_NAME') || process.env.PACK_NAME || 'crysnovax';
        const quoted = m.quoted || m;
        const mime = quoted.mimetype || '';

        if (!/image|video/.test(mime)) {
            return reply('⚉ Reply to an image or video');
        }

        try {
            const media = await quoted.download();

            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const input = path.join(tempDir, `stk_${Date.now()}`);
            const output = input + '.webp';

            fs.writeFileSync(input, media);

            // ================= VIDEO STICKER =================
            if (/video/.test(mime)) {
                const duration = (quoted.msg || quoted).seconds || 0;
                
                // Remove the 5-second limit check
                // Just use the actual duration
                const durationSec = Math.min(duration || 5, 10);

                // Helper to run ffmpeg with given settings
                const compressVideo = async (fps, quality, durationSec) => {
                    const cmd = `ffmpeg -y -i "${input}" -t ${durationSec} -vf "fps=${fps},scale=512:512:force_original_aspect_ratio=increase,crop=512:512:(iw-ow)/2:(ih-oh)/2,format=yuva420p" -c:v libwebp -lossless 0 -q:v ${quality} -loop 0 -an -preset default -compression_level 6 "${output}"`;
                    
                    await new Promise((resolve, reject) => {
                        exec(cmd, (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });

                    const sizeKB = fs.statSync(output).size / 1024;
                    return sizeKB;
                };

                let sizeKB = await compressVideo(12, 70, durationSec);

                // If too large, try lower fps and quality
                if (sizeKB > 500) {
                    sizeKB = await compressVideo(8, 40, durationSec);
                }

                // If still too large, try even lower
                if (sizeKB > 500) {
                    sizeKB = await compressVideo(6, 30, durationSec);
                }

                // Final check – if still too large, abort
                if (sizeKB > 500) {
                    fs.unlinkSync(input);
                    fs.unlinkSync(output);
                    return reply('✘ Video too complex to fit WhatsApp sticker limit. Try a shorter/simpler clip.');
                }
            }
            // ================= IMAGE STICKER =================
            else {
                const imageCmd = `ffmpeg -y -i "${input}" -vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512:(iw-ow)/2:(ih-oh)/2,format=yuva420p" -c:v libwebp -lossless 0 -q:v 80 -an "${output}"`;
                await new Promise((resolve, reject) => {
                    exec(imageCmd, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }

            // Read the generated WebP
            let buffer = fs.readFileSync(output);

            // Add sticker metadata (pack/author) — uses live PACK_NAME from getVar
            buffer = await addExif(buffer, stickerPack, stickerAuthor, ['🔥']);

            // Send the sticker
            await sock.sendMessage(m.chat, { sticker: buffer }, { quoted: m });

            // Cleanup temporary files
            fs.unlinkSync(input);
            if (fs.existsSync(output)) fs.unlinkSync(output);

        } catch (e) {
            console.error(e);
            reply(`✘ Failed to create sticker: ${e.message}`);
        }
    }
};
