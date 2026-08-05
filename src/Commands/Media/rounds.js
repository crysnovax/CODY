const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
// Pure-JS exif writer (node-webpmux) instead of wa-sticker-formatter -> sharp.
const { addExif } = require('../../../library/exif');

module.exports = {
    name: 'rounds',
    alias: ['rsticker','roundsticker'],
    category: 'Media',
    desc: 'Create a round/circle sticker from an image or video',
    usage: '.round (reply to image/video)',

    execute: async (sock, m, { reply , prefix}) => {
        const quoted = m.quoted || m;
        const mime = quoted.mimetype || '';

        if (!/image|video/.test(mime)) {
            return reply('⚉ Reply to an image or video');
        }

        try {
            const media = await quoted.download();

            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const input = path.join(tempDir, `round_${Date.now()}.mp4`);
            const output = path.join(tempDir, `round_out_${Date.now()}.webp`);

            fs.writeFileSync(input, media);

            let cmd;

            if (/video/.test(mime)) {
                const duration = (quoted.msg || quoted).seconds || 0;
                if (duration < 1 || duration > 8) {
                    fs.unlinkSync(input);
                    return reply('✘ Video must be 1-8 seconds');
                }
                // Circular mask for video sticker
                cmd = `ffmpeg -y -i "${input}" -t 8 -vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512,format=rgba,geq='r=r(X,Y):g=g(X,Y):b=b(X,Y):a=if(lt(sqrt((X-256)^2+(Y-256)^2),256),255,0)'" -c:v libwebp -lossless 0 -q:v 60 -loop 0 -an -preset default "${output}"`;
            } else {
                // Circular crop for image sticker
                cmd = `ffmpeg -y -i "${input}" -vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512,format=rgba,geq='r=r(X,Y):g=g(X,Y):b=b(X,Y):a=if(lt(sqrt((X-256)^2+(Y-256)^2),256),255,0)'" -c:v libwebp -lossless 0 -q:v 80 -an "${output}"`;
            }

            await new Promise((resolve, reject) => {
                exec(cmd, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            let buffer = fs.readFileSync(output);

            // Add metadata (pure-JS, no sharp)
            buffer = await addExif(buffer, 'CRYSNOVA AI', 'crysnovax', ['🔥']);

            if (buffer.length / 1024 > 500) {
                fs.unlinkSync(input);
                fs.unlinkSync(output);
                return reply('✘ Sticker too large, try a simpler image');
            }

            await sock.sendMessage(m.chat, { sticker: buffer }, { quoted: m });

            fs.unlinkSync(input);
            fs.unlinkSync(output);

        } catch (e) {
            console.error('[ROUND]', e);
            reply(`${prefix}✘ Failed: ${emessage}`);
        }
    }
};
