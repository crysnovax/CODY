const axios = require('axios');

module.exports = [{
    name: 'ttsfr',
    alias: ['frenchtts', 'speakfr'],
    category: 'Tools',
    desc: 'Text to speech in French',
    usage: `.ttsfr <text>`,
    reactions: { start: '🇫🇷', success: '🎤' },
    
    execute: async (sock, m, { args, reply }) => {
        const text = args.join(' ').trim();
        if (!text) return reply('`×͜× Provide text to speak in French ×͜×`');
        
        try {
            await sock.sendMessage(m.chat, { 
                react: { text: '🇫🇷', key: m.key } 
            });
            
            const res = await axios.get(`https://apis.prexzyvilla.site/tts/tts-fr?text=${encodeURIComponent(text)}`, {
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
            console.error('[TTSFR]', err.message);
            reply('`×͜× French TTS failed ×͜×`');
        }
    }
}];
