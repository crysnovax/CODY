// movieintel (Mvi.js) — powered by the prexzy search endpoint.
//
// GET https://prexzyapis.com/search?q=<query>
//   { status, query, total, results: { pager, items: [ { title, releaseDate,
//     genre, imdbRatingValue, countryName, description, cover: { url },
//     detailPath, season } ] } }
//
// The old docs.prexzyapis.com/moviesearch endpoint is retired.
const axios = require('axios');
const config = require('../../../settings/config');

const BOT_NAME = config.botname || process.env.BOTNAME || 'CRYSNOVA';
const API_URL = 'https://prexzyapis.com/search?q=';
const MAX_RESULTS = 10;

function itemYear(item) {
    const date = item?.releaseDate || '';
    return String(date).slice(0, 4) || 'N/A';
}

function itemTitle(item) {
    const season = item?.season ? ` S${item.season}` : '';
    return `${item?.title || 'Untitled'}${season}`;
}

function buildCaption(item) {
    let caption = `🎬 *${itemTitle(item)}*\n\n`;
    caption += `⭐ *Rating:* ${item.imdbRatingValue || 'N/A'}\n`;
    caption += `📅 *Year:* ${itemYear(item)}\n`;
    caption += `🎭 *Genres:* ${item.genre || 'N/A'}\n`;
    caption += `🌍 *Country:* ${item.countryName || 'N/A'}\n`;

    const plot = (item.description || '').trim();
    if (plot) {
        caption += `\n📝 *Plot:* ${plot.length > 300 ? `${plot.slice(0, 300)}...` : plot}\n`;
    }
    return caption;
}

function getResults(data) {
    const items = data?.results?.items;
    return Array.isArray(items) ? items : [];
}

module.exports = {
    name: 'movieintel',
    alias: ['moviei', 'filmintel', 'movies'],
    desc: 'Search movies with interactive carousel',
    category: 'Search',
    usage: `${prefix}movieintel <movie name>`,
    examples: ['.movieintel The boys', '.moviei Avengers'],
    reactions: { start: '🎬', success: '✨', error: '❕' },

    execute: async (sock, m, { args, reply }) => {
        const query = args.join(' ').trim();
        if (!query) return reply(`${prefix}彡 *Usage:* movieintel <movie name>\n\nExample: .movieintel The boys`);

        await sock.sendMessage(m.chat, { react: { text: '🎬', key: m.key } });

        try {
            const { data } = await axios.get(API_URL + encodeURIComponent(query));
            const results = getResults(data).slice(0, MAX_RESULTS);

            if (!results.length) {
                await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
                return reply(`✘ *No results found for:* ${query}`);
            }

            const cards = results.map((item) => ({
                image: { url: item?.cover?.url },
                caption: buildCaption(item),
                footer: `☁︎ ${BOT_NAME} Movie Vault`,
                nativeFlow: [
                    {
                        text: '📋 Copy title',
                        copy: itemTitle(item)
                    }
                ]
            }));

            await sock.sendMessage(m.chat, {
                text: `🎬 *MOVIE SEARCH: ${query}*`,
                footer: `Found ${data?.results?.pager?.totalCount || results.length} results · ${BOT_NAME}`,
                cards
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });

        } catch (error) {
            console.error('[MOVIEINTEL ERROR]', error.message);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } }).catch(() => {});

            // ── FALLBACK: Send as a plain text list ──────────────────────
            try {
                const { data } = await axios.get(API_URL + encodeURIComponent(query));
                const results = getResults(data);
                if (results.length) {
                    let text = `🎬 *MOVIE RESULTS: ${query}*\n\n`;
                    for (let i = 0; i < Math.min(results.length, 8); i++) {
                        const item = results[i];
                        text += `${i + 1}. *${itemTitle(item)}* (${itemYear(item)})\n`;
                        text += `   ⭐ ${item.imdbRatingValue || 'N/A'}\n`;
                        text += `   🎭 ${item.genre || 'N/A'}\n\n`;
                    }
                    return reply(text);
                }
            } catch (fallbackErr) {
                // Silent fallback
            }

            reply(`ⓘ *Error fetching movies.*\n\nTry again later or use a different search term.`);
        }
    }
};

module.exports.buildCaption = buildCaption;
module.exports.itemTitle = itemTitle;
module.exports.getResults = getResults;
