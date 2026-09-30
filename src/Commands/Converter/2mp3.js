// 2mp3.js — reply to a VIDEO and get its audio as a clean .mp3 file.
// The mp3 is sent as a standalone audio message with NO caption so it can
// be shared directly. (@crysnovax—FIX14-08-26)
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const TEMP_DIR = path.join(__dirname, '../../../temp');

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function cleanUp(...files) {
    for (const f of files) {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    }
}

module.exports = {
    name: '2mp3',
    alias: ['mp3', 'tomp3', 'tompeg', 'vtoa', 'v2mp3', 'video2mp3'],
    desc: 'Convert a replied video to MP3 audio (sent alone, no caption)',
    category: 'Converter',
    usage: '.2mp3 (reply to a video)',
    reactions: { start: '🎬', success: '🎧', error: '🙅' },

    execute: async (sock, m, { reply }) => {
        await sock.sendMessage(m.chat, { react: { text: '🎬', key: m.key } });

        if (!m.quoted || !['videoMessage', 'documentMessage'].includes(m.quoted.mtype)) {
            await sock.sendMessage(m.chat, { react: { text: '🙅', key: m.key } });
            return reply('`✘ Reply to a video file to convert it to MP3.`\n_Reply to the video, then send !mp3 or !tomp3_');
        }

        const ts = Date.now();
        const inPath = path.join(TEMP_DIR, `v2mp3_${ts}.mp4`);
        const outPath = path.join(TEMP_DIR, `v2mp3_${ts}.mp3`);

        try {
            const buffer = await m.quoted.download();
            if (!buffer || !buffer.length) return reply('`✘ Failed to download the video`');
            fs.writeFileSync(inPath, buffer);

            await new Promise((resolve, reject) => {
                exec(
                    `"${ffmpegPath}" -y -i "${inPath}" -vn -acodec libmp3lame -q:a 4 "${outPath}"`,
                    (err) => (err ? reject(err) : resolve())
                );
            });

            const mp3 = fs.readFileSync(outPath);
            await sock.sendMessage(
                m.chat,
                {
                    audio: mp3,
                    mimetype: 'audio/mpeg',
                    ptt: false,
                    fileName: `audio_${ts}.mp3`
                    // NO caption on purpose — clean mp3 for sharing
                },
                { quoted: m }
            );

            cleanUp(inPath, outPath);
            await sock.sendMessage(m.chat, { react: { text: '🎧', key: m.key } });
          //  return reply('`✓ Mp3 sent` — clean audio, no caption 🎧');
        } catch (err) {
            console.error('[2MP3 ERROR]', err.message);
            cleanUp(inPath, outPath);
            await sock.sendMessage(m.chat, { react: { text: '🙅', key: m.key } });
            return reply('`✘ Conversion failed: ' + (err.message || 'unknown error') + '`');
        }
    }
};
