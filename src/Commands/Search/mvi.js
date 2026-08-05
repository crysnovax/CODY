// movieintel_v2.js
const axios = require('axios');
const config = require('../../../settings/config');

const BOT_NAME = config.botname || process.env.BOTNAME || 'CRYSNOVA';

module.exports = {
    name: 'movieintel',
    alias: ['moviei', 'filmintel', 'movies'],
    desc: 'Search movies with interactive carousel',
    category: 'Search',
    usage: `.movieintel <movie name>`,
    examples: ['.movieintel The boys', '.moviei Avengers'],
    reactions: { start: '🎬', success: '✨', error: '❕' },

    execute: async (sock, m, { args, reply , prefix}) => {
        const query = args.join(' ').trim();
        if (!query) return reply(`${prefix}彡 *Usage:* movieintel <movie name>\n\nExample: .movieintel The boys`);

        await sock.sendMessage(m.chat, { react: { text: '🎬', key: m.key } });

        try {
            const { data } = await axios.get(`https://docs.prexzyapis.com/moviesearch?query=${encodeURIComponent(query)}`);
            
            if (!data.status || !data.results?.length) {
                await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
                return reply(`✘ *No results found for:* ${query}`);
            }

            const results = data.results.slice(0, 10);

            // ── BUILD CAROUSEL CARDS ──────────────────────────────────────
            const cards = results.map((movie) => {
                // ── BUILD RICH CAPTION WITH ALL INFO ──────────────────
                let caption = `🎬 *${movie.title}*\n\n`;
                caption += `⭐ *Rating:* ${movie.rating || 'N/A'}\n`;
                caption += `⏱️ *Duration:* ${movie.duration || 'N/A'}\n`;
                caption += `📺 *Quality:* ${movie.quality || 'N/A'}\n`;
                caption += `📅 *Year:* ${movie.year || 'N/A'}\n`;
                caption += `🎭 *Genres:* ${movie.categories?.join(', ') || 'N/A'}\n`;
                caption += `🌍 *Countries:* ${movie.countries?.join(', ') || 'N/A'}\n`;
                
                // ── PLOT ──
                if (movie.plot || movie.synopsis || movie.description) {
                    const plot = (movie.plot || movie.synopsis || movie.description || '').substring(0, 300);
                    caption += `\n📝 *Plot:* ${plot}${plot.length >= 300 ? '...' : ''}\n`;
                }
                
                // ── CAST ──
                if (movie.cast && movie.cast.length) {
                    const castList = movie.cast.slice(0, 5).join(', ');
                    caption += `🎭 *Cast:* ${castList}${movie.cast.length > 5 ? ` +${movie.cast.length - 5} more` : ''}\n`;
                }
                
                // ── DIRECTOR ──
                if (movie.director) {
                    caption += `🎬 *Director:* ${movie.director}\n`;
                }

                // ── ADD WATCH BUTTONS ──
                const buttons = [
                    {
                        text: '🎬 Watch Now',
                        url: movie.url
                    }
                ];

                // Add trailer if available
                if (movie.trailerUrl) {
                    buttons.push({
                        text: '▶️ Trailer',
                        url: movie.trailerUrl
                    });
                }

                // Add copy link button
                buttons.push({
                    text: '📋 Copy Link',
                    copy: movie.url
                });

                return {
                    image: { url: movie.thumbnail },
                    caption: caption,
                    footer: `☁︎ ${BOT_NAME} Movie Vault`,
                    nativeFlow: buttons
                };
            });

            // ── SEND AS CAROUSEL ──────────────────────────────────────────
            await sock.sendMessage(m.chat, {
                text: `🎬 *MOVIE SEARCH: ${query}*`,
                footer: `Found ${data.total_results || results.length} results · ${BOT_NAME}`,
                cards: cards
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });

        } catch (error) {
            console.error('[MOVIEINTEL ERROR]', error.message);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            
            // ── FALLBACK: Send as text list ──────────────────────────────
            try {
                const { data } = await axios.get(`https://docs.prexzyapis.com/moviesearch?query=${encodeURIComponent(query)}`);
                const results = data.results || [];
                if (results.length) {
                    let text = `🎬 *MOVIE RESULTS: ${query}*\n\n`;
                    for (let i = 0; i < Math.min(results.length, 8); i++) {
                        const m = results[i];
                        text += `${i+1}. *${m.title}* (${m.year || 'N/A'})\n`;
                        text += `   ⭐ ${m.rating || 'N/A'} | ⏱ ${m.duration || 'N/A'}\n`;
                        if (m.plot) text += `   📝 ${m.plot.substring(0, 100)}...\n`;
                        text += `   🏷️ ${m.url}\n\n`;
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
