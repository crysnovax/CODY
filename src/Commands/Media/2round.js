const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { downloadContentFromMessage } = require('@crysnovax/baileys');
// Pure-JS exif writer (node-webpmux) instead of wa-sticker-formatter -> sharp.
const { addExif } = require('../../../library/exif');

module.exports = {
    name: 'toround',
    alias: ['2round', 'makeround', 'tround'],
    category: 'Media',
    desc: 'Convert video/sticker to a large round sticker (10s limit)',
    usage: `.toround (reply to video or sticker)`,

    execute: async (sock, m, { reply }) => {
        const quoted = m.quoted || m;
        const mime = (quoted.msg || quoted).mimetype || '';

        if (!/video|webp/.test(mime)) {
            return reply('⚉ Reply to a video or sticker');
        }

        try {
            await sock.sendMessage(m.chat, { react: { text: '🔄', key: m.key } });

            let buffer;
            
            if (/webp/.test(mime)) {
                // Download sticker
                const stream = await downloadContentFromMessage(quoted.msg || quoted, 'sticker');
                buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }
            } else {
                // Download video
                buffer = await quoted.download();
            }

            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const input = path.join(tempDir, `toround_${Date.now()}.mp4`);
            const output = path.join(tempDir, `toround_out_${Date.now()}.webp`);

            fs.writeFileSync(input, buffer);

            const isVideo = /video/.test(mime);
            const isAnimated = !isVideo && buffer.toString('hex', 0, 16).includes('414e494d');
            const shouldAnimate = isVideo || isAnimated;

            let cmd;

            if (shouldAnimate) {
                // Video or animated sticker → animated round sticker
                const duration = isVideo ? ((quoted.msg || quoted).seconds || 0) : 10;
                const maxDuration = Math.min(duration, 10);
                
                if (maxDuration < 1) {
                    fs.unlinkSync(input);
                    return reply('✘ Video must be at least 1 second');
                }

                cmd = `ffmpeg -y -i "${input}" -t ${maxDuration} -vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512,format=rgba,geq='r=r(X,Y):g=g(X,Y):b=b(X,Y):a=if(lt(sqrt((X-256)^2+(Y-256)^2),256),255,0)'" -c:v libwebp -lossless 0 -q:v 60 -loop 0 -an -preset default "${output}"`;
            } else {
                // Static sticker → static round sticker
                cmd = `ffmpeg -y -i "${input}" -vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512,format=rgba,geq='r=r(X,Y):g=g(X,Y):b=b(X,Y):a=if(lt(sqrt((X-256)^2+(Y-256)^2),256),255,0)'" -c:v libwebp -lossless 0 -q:v 80 -an "${output}"`;
            }

            await new Promise((resolve, reject) => {
                exec(cmd, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            let finalBuffer = fs.readFileSync(output);

            // Add metadata (pure-JS, no sharp)
            finalBuffer = await addExif(finalBuffer, 'CRYSNOVA AI', 'crysnovax', ['🔥']);

            if (finalBuffer.length / 1024 > 500) {
                fs.unlinkSync(input);
                fs.unlinkSync(output);
                return reply('✘ Sticker too large, try shorter video');
            }

            await sock.sendMessage(m.chat, { sticker: finalBuffer }, { quoted: m });

            fs.unlinkSync(input);
            fs.unlinkSync(output);
            await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });

        } catch (e) {
            console.error('[TOROUND]', e);
            reply(`${prefix}✘ Failed: ${emessage}`);
        }
    }
};
