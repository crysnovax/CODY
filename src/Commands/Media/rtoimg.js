const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { downloadContentFromMessage } = require('@crysnovax/baileys');

module.exports = {
    name: 'rtoimg',
    alias: ['rtoimage', 'rtovideo', 'rtovid', 'r2img'],
    category: 'Media',
    desc: 'Convert a round sticker back to image or video',
    usage: `.rtoimg (reply to a round sticker)`,

    execute: async (sock, m, { reply }) => {
        const quoted = m.quoted || m;
        const mime = (quoted.msg || quoted).mimetype || '';

        if (!/webp/.test(mime)) {
            return reply('⚉ Reply to a round sticker');
        }

        try {
            await sock.sendMessage(m.chat, { react: { text: '🔄', key: m.key } });

            const stream = await downloadContentFromMessage(quoted.msg || quoted, 'sticker');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            const isAnimated = buffer.toString('hex', 0, 16).includes('414e494d');

            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const input = path.join(tempDir, `rtoimg_${Date.now()}.webp`);
            fs.writeFileSync(input, buffer);

            if (isAnimated) {
                // Animated round sticker → MP4 video
                const output = path.join(tempDir, `rtoimg_${Date.now()}.mp4`);
                
                const cmd = `ffmpeg -y -i "${input}" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 23 -vf "format=yuv420p" "${output}"`;

                await new Promise((resolve, reject) => {
                    exec(cmd, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                const videoBuffer = fs.readFileSync(output);
                
                await sock.sendMessage(m.chat, {
                    video: videoBuffer,
                 //   caption: '✅ Round Sticker → Video',
                    gifPlayback: false
                }, { quoted: m });

                fs.unlinkSync(output);
            } else {
                // Static round sticker → PNG (keeps transparency)
                const output = path.join(tempDir, `rtoimg_${Date.now()}.png`);
                
                const cmd = `ffmpeg -y -i "${input}" "${output}"`;

                await new Promise((resolve, reject) => {
                    exec(cmd, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                const imageBuffer = fs.readFileSync(output);
                
                await sock.sendMessage(m.chat, {
                    image: imageBuffer,
                  //  caption: ' Round Sticker → Image'
                }, { quoted: m });

                fs.unlinkSync(output);
            }

            fs.unlinkSync(input);
            await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });

        } catch (e) {
            console.error('[RTOIMG]', e);
            reply(`${prefix}✘ Failed: ${emessage}`);
        }
    }
};
