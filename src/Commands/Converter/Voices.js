module.exports = {
    name: 'ttsm',
    alias: ['voice'],
    desc: 'Text to speech with voice selection',
    category: 'AI',

    execute: async (sock, m, { args, reply , prefix}) => {
        try {
            if (args.length < 2) {
                return reply(`${prefix}🎙️ Usage:
ttsm <voice_number> <text>
.ttsm 13 Hello world

⚠️ Audio files expire quickly!`);
            }

            const voiceNum = parseInt(args[0]);
            if (isNaN(voiceNum) || voiceNum < 1 || voiceNum > 30) {
                return reply('_*⚉ Use voice number 1-30*_');
            }

            const text = args.slice(1).join(' ').trim();
            if (!text) return reply('_*𓄄 Give text to speak*_');
            if (text.length > 999999) return reply('_*⚉ Max 200 chars (tmp files expire fast)*_');

            await sock.sendPresenceUpdate('recording', m.chat);

            const voiceEndpoints = {
                1: 'tts-adult-female--1-american-english-truvoice',
                2: 'tts-adult-female--2-american-english-truvoice',
                3: 'tts-adult-male--1-american-english-truvoice',
                4: 'tts-adult-male--2-american-english-truvoice',
                5: 'tts-adult-male--3-american-english-truvoice',
                6: 'tts-adult-male--4-american-english-truvoice',
                7: 'tts-adult-male--5-american-english-truvoice',
                8: 'tts-adult-male--6-american-english-truvoice',
                9: 'tts-adult-male--7-american-english-truvoice',
                10: 'tts-adult-male--8-american-english-truvoice',
                11: 'tts-female-whisper',
                12: 'tts-male-whisper',
                13: 'tts-mary',
                14: 'tts-mary--for-telephone-',
                15: 'tts-mary-in-hall',
                16: 'tts-mary-in-space',
                17: 'tts-mary-in-stadium',
                18: 'tts-mike',
                19: 'tts-mike--for-telephone-',
                20: 'tts-mike-in-hall',
                21: 'tts-mike-in-space',
                22: 'tts-mike-in-stadium',
                23: 'tts-robo-soft-five',
                24: 'tts-robo-soft-four',
                25: 'tts-robo-soft-one',
                26: 'tts-robo-soft-six',
                27: 'tts-robo-soft-three',
                28: 'tts-robo-soft-two',
                29: 'tts-sam',
                30: 'tts-bonzi'
            };

            const endpoint = voiceEndpoints[voiceNum];
            const apiUrl = `https://apis.prexzyvilla.site/tts/${endpoint}?text=${encodeURIComponent(text)}`;

            console.log('[TTS] Requesting:', apiUrl);

            // Get JSON with audio URL
            const res = await fetch(apiUrl);
            if (!res.ok) return reply(`${prefix}_*⚉ Voice API failed: ${resstatus}*_`);

            const json = await res.json();
            console.log('[TTS] Response:', JSON.stringify(json));

            const audioUrl = json.audio_url?.result || json.audio_url?.url || json.audio_url;
            
            if (!audioUrl || typeof audioUrl !== 'string') {
                console.log('[TTS] No valid URL found');
                return reply('_*⚉ No audio URL in response*_');
            }

            console.log('[TTS] Audio URL:', audioUrl);

            // Fetch audio with headers
            const audioRes = await fetch(audioUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'audio/wav,audio/*,*/*'
                }
            });

            console.log('[TTS] Audio status:', audioRes.status);

            if (!audioRes.ok) {
                return reply(`${prefix}_*⚉ Cannot fetch audio: ${audioResstatus}*_\n☬ Tmpfiles URL expired or blocked`);
            }

            const buffer = Buffer.from(await audioRes.arrayBuffer());
            console.log('[TTS] Buffer size:', buffer.length);

            if (buffer.length < 1000) {
                return reply('_*⚉ Audio file too small/empty*_');
            }

            // Send as document first to test
            await sock.sendMessage(m.chat, {
                document: buffer,
                mimetype: 'audio/wav',
                fileName: `tts-${voiceNum}.CRYSN⚉VA`,
                caption: `🎙️ TTS Voice ${voiceNum}`
            }, { quoted: m });

        } catch (err) {
            console.error('[TTS ERROR]', err);
            reply('_*✘ TTS failed*_');
        }
    }
};

