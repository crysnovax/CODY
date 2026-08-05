const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

module.exports = {
    name: 'docconvert',
    alias: ['doconv', 'fileconv'],
    category: 'Documents',
    desc: 'Convert between file formats',
    usage: '.convert <to_format> (reply to file)\nFormats: png, jpg, webp, mp4, mp3, pdf, gif',

    execute: async (sock, m, { args, reply , prefix}) => {
        const format = args[0]?.toLowerCase();
        if (!format) return reply('⚉ Usage: .convert png (reply to image)\nFormats: png, jpg, webp, mp4, mp3, pdf, gif');

        const validFormats = ['png', 'jpg', 'jpeg', 'webp', 'mp4', 'mp3', 'gif', 'pdf'];
        if (!validFormats.includes(format)) {
            return reply(`${prefix}_*⚉ Invalid format Use: ${validFormats.join(', ')}*_`);
        }

        const quoted = m.quoted || m;
        if (!quoted.mimetype) return reply('⚉ Reply to a file to convert');

        try {
            await sock.sendMessage(m.chat, { react: { text: '🔄', key: m.key } });

            const media = await quoted.download();
            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const input = path.join(tempDir, `conv_in_${Date.now()}`);
            const output = path.join(tempDir, `conv_out_${Date.now()}.${format}`);

            fs.writeFileSync(input, media);

            const cmd = `ffmpeg -y -i "${input}" "${output}"`;

            await new Promise((resolve, reject) => {
                exec(cmd, (err) => { if (err) reject(err); else resolve(); });
            });

            const converted = fs.readFileSync(output);
            const mimeMap = {
                png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
                webp: 'image/webp', mp4: 'video/mp4', mp3: 'audio/mpeg',
                gif: 'video/mp4', pdf: 'application/pdf'
            };

            const type = format === 'gif' ? 'video' : 
                         format === 'mp3' ? 'audio' :
                         format === 'mp4' ? 'video' : 'document';

            if (type === 'document') {
                await sock.sendMessage(m.chat, {
                    document: converted,
                    fileName: `converted.${format}`,
                    mimetype: mimeMap[format],
                    caption: `& Converted to .${format}`
                }, { quoted: m });
            } else {
                await sock.sendMessage(m.chat, {
                    [type]: converted,
                    mimetype: mimeMap[format],
                    caption: `& Converted to .${format}`
                }, { quoted: m });
            }

            fs.unlinkSync(input);
            fs.unlinkSync(output);
            await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } });

        } catch (e) {
            console.error('[CONVERT]', e);
            reply(`${prefix}✘ Conversion failed: ${emessage}`);
        }
    }
};
