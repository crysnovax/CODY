const fetch = require('node-fetch');

module.exports = {
    name: 'yturld',
    alias: [],
    desc: 'Download YouTube audio as MP3',
    category: 'Download',
     // ⭐ Reaction config
    reactions: {
        start: '🔍',
        success: '🎤'
    },


    execute: async (sock, m, { args, reply, quoted , prefix}) => {
        try {
            // Get URL from args or quoted message
            let url = args[0] || m.quoted?.text;
            if (!url) return reply('✘ Provide a YouTube URL');

            await sock.sendPresenceUpdate('composing', m.chat);

            const apiUrl = `https://apis.prexzyvilla.site/download/ytaudio?url=${encodeURIComponent(url)}`;

            // Fetch audio info
            const res = await fetch(apiUrl);
            if (!res.ok) return reply(`${prefix}⚉ API failed: ${resstatus}`);
            const data = await res.json();

            if (!data.download || !data.title) return reply('𓉤 Failed to get audio');

            const audioUrl = data.download; // MP3 URL
            const title = data.title.replace(/[^\w\s]/gi, '') || 'youtube_audio';

            // Fetch actual MP3
            const mp3Res = await fetch(audioUrl);
            if (!mp3Res.ok) return reply('✘ Failed to download MP3');
            const buffer = Buffer.from(await mp3Res.arrayBuffer());

            await sock.sendMessage(m.chat, {
                audio: buffer,
                mimetype: 'audio/mpeg',
                fileName: `${title}.mp3`
            }, { quoted: m });

        } catch (err) {
            console.error('[YTAUDIO ERROR]', err);
            reply('❌ Failed to download YouTube audio');
        }
    }
};
