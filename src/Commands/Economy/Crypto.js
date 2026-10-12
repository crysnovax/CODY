const axios = require('axios');
const { formatBotDateTime } = require('../../Utils/timezone');

const POPULAR_COINS = ['bitcoin', 'ethereum', 'bnb', 'solana', 'ripple', 'cardano', 'dogecoin', 'tron'];

module.exports = {
    name: 'crypto',
    alias: ['coin', 'price', 'cryptoprice'],
    desc: 'Get live cryptocurrency prices',
    category: 'Search',
    usage: '.crypto <coin> | .crypto top',
    reactions: { start: '🎭', success: '✨', error: '❔' },

    execute: async (sock, m, { args, reply, prefix }) => {
        const query = args.join(' ').toLowerCase().trim();
        
        if (!query) {
            return reply(
                `╭─❍ *CRYPTO PRICES*\n│\n` +
                `│ ⚉ *Usage:* ${prefix}crypto <coin>\n│\n` +
                `│ ✪ *Examples:*\n` +
                `│ ${prefix}crypto bitcoin\n` +
                `│ ${prefix}crypto eth\n` +
                `│ ${prefix}crypto top\n` +
                `│ ${prefix}crypto bnb\n│\n` +
                `│ 🪙 *Live prices from CoinGecko*\n` +
                `╰──────────────────`
            );
        }

        await sock.sendMessage(m.chat, { react: { text: '🪙', key: m.key } });

        try {
            // ── TOP COINS ──────────────────────────────────────────
            if (query === 'top') {
                const res = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
                    params: {
                        vs_currency: 'usd',
                        order: 'market_cap_desc',
                        per_page: 10,
                        page: 1,
                        sparkline: false
                    },
                    timeout: 10000,
                    headers: { 'Accept': 'application/json' }
                });

                const tableData = [['#', '🪙 Coin', '💰 Price', '📊 24h']];
                
                for (const coin of res.data) {
                    const change = coin.price_change_percentage_24h?.toFixed(2) || '0';
                    const changeEmoji = change >= 0 ? '🟢' : '🔴';
                    const price = coin.current_price < 1 ? `$${coin.current_price.toFixed(6)}` : `$${coin.current_price.toLocaleString()}`;
                    
                    tableData.push([
                        `#${coin.market_cap_rank}`,
                        `${coin.symbol.toUpperCase()}`,
                        price,
                        `${changeEmoji} ${change}%`
                    ]);
                }

                await sock.sendMessage(m.chat, {
                    headerText: `## 🪙 Top 10 Cryptocurrencies`,
                    contentText: '---',
                    title: '📊 By Market Cap (USD)',
                    table: tableData,
                    footerText: '💡 SWIPE ⇆ • Use .crypto <name> for details'
                }, { quoted: m });

                await sock.sendMessage(m.chat, { react: { text: '📅', key: m.key } });
                return;
            }

            // ── SINGLE COIN ───────────────────────────────────────
            const coinMap = {
                'btc': 'bitcoin', 'eth': 'ethereum', 'sol': 'solana', 'xrp': 'ripple',
                'ada': 'cardano', 'doge': 'dogecoin', 'trx': 'tron', 'dot': 'polkadot',
                'matic': 'polygon', 'shib': 'shiba-inu', 'avax': 'avalanche-2',
                'link': 'chainlink', 'uni': 'uniswap', 'ltc': 'litecoin'
            };

            const coinId = coinMap[query] || query;

            const res = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
                params: {
                    vs_currency: 'usd',
                    ids: coinId,
                    order: 'market_cap_desc',
                    sparkline: false
                },
                timeout: 10000,
                headers: { 'Accept': 'application/json' }
            });

            if (!res.data.length) {
                await sock.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
                return reply(`\`✘ Coin not found: "${query}"\``);
            }

            const coin = res.data[0];
            const change = coin.price_change_percentage_24h?.toFixed(2) || '0';
            const changeEmoji = change >= 0 ? '🟢' : '🔴';
            const price = coin.current_price < 1 ? `$${coin.current_price.toFixed(6)}` : `$${coin.current_price.toLocaleString()}`;

            await sock.sendMessage(m.chat, {
                headerText: `## 🪙 ${coin.name} (${coin.symbol.toUpperCase()})`,
                contentText: '---',
                title: '📊 Live Price',
                table: [
                    ['💰 Price', price],
                    ['📊 24h Change', `${changeEmoji} ${change}%`],
                    ['🏆 Market Cap Rank', `#${coin.market_cap_rank}`],
                    ['💎 Market Cap', `$${coin.market_cap?.toLocaleString() || 'N/A'}`],
                    ['📈 24h High', `$${coin.high_24h?.toLocaleString() || 'N/A'}`],
                    ['📉 24h Low', `$${coin.low_24h?.toLocaleString() || 'N/A'}`],
                    ['🔖 Total Volume', `$${coin.total_volume?.toLocaleString() || 'N/A'}`],
                    ['📅 Last Updated', formatBotDateTime(coin.last_updated)]
                ],
                footerText: '💡 SWIPE ⇆ • Live from CoinGecko'
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });

        } catch (error) {
            console.error('[CRYPTO ERROR]', error.message);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            reply('`✘ Failed to fetch prices. API may be rate limited. Try again.`');
        }
    }
};
