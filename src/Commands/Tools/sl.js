const axios = require('axios');

module.exports = [{
    name: 'short',
    alias: ['shorten', 'sl', 'shortlink'],
    category: 'Tools',
    desc: 'Shorten a URL with ♧ Short',
    usage: '.short <url> | custom-slug | password | hours',
    reactions: { start: '✂️', success: '♧' },
    
    execute: async (sock, m, { args, reply, prefix }) => {
        if (!args.length) {
            return reply(
                `╭─❍ *♧ SHORT LINKER*\n│\n` +
                `│ ⚉ *Usage:* ${prefix}short <url>\n│\n` +
                `│ ✪ *With custom slug:*\n│   ${prefix}short <url> | myslug\n│\n` +
                `│ 🔒 *With password:*\n│   ${prefix}short <url> | slug | password\n│\n` +
                `│ ⏰ *With expiration:*\n│   ${prefix}short <url> | slug | pass | 24\n│\n` +
                `│ 📝 *Examples:*\n` +
                `│ ${prefix}short https://ai.crysnovax.link\n` +
                `│ ${prefix}short https://link.com | mylink\n` +
                `│ ${prefix}short https://link.com | secret | pass123 | 48\n│\n` +
                `╰──────────────────`
            );
        }

        // Parse args: url | slug | password | expiresIn
        const parts = args.join(' ').split('|').map(p => p.trim());
        const longUrl = parts[0];
        const customSlug = parts[1] || undefined;
        const password = parts[2] || undefined;
        const expiresIn = parseInt(parts[3]) || undefined;

        if (!longUrl.startsWith('http')) {
            return reply('`×͜× Invalid URL. Must start with http ×͜×`');
        }

        try {
            await sock.sendMessage(m.chat, { react: { text: '✂️', key: m.key } });

            const res = await axios.post('https://sl.crysnovax.link/api/shorten', {
                url: longUrl,
                slug: customSlug,
                password: password,
                expiresIn: expiresIn
            });

            const data = res.data;
            if (!data.status) return reply(`\`×͜× ${data.error || 'Failed'} ×͜×\``);

            let caption = `♧ *LINK SHORTENED!*\n\n`;
            caption += `🔗 *Short:* ${data.shortUrl}\n`;
            caption += `📋 *Slug:* \`${data.slug}\`\n`;
            
            if (password) caption += `🔒 *Protected:* Yes\n`;
            if (data.expiresAt) {
                caption += `⏰ *Expires:* ${new Date(data.expiresAt).toLocaleString()}\n`;
            }
            
            caption += `\n_♧ Short · sl.crysnovax.link_`;

            // Send QR code
            await sock.sendMessage(m.chat, {
                image: { url: data.qrUrl },
                caption: caption
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '♧', key: m.key } });

        } catch (err) {
            console.error('[SHORT]', err.message);
            if (err.response?.data?.error) {
                reply(`\`×͜× ${err.response.data.error} ×͜×\``);
            } else {
                reply('`×͜× Shorten failed ×͜×`');
            }
        }
    }
}, {
    name: 'shortinfo',
    alias: ['slinfo', 'linkinfo'],
    category: 'Tools',
    desc: 'Get info about a shortened link',
    usage: `.shortinfo <slug>`,
    reactions: { start: '🔍', success: '📊' },
    
    execute: async (sock, m, { args, reply, prefix }) => {
        const slug = args[0]?.trim().replace('https://sl.crysnovax.link/', '').replace('/', '');
        if (!slug) return reply(`\`×͜× Usage: ${prefix}shortinfo <slug> ×͜×\``);

        try {
            await sock.sendMessage(m.chat, { react: { text: '🔍', key: m.key } });

            const res = await axios.get(`https://sl.crysnovax.link/api/info/${slug}`);
            const data = res.data;
            if (!data.status) return reply(`\`×͜× ${data.error || 'Not found'} ×͜×\``);

            let caption = `♧ *LINK INFO*\n\n`;
            caption += `🔗 *Short:* ${data.shortUrl}\n`;
            caption += `📋 *Slug:* \`${data.slug}\`\n`;
            caption += `🔗 *Original:* ${data.originalUrl.slice(0, 60)}...\n`;
            caption += `👁️ *Clicks:* ${data.clicks}\n`;
            caption += `📅 *Created:* ${new Date(data.created).toLocaleString()}\n`;
            if (data.hasPassword) caption += `🔒 *Protected:* Yes\n`;
            if (data.expiresAt) caption += `⏰ *Expires:* ${new Date(data.expiresAt).toLocaleString()}\n`;
            caption += `\n_♧ Short · sl.crysnovax.link_`;

            await sock.sendMessage(m.chat, {
                image: { url: data.qrUrl },
                caption: caption
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '📊', key: m.key } });

        } catch (err) {
            console.error('[SHORTINFO]', err.message);
            reply('`×͜× Link info failed ×͜×`');
        }
    }
}, {
    name: 'shortdelete',
    alias: ['sldel', 'linkdel'],
    category: 'Tools',
    desc: 'Delete a shortened link',
    usage: `.shortdelete <slug> | <password>`,
    reactions: { start: '🗑️', success: '🏷️' },
    
    execute: async (sock, m, { args, reply, prefix }) => {
        const parts = args.join(' ').split('|').map(p => p.trim());
        const slug = parts[0]?.replace('https://sl.crysnovax.link/', '').replace('/', '');
        const password = parts[1] || '';

        if (!slug) return reply(`\`×͜× Usage: ${prefix}shortdelete <slug> ×͜×\``);

        try {
            await sock.sendMessage(m.chat, { react: { text: '🗑️', key: m.key } });

            const res = await axios.delete(`https://sl.crysnovax.link/api/delete/${slug}`, {
                data: { password: password || undefined }
            });

            if (res.data.status) {
                reply('`♧ Link deleted successfully!`');
                await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
            }

        } catch (err) {
            console.error('[SHORTDELETE]', err.message);
            if (err.response?.data?.error) {
                reply(`\`×͜× ${err.response.data.error} ×͜×\``);
            } else {
                reply('`×͜× Delete failed ×͜×`');
            }
        }
    }
}];
