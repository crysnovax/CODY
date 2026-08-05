const axios = require('axios');

module.exports = [{
    name: 'html2img',
    alias: ['h2i', 'htmltoimg'],
    category: 'Converter',
    desc: 'Convert HTML code to an image',
    usage: `.html2img <html code>`,
    reactions: { start: '📄', success: '🖼️' },
    
    execute: async (sock, m, { args, reply }) => {
        const html = args.join(' ').trim();
        if (!html) return reply('`×͜× Provide HTML code to convert ×͜×`');
        
        try {
            await sock.sendMessage(m.chat, { 
                react: { text: '📄', key: m.key } 
            });
            
            const res = await axios.get(`https://apis.prexzyvilla.site/tools/html2img?html=${encodeURIComponent(html)}`, {
                responseType: 'arraybuffer'
            });
            
            const buffer = Buffer.from(res.data);
            
            await sock.sendMessage(m.chat, {
                image: buffer,
                caption: `📄 *HTML to Image*\n\n`
            }, { quoted: m });
            
            await sock.sendMessage(m.chat, { 
                react: { text: '🖼️', key: m.key } 
            });
            
        } catch (err) {
            console.error('[HTML2IMG]', err.message);
            reply('`×͜× HTML to Image conversion failed ×͜×`');
        }
    }
}];
