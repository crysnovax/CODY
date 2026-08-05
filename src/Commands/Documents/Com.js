const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

module.exports = {
    name: 'compress',
    alias: ['shrink', 'reduce', 'tiny'],
    category: 'Documents',
    desc: 'Compress an image or video to reduce size',
    usage: '.compress (reply to image/video)',

    execute: async (sock, m, { reply , prefix}) => {
        const quoted = m.quoted || m;
        const mime = quoted.mimetype || '';

        if (!/image|video/.test(mime)) return reply('⚉ Reply to an image or video');

        try {
            await sock.sendMessage(m.chat, { react: { text: '🗜️', key: m.key } });

            const media = await quoted.download();
            const originalSize = (media.length / 1024).toFixed(1);

            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const ext = /video/.test(mime) ? 'mp4' : 'jpg';
            const input = path.join(tempDir, `compress_${Date.now()}.${ext}`);
            const output = path.join(tempDir, `compressed_${Date.now()}.${ext}`);

            fs.writeFileSync(input, media);

            let cmd;
            if (/video/.test(mime)) {
                cmd = `ffmpeg -y -i "${input}" -c:v libx264 -crf 30 -preset fast -c:a aac -b:a 64k "${output}"`;
            } else {
                cmd = `ffmpeg -y -i "${input}" -q:v 15 "${output}"`;
            }

            await new Promise((resolve, reject) => {
                exec(cmd, (err) => { if (err) reject(err); else resolve(); });
            });

            const compressed = fs.readFileSync(output);
            const newSize = (compressed.length / 1024).toFixed(1);

            const caption = `🗜️ *Compressed!*\n📊 ${originalSize}KB → ${newSize}KB\n💾 Saved: ${(originalSize - newSize).toFixed(1)}KB`;

            if (/video/.test(mime)) {
                await sock.sendMessage(m.chat, { video: compressed, caption }, { quoted: m });
            } else {
                await sock.sendMessage(m.chat, { image: compressed, caption }, { quoted: m });
            }

            fs.unlinkSync(input);
            fs.unlinkSync(output);
            await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });

        } catch (e) {
            console.error('[COMPRESS]', e);
            reply(`${prefix}✘ Failed: ${emessage}`);
        }
    }
};
