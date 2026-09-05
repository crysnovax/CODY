const { downloadContentFromMessage, makeWASocket, generateWAMessageFromContent } = require('plogme');
const { spawn } = require('child_process');

module.exports = {
    name: "tovn",
    alias: ["tovoice", "mediavoice", "voice"],
    category: "tools",
    desc: "Convert any audio/video to a voice note",
    reactions: {
        start: '🔊',
        success: '🎵'
    },

    execute: async (sock, m, { reply }) => {
        try {
            // 1. Check for quoted media
            const quoted = m.quoted ? m.quoted : m;
            const mime = (quoted.msg || quoted).mimetype || '';

            if (!/audio|video/.test(mime)) {
                return reply("_*⚉ please reply to a media file (audio/video) to convert.*_");
            }

            await sock.sendMessage(m.chat, { react: { text: "⏰", key: m.key } });

            // 2. Download media
            const stream = await downloadContentFromMessage(quoted.msg || quoted, mime.startsWith('video') ? 'video' : 'audio');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            // 3. Convert media to voice note (ogg/opus) using ffmpeg
            const ffmpeg = spawn('ffmpeg', [
                '-i', 'pipe:0',
                '-vn',
                '-c:a', 'libopus',
                '-b:a', '64k',
                '-vbr', 'on',
                '-f', 'ogg',
                'pipe:1'
            ]);

            ffmpeg.stdin.write(buffer);
            ffmpeg.stdin.end();

            let voBuffer = Buffer.from([]);
            ffmpeg.stdout.on('data', chunk => voBuffer = Buffer.concat([voBuffer, chunk]));

            const ffErr = [];
            ffmpeg.stderr.on('data', d => ffErr.push(d.toString()));

            ffmpeg.on('close', async code => {
                if (code !== 0 || !voBuffer.length) {
                    console.error('FFMPEG ERROR:', ffErr.join(''));
                    return reply("_*𓄄 Failed to convert media to voice note.*_");
                }

                // 4. Send as voice note
                await sock.sendMessage(m.chat, { audio: voBuffer, ptt: true }, { quoted: m });
                await sock.sendMessage(m.chat, { react: { text: "🎵", key: m.key } });
            });

        } catch (err) {
            console.error('TOVN ERROR:', err);
            reply(" _*✘ Failed to convert media to voice note.*_");
        }
    }
};
