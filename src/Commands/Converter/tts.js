const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { promisify } = require('util');
const execPromise = promisify(exec);

module.exports = {
    name: 'tts',
    alias: ['say', 'speak', 'voice'],
    category: 'WhatsApp',

    execute: async (sock, m, { reply, args, quoted , prefix}) => {
        let text = args.join(' ') || quoted?.text;
        if (!text) {
            return reply(`${prefix}⚉ Provide text to convert to speech

Examples:
tts Hello world
.tts en Hello world
.tts (reply to message)

Supported languages: en, es, fr, de, id, ja, ko, ar, pt, ru, hi, zh`);
        }

        // Language detection (first arg if two letters)
        let lang = 'en';
        const possibleLang = args[0]?.toLowerCase();
        if (possibleLang && /^[a-z]{2}$/.test(possibleLang)) {
            lang = possibleLang;
            args.shift();
            text = args.join(' ') || quoted?.text;
        }

        const finalText = text.trim();
        if (finalText.length > 500) {
            return reply('✘ Text too long (max 500 chars)');
        }

        const tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const mp3Path = path.join(tempDir, `tts_${Date.now()}.mp3`);
        const oggPath = path.join(tempDir, `tts_${Date.now()}.ogg`);

        try {
            await reply('🎙️ Generating speech...');

            // 1. Download TTS audio (Google Translate TTS)
            const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(finalText)}&tl=${lang}&client=tw-ob`;
            const response = await axios.get(ttsUrl, {
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 30000
            });
            fs.writeFileSync(mp3Path, Buffer.from(response.data));

            // 2. Convert to WhatsApp voice note format (Opus in OGG)
            let usePtt = true;
            try {
                await execPromise(
                    `ffmpeg -i "${mp3Path}" -c:a libopus -b:a 16k -ac 1 -ar 16000 -vbr off -application voip "${oggPath}"`,
                    { timeout: 15000 }
                );
                // Use converted OGG file
                fs.unlinkSync(mp3Path);
            } catch (ffmpegErr) {
                console.warn('[TTS] FFmpeg not available, sending as MP3 audio');
                usePtt = false;
                // Keep mp3Path
            }

            // 3. Send to WhatsApp
            if (usePtt && fs.existsSync(oggPath)) {
                await sock.sendMessage(m.chat, {
                    audio: fs.readFileSync(oggPath),
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt: true
                }, { quoted: m });
                fs.unlinkSync(oggPath);
            } else {
                // Fallback: send as regular audio file
                await sock.sendMessage(m.chat, {
                    audio: fs.readFileSync(mp3Path),
                    mimetype: 'audio/mpeg',
                    fileName: `tts_${lang}.mp3`
                }, { quoted: m });
                fs.unlinkSync(mp3Path);
            }

        } catch (error) {
            console.error('[TTS] Error:', error);
            reply('✘ Failed to generate speech. Please try again later.');
        } finally {
            // Cleanup any leftover files
            [mp3Path, oggPath].forEach(p => {
                if (fs.existsSync(p)) fs.unlinkSync(p);
            });
        }
    }
};
