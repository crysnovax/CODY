const axios = require('axios');

// Extract og:image URL 
function extractOgImage(html) {
    const patterns = [
        /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
        /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
        /<meta[^>]*property=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
        /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']twitter:image["']/i,
        /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
        /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i,
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1] && match[1].startsWith('http')) return match[1];
    }
    return null;
}

// Download image URL as buffer
async function downloadBuffer(url) {
    try {
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 8000
        });
        return Buffer.from(res.data);
    } catch {
        return null;
    }
}

// Favicon fallback as buffer
async function getFaviconBuffer(url) {
    try {
        const domain = new URL(url).origin;
        const res = await axios.get(`https://www.google.com/s2/favicons?sz=256&domain_url=${domain}`, {
            responseType: 'arraybuffer',
            timeout: 8000
        });
        return Buffer.from(res.data);
    } catch {
        return null;
    }
}

module.exports = {
    name: 'fetch',
    category: 'Search',
    desc: 'Advanced web search with detailed results',
    usage: `.get <query>`,

    execute: async (sock, m, { args, reply }) => {
        const query = args.join(' ').trim();
        if (!query) return reply('⚉ Usage: .get <query>');

        await sock.sendMessage(m.chat, { react: { text: '🔍', key: m.key } });

        try {
            const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
            const res = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 15000
            });

            const html = res.data;
            const results = [];

            const regex = /<a[^>]*href="[^"]*uddg=([^"&]+)[^"]*"[^>]*>(.*?)<\/a>/g;
            let match;

            while ((match = regex.exec(html)) !== null) {
                const link = decodeURIComponent(match[1]);
                const title = match[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
                if (link && title && !results.find(r => r.url === link)) {
                    results.push({ title, url: link });
                }
            }

            if (results.length === 0) return reply('✘ No results found.');

            const selected = results.slice(0, 10);

            // Fetch all pages
            const pages = await Promise.all(
                selected.map(r =>
                    axios.get(r.url, {
                        headers: { 'User-Agent': 'Mozilla/5.0' },
                        timeout: 8000
                    }).then(res => res.data).catch(() => null)
                )
            );

            let text = `🔍 *SEARCH: ${query.toUpperCase()}*\n\n`;

            selected.forEach((r, i) => {
                let content = '';
                if (pages[i]) {
                    content = pages[i]
                        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                        .replace(/<[^>]+>/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim()
                        .substring(0, 200);
                }
                text += `${i + 1}. *${r.title}*\n`;
                text += `🔗 ${r.url}\n`;
                if (content) text += `📝 ${content}...\n\n`;
            });

            text += `_Powered by CRYSNOVA AI_`;

            const first = selected[0];

            // Try og:image from page[0] first, scan others if not found
            let thumbnail = null;
            let ogImageUrl = null;

            if (pages[0]) {
                ogImageUrl = extractOgImage(pages[0]);
            }

            if (!ogImageUrl) {
                for (let i = 1; i < pages.length; i++) {
                    if (pages[i]) {
                        ogImageUrl = extractOgImage(pages[i]);
                        if (ogImageUrl) break;
                    }
                }
            }

            if (ogImageUrl) {
                thumbnail = await downloadBuffer(ogImageUrl);
            }

            if (!thumbnail) {
                thumbnail = await getFaviconBuffer(first.url);
            }

            // Send as image with caption — always fresh, no caching issues
            await sock.sendMessage(m.chat, {
                image: thumbnail,
                caption: text
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '💬', key: m.key } });

        } catch (err) {
            console.error('[GET ERROR]', err.message);
            await sock.sendMessage(m.chat, { react: { text: '💢', key: m.key } });
            reply('✘ Search failed.');
        }
    }
};
