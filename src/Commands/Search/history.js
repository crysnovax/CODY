const axios = require('axios');
const { getBotDateParts } = require('../../Utils/timezone');

module.exports = {
    name: 'history',
    alias: ['today', 'onthisday', 'hist'],
    desc: 'Get historical events for any date',
    category: 'Search',
    usage: '.history [MM/DD] or just .history for today',
    reactions: { start: '📜', success: '📅', error: '❔' },

    execute: async (sock, m, { args, reply, prefix }) => {
        try {
            let month, day;

            if (args[0] && args[0].includes('/')) {
                const splitDate = args[0].split('/');
                month = splitDate[0].padStart(2, '0');
                day = splitDate[1].padStart(2, '0');
            } else {
                const today = getBotDateParts(new Date());
                month = today.month;
                day = today.day;
            }

            if (parseInt(month) > 12 || parseInt(day) > 31) {
                return reply('`✘ Format Error: Use MM/DD (Max 12/31)`');
            }

            await sock.sendMessage(m.chat, { react: { text: '📜', key: m.key } });
            await reply(`\`📜 Fetching history: ${month}/${day}...\``);

            const response = await axios.get(
                `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${month}/${day}`,
                {
                    headers: {
                        'User-Agent': 'CRYSNOVA-Bot/2.0 (https://github.com/crysnovax; crysnova@example.com) Axios/1.6.0'
                    },
                    timeout: 10000
                }
            );

            if (!response.data?.events?.length) {
                await sock.sendMessage(m.chat, { react: { text: '💤', key: m.key } });
                return reply('`✘ No historical events found for this date`');
            }

            const events = response.data.events;
            const selected = events.sort(() => 0.5 - Math.random()).slice(0, 5);

            // Get month name
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                              'July', 'August', 'September', 'October', 'November', 'December'];
            const monthName = monthNames[parseInt(month) - 1];

            const tableData = [['📅 Year', '📜 Event']];
            
            for (const ev of selected) {
                const shortText = ev.text.length > 80 ? ev.text.slice(0, 77) + '...' : ev.text;
                tableData.push([ev.year, shortText]);
            }

            await sock.sendMessage(m.chat, {
                headerText: `## 📜 On This Day`,
                contentText: '---',
                title: `📅 ${monthName} ${parseInt(day)}`,
                table: tableData,
                footerText: `💡 SWIPE ⇆ • Source: Wikipedia | Try ${prefix}history 12/25`
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '🔖', key: m.key } });

        } catch (error) {
            console.error('[HISTORY ERROR]', error.message);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            
            const reason = error.response ? `Status ${error.response.status}` : 'Network Error';
            reply(`\`✘ ${reason}\``);
        }
    }
};
