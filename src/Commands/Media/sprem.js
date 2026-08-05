const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
// Pure-JS exif writer (node-webpmux) instead of wa-sticker-formatter -> sharp.
const { addExif } = require('../../../library/exif');

module.exports = {
    name: 'sprem',
    alias: ['stickerprem', 'spremium'],
    category: 'Media',

    execute: async (sock, m, { reply , prefix}) => {
        const quoted = m.quoted || m;
        const mime = quoted.mimetype || '';

        if (!/image|video|webp/.test(mime)) {
            return reply('⚉ Reply to an image, video or sticker');
        }

        try {
            const media = await quoted.download();

            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const input = path.join(tempDir, `sprem_${Date.now()}`);
            const output = input + '.webp';

            fs.writeFileSync(input, media);

            // ================= STICKER (webp) =================
            if (/webp/.test(mime)) {
                // Already a webp — just pass through as-is
                fs.copyFileSync(input, output);
            }
            // ================= VIDEO STICKER =================
            else if (/video/.test(mime)) {
                const cmd = `ffmpeg -y -i "${input}" -vf "fps=15,scale=512:512:force_original_aspect_ratio=increase,crop=512:512:(iw-ow)/2:(ih-oh)/2,format=yuva420p" -c:v libwebp -lossless 0 -q:v 70 -loop 0 -an -preset default -compression_level 6 "${output}"`;
                await new Promise((resolve, reject) => {
                    exec(cmd, (err) => err ? reject(err) : resolve());
                });
            }
            // ================= IMAGE STICKER =================
            else {
                const imageCmd = `ffmpeg -y -i "${input}" -vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512:(iw-ow)/2:(ih-oh)/2,format=yuva420p" -c:v libwebp -lossless 0 -q:v 80 -an "${output}"`;
                await new Promise((resolve, reject) => {
                    exec(imageCmd, (err) => err ? reject(err) : resolve());
                });
            }

            // Read the generated WebP
            let buffer = fs.readFileSync(output);

            // Add metadata (pure-JS, no sharp)
            buffer = await addExif(buffer, 'CRYSNOVA AI', 'crysnovax', ['🔥']);

            // Send as premium sticker — shows 💎 badge
            await sock.sendMessage(m.chat, {
                sticker: buffer,
                premium: 1
            }, { quoted: m });

            // Cleanup
            fs.unlinkSync(input);
            if (fs.existsSync(output)) fs.unlinkSync(output);

        } catch (e) {
            console.error(e);
            reply(`${prefix}✘ Failed: ${emessage}`);
        }
    }
};
