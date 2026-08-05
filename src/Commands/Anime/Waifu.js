const axios = require('axios');

module.exports = [{
    name: 'waifu',
    alias: ['animegirl', 'animewaifu', 'waifuimg', 'waifupic'],
    category: 'Anime',
    desc: 'Get random anime waifu images',
    usage: '.waifu [tag] | .waifu nsfw | .waifu all',
    reactions: { start: '🎌', success: '✨' },
    
    execute: async (sock, m, { args, reply }) => {
        const input = args.join(' ').trim().toLowerCase();
        
        let nsfw = 'false';
        let tags = '';
        
        if (input === 'nsfw' || input === 'nsfw true') {
            nsfw = 'true';
        } else if (input === 'all') {
            nsfw = 'all';
        } else if (input && input !== 'sfw') {
            tags = input;
        }
        
        try {
            await sock.sendMessage(m.chat, { react: { text: '🎌', key: m.key } });
            
            let apiUrl = 'https://api.waifu.im/images?';
            const params = [];
            
            if (nsfw === 'true') params.push('IsNsfw=True');
            else if (nsfw === 'all') params.push('IsNsfw=All');
            else params.push('IsNsfw=False');
            
            if (tags) params.push(`IncludedTags=${encodeURIComponent(tags)}`);
            
            apiUrl += params.join('&');
            
            const res = await axios.get(apiUrl, {
                headers: { 'Accept': 'application/json' }
            });
            
            const data = res.data;
            const images = data?.items || data?.images || [];
            
            if (!Array.isArray(images) || images.length === 0) {
                return reply(`\`×͜× No waifu found${tags ? ' for "' + tags + '"' : ''} ×͜×\``);
            }
            
            const waifu = images[0];
            const imageUrl = waifu.url || waifu.image || '';
            
            let caption = `🎌 *WAIFU*\n\n`;
            if (waifu.tags && waifu.tags.length > 0) {
                caption += `🏷️ *Tags:* ${waifu.tags.map(t => t.name || t).join(', ')}\n`;
            }
            if (waifu.artists && waifu.artists.length > 0) {
                caption += `🎨 *Artist:* ${waifu.artists[0].name || 'Unknown'}\n`;
            }
            if (waifu.source) {
                caption += `🔗 *Source:* ${waifu.source}\n`;
            }
            caption += `📐 *Size:* ${waifu.width || '?'}×${waifu.height || '?'}\n`;
            caption += `🔞 *NSFW:* ${waifu.isNsfw ? 'Yes' : 'No'}\n`;
            caption += `\n_⚡ Powered by Waifu.im_`;
            
            await sock.sendMessage(m.chat, {
                image: { url: imageUrl },
                caption: caption
            }, { quoted: m });
            
            await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });
            
        } catch (err) {
            console.error('[WAIFU]', err.message);
            reply('`×͜× Waifu fetch failed ×͜×`');
        }
    }
}, {
    name: 'waifus',
    alias: ['waifusearch', 'findwaifu'],
    category: 'Anime',
    desc: 'Search waifu by tags',
    usage: `.waifus <tag>`,
    reactions: { start: '🔍', success: '🎌' },
    
    execute: async (sock, m, { args, reply }) => {
        const tags = args.join(' ').trim();
        if (!tags) return reply('`×͜× Provide tags to search ×͜×`');
        
        try {
            await sock.sendMessage(m.chat, { react: { text: '🔍', key: m.key } });
            
            const res = await axios.get(`https://api.waifu.im/images?IncludedTags=${encodeURIComponent(tags)}&IsNsfw=False`, {
                headers: { 'Accept': 'application/json' }
            });
            
            const data = res.data;
            const images = data?.items || data?.images || [];
            
            if (!Array.isArray(images) || images.length === 0) {
                return reply(`\`×͜× No waifu found for "${tags}" ×͜×\``);
            }
            
            // Send up to 5 waifus
            for (let i = 0; i < Math.min(images.length, 5); i++) {
                const waifu = images[i];
                const imageUrl = waifu.url || waifu.image || '';
                
                let caption = `🎌 *WAIFU #${i + 1}: ${tags}*\n`;
                if (waifu.artists && waifu.artists.length > 0) {
                    caption += `🎨 *Artist:* ${waifu.artists[0].name || 'Unknown'}\n`;
                }
                caption += `_⚡ Waifu.im_`;
                
                await sock.sendMessage(m.chat, {
                    image: { url: imageUrl },
                    caption: caption
                }, { quoted: m });
                
                await new Promise(r => setTimeout(r, 500));
            }
            
            await sock.sendMessage(m.chat, { react: { text: '🎌', key: m.key } });
            
        } catch (err) {
            console.error('[WAIFUS]', err.message);
            reply('`×͜× Waifu search failed ×͜×`');
        }
    }
}, {
    name: 'waifunsfw',
    alias: ['nsfwwaifu', 'waifu18'],
    category: 'Anime',
    desc: 'Get NSFW waifu images',
    usage: `.waifunsfw`,
    reactions: { start: '🔞', success: '👀' },
    
    execute: async (sock, m, { args, reply }) => {
        try {
            await sock.sendMessage(m.chat, { react: { text: '🔞', key: m.key } });
            
            const res = await axios.get('https://api.waifu.im/images?IsNsfw=True', {
                headers: { 'Accept': 'application/json' }
            });
            
            const data = res.data;
            const images = data?.items || data?.images || [];
            
            if (!Array.isArray(images) || images.length === 0) {
                return reply('`×͜× No NSFW waifu found ×͜×`');
            }
            
            const waifu = images[0];
            const imageUrl = waifu.url || waifu.image || '';
            
            let caption = `🔞 *NSFW WAIFU*\n\n`;
            if (waifu.tags && waifu.tags.length > 0) {
                caption += `🏷️ *Tags:* ${waifu.tags.map(t => t.name || t).join(', ')}\n`;
            }
            if (waifu.artists && waifu.artists.length > 0) {
                caption += `🎨 *Artist:* ${waifu.artists[0].name || 'Unknown'}\n`;
            }
            caption += `📐 *Size:* ${waifu.width || '?'}×${waifu.height || '?'}\n`;
            caption += `\n_⚡ Powered by Waifu.im_`;
            
            await sock.sendMessage(m.chat, {
                image: { url: imageUrl },
                caption: caption
            }, { quoted: m });
            
            await sock.sendMessage(m.chat, { react: { text: '👀', key: m.key } });
            
        } catch (err) {
            console.error('[WAIFUNSFW]', err.message);
            reply('`×͜× NSFW waifu fetch failed ×͜×`');
        }
    }
}];
