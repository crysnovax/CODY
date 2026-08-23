const axios = require('axios');
const config = require('../../../settings/config');

const BOT_NAME = config.botname || process.env.BOTNAME || 'CRYSNOVA';
const PRIMARY_API = 'https://wallpaper.crysnovax.link/api/search';
const FALLBACK_API = 'https://wallhaven.cc/api/v1/search';

function normalizeResults(data) {
    const raw = Array.isArray(data) ? data : (data?.results || data?.data || data?.wallpapers || []);
    return raw.map(item => ({
        ...item,
        proxy: item.proxy || item.path || item.thumbs?.original || item.thumbs?.large || item.url
    })).filter(item => item.proxy);
}

async function searchWallpapers(query) {
    try {
        const response = await axios.get(PRIMARY_API, {
            params: { query },
            timeout: 20000,
            validateStatus: () => true
        });
        if (response.status < 200 || response.status >= 300 || response.data?.status === false) {
            throw new Error(response.data?.details || response.data?.error || `Wallpaper API HTTP ${response.status}`);
        }
        const results = normalizeResults(response.data);
        if (results.length) return { results, source: 'CRYSNOVA Wallpaper API' };
        throw new Error('CRYSNOVA Wallpaper API returned no results');
    } catch (primaryError) {
        console.warn('[WALLPAPER] Primary API unavailable:', primaryError.message);
        const response = await axios.get(FALLBACK_API, {
            params: { q: query, sorting: 'relevance', page: 1 },
            timeout: 20000
        });
        const results = normalizeResults(response.data);
        if (!results.length) throw new Error('No wallpapers returned by either provider');
        return { results, source: 'Wallhaven fallback' };
    }
}

module.exports = {
    name: 'wallpaper',
    alias: ['wlp', 'wall'],
    desc: 'Search for beautiful wallpapers',
    category: 'Search',
    usage: '.wallpaper <query>',

    execute: async (sock, m, { args, reply }) => {
        const query = args.join(' ').trim();
        if (!query) return reply('_Provide a wallpaper query to search._');

        try {
            await sock.sendMessage(m.chat, { react: { text: '🖼️', key: m.key } });
            const { results, source } = await searchWallpapers(query);
            const cards = results.slice(0, 10).map(wp => ({
                image: { url: wp.proxy },
                caption: `🖼️ *Wallpaper*\n🔍 ${query}`,
                footer: `⚉ ${BOT_NAME} Vault · ${source}`,
                nativeFlow: [
                    { text: '📥 Download', url: wp.proxy },
                    { text: '📋 Copy URL', copy: wp.proxy }
                ]
            }));

            let delivered = false;
            if (typeof sock.sendRichButtonGrid === 'function') {
                try {
                    const sent = await sock.sendRichButtonGrid(m.chat, {
                        text: `🖼️ *WALLPAPER SEARCH: ${query}*`,
                        footer: `Found ${results.length} results · ${source}`,
                        cards
                    }, { quoted: m });
                    delivered = Boolean(sent?.key?.id || sent?.message?.key?.id || sent?.id);
                } catch (error) {
                    console.warn('[WALLPAPER] Rich-grid delivery failed; using image fallback:', error.message);
                }
            }
            if (!delivered && typeof sock.sendInteractiveCarousel === 'function') {
                try {
                    const sent = await sock.sendInteractiveCarousel(m.chat, {
                        text: `🖼️ *WALLPAPER SEARCH: ${query}*`,
                        footer: `Found ${results.length} results · ${source}`,
                        cards
                    }, { quoted: m });
                    delivered = Boolean(sent?.key?.id || sent?.message?.key?.id || sent?.id);
                } catch (error) {
                    console.warn('[WALLPAPER] Carousel delivery failed; using image fallback:', error.message);
                }
            }
            if (!delivered) {
                for (const wp of results.slice(0, 5)) {
                    await sock.sendMessage(m.chat, {
                        image: { url: wp.proxy },
                        caption: `🖼️ *Wallpaper: ${query}*\\n\\n_⚉ ${BOT_NAME} Vault_`
                    }, { quoted: m });
                }
            }
            await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });
        } catch (error) {
            console.error('[WALLPAPER]', error.stack || error.message);
            await reply(`✘ Wallpaper search failed: ${error.message}`);
        }
    }
};

module.exports.normalizeResults = normalizeResults;
module.exports.searchWallpapers = searchWallpapers;
