const axios = require('axios');

module.exports = [{
    name: 'html2img',
    alias: ['h2i', 'htmltoimg'],
    category: 'Converter',
    desc: 'Render HTML in WhatsApp, with image conversion as a fallback',
    usage: `${prefix}html2img <html code>`,
    reactions: { start: '📄', success: '🖼️' },
    
    execute: async (sock, m, { args, reply }) => {
        const html = args.join(' ').trim();
        if (!html) return reply('`×͜× Provide HTML code to convert ×͜×`');
        
        try {
            await sock.sendMessage(m.chat, { 
                react: { text: '📄', key: m.key } 
            });

            // Prefer CODY's native HTML message renderer. Unlike the remote
            // screenshot endpoint, this renders the provided HTML directly in
            // WhatsApp and keeps the result associated with the source message.
            if (typeof sock?.sendHtmlMessage === 'function') {
                let rendered = false;
                try {
                    await sock.sendHtmlMessage(m.chat, { html }, { quoted: m });
                    rendered = true;
                } catch (renderError) {
                    console.warn('[HTML2IMG NATIVE RENDER]', renderError?.message || renderError);
                }
                if (rendered) {
                    await sock.sendMessage(m.chat, {
                        react: { text: '🖼️', key: m.key }
                    }).catch(() => {});
                    return;
                }
            }
            
            const res = await axios.get(`https://apis.prexzyvilla.site/tools/html2img?html=${encodeURIComponent(html)}`, {
                responseType: 'arraybuffer'
            });
            
            const buffer = Buffer.from(res.data);
            const contentType = res.headers?.['content-type'];
            if (!buffer.length || (contentType && !/^image\//i.test(contentType))) {
                throw new Error('Image conversion service returned an invalid image');
            }
            
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
