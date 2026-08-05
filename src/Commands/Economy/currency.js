const axios = require('axios');

module.exports = {
    name: 'currency',
    alias: ['convert', 'exchange', 'fxconvert'],
    desc: 'Convert between currencies with live rates',
    category: 'Search',
    usage: `.currency <amount> <from> <to>`,
    reactions: { start: '💱', success: '🪙', error: '🏗️' },

    execute: async (sock, m, { args, reply, prefix }) => {
        const amount = parseFloat(args[0]);
        const from = args[1]?.toUpperCase();
        const to = args[2]?.toUpperCase();

        if (!amount || !from || !to) {
            return reply(
                `╭─❍ *CURRENCY CONVERTER*\n│\n` +
                `│ ⚉ *Usage:* ${prefix}currency <amount> <from> <to>\n│\n` +
                `│ ✪ *Examples:*\n` +
                `│ ${prefix}currency 100 USD NGN\n` +
                `│ ${prefix}currency 50 EUR GBP\n` +
                `│ ${prefix}currency 1 BTC USD\n│\n` +
                `│ 💱 *Live exchange rates*\n` +
                `╰──────────────────`
            );
        }

        await sock.sendMessage(m.chat, { react: { text: '💱', key: m.key } });

        try {
            const res = await axios.get(`https://api.frankfurter.app/latest`, {
                params: { amount, from, to },
                timeout: 10000
            });

            const data = res.data;
            const rate = data.rates[to];
            const result = (amount * rate).toFixed(4);

            await sock.sendMessage(m.chat, {
                headerText: `## 💱 Currency Convert`,
                contentText: '---',
                title: '📊 Conversion Result',
                table: [
                    ['💰 Amount', `${amount} ${from}`],
                    ['💱 Rate', `1 ${from} = ${rate} ${to}`],
                    ['✅ Result', `${result} ${to}`],
                    ['📅 Date', data.date]
                ],
                footerText: '💡 Live rates • Frankfurter API'
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '💰', key: m.key } });

        } catch (error) {
            await sock.sendMessage(m.chat, { react: { text: '🏗️', key: m.key } });
            reply('`✘ Invalid currency or API error`');
        }
    }
};
