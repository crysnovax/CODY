const axios = require('axios');

module.exports = [{
    name: 'ttsen',
    alias: ['englishtts'],
    category: 'Tools',
    desc: 'Text to speech in English (for chatbot voice mode)',
    usage: `.ttsen <text>`,
    reactions: { start: '🇬🇧', success: '🎤' },
    
    execute: async (sock, m, { args, reply }) => {
        const text = args.join(' ').trim();
        if (!text) return reply('`×͜× Provide text to speak in English ×͜×`');
        
        try {
            await sock.sendMessage(m.chat, { 
                react: { text: '🇬🇧', key: m.key } 
            });
            
            const res = await axios.get(`https://apis.prexzyvilla.site/tts/tts-en?text=${encodeURIComponent(text)}`, {
                responseType: 'arraybuffer'
            });
            
            const buffer = Buffer.from(res.data);
            
            await sock.sendMessage(m.chat, {
                audio: buffer,
                ptt: true,
                mimetype: 'audio/mpeg'
            }, { quoted: m });
            
            await sock.sendMessage(m.chat, { 
                react: { text: '🎤', key: m.key } 
            });
            
        } catch (err) {
            console.error('[TTSEN]', err.message);
            reply('`×͜× English TTS failed ×͜×`');
        }
    }
}];
