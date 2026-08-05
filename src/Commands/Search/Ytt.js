const axios = require('axios');

module.exports = [{
    name: 'ytranscript',
    alias: ['yttext','yttranscript'],
    category: 'Tools',
    desc: 'Get transcript/subtitles from YouTube video',
    usage: `.ytranscript <youtube url>`,
    reactions: { start: '📜', success: '💬' },
    
    execute: async (sock, m, { args, reply }) => {
        const url = args[0]?.trim();
        if (!url) return reply('`×͜× Provide a YouTube URL ×͜×`');
        
        try {
            await sock.sendMessage(m.chat, { 
                react: { text: '📜', key: m.key } 
            });
            
            const res = await axios.get(`https://apis.prexzyvilla.site/tools/youtube-transcript?url=${encodeURIComponent(url)}`);
            const transcript = res.data?.transcript || res.data?.data || res.data || '';
            
            if (!transcript || (Array.isArray(transcript) && transcript.length === 0)) {
                return reply('`×͜× No transcript found for this video ×͜×`');
            }
            
            let text;
            if (Array.isArray(transcript)) {
                text = transcript.map(t => t.text || t).join(' ');
            } else {
                text = typeof transcript === 'string' ? transcript : JSON.stringify(transcript);
            }
            
            // Send in chunks if too long
            if (text.length > 4000) {
                const chunks = text.match(/.{1,4000}/g);
                for (const chunk of chunks) {
                    await sock.sendMessage(m.chat, { text: chunk }, { quoted: m });
                    await new Promise(r => setTimeout(r, 300));
                }
            } else {
                await sock.sendMessage(m.chat, { 
                    text: `📜 *YOUTUBE TRANSCRIPT*\n\n${text}`
                }, { quoted: m });
            }
            
            await sock.sendMessage(m.chat, { 
                react: { text: '💬', key: m.key } 
            });
            
        } catch (err) {
            console.error('[YTRANSCRIPT]', err.message);
            reply('`×͜× Transcript fetch failed ×͜×`');
        }
    }
}];
