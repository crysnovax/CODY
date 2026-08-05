const axios = require('axios');

module.exports = {
    name: 'phoneinfo',
    alias: ['phone', 'number', 'whoiscalling'],
    desc: 'Get phone number information',
    category: 'Search',
    usage: `.phoneinfo <number with country code>`,
    reactions: { start: '📞', success: '📡', error: '🏗️' },

    execute: async (sock, m, { args, reply, prefix }) => {
        const phone = args[0]?.replace(/[^0-9]/g, '');

        if (!phone) {
            return reply(
                `╭─❍ *PHONE INFO*\n│\n` +
                `│ ⚉ *Usage:* ${prefix}phoneinfo <number>\n│\n` +
                `│ ✪ *Examples:*\n` +
                `│ ${prefix}phoneinfo 2348077528901\n` +
                `│ ${prefix}phoneinfo 12025551234\n│\n` +
                `│ 📞 *Include country code!*\n` +
                `╰──────────────────`
            );
        }

        await sock.sendMessage(m.chat, { react: { text: '📞', key: m.key } });

        try {
            // phone-number-api.com — free endpoint, no API key required
            // Limit: 5 requests/minute per IP. Non-commercial use only.
            const res = await axios.get('http://phone-number-api.com/json/', {
                params: { number: phone },
                timeout: 10000
            });

            const data = res.data;

            if (data.status !== 'success') {
                await sock.sendMessage(m.chat, { react: { text: '🏗️', key: m.key } });
                return reply(`\`✘ Lookup failed: ${data.message || 'invalid number'}\``);
            }

            await sock.sendMessage(m.chat, {
                headerText: `## 📞 Phone Info`,
                contentText: '---',
                title: '📊 Number Details',
                table: [
                    ['📞 Number', data.formatE164 || phone],
                    ['🌍 Country', data.countryName || 'N/A'],
                    ['🏛️ Code', `+${data.numberCountryCode ?? 'N/A'}`],
                    ['📍 Region', [data.city, data.regionName].filter(Boolean).join(', ') || 'N/A'],
                    ['📡 Carrier', data.carrier || 'N/A'],
                    ['📱 Line Type', data.numberType || 'N/A'],
                    ['🕐 Timezone', data.timezone || 'N/A'],
                    ['✅ Valid', data.numberValid ? 'Yes 🔖' : 'No 🏗️']
                ],
                footerText: '💡 Include country code for accurate results'
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '🎭', key: m.key } });

        } catch (error) {
            if (error.response?.status === 429) {
                console.error('phoneinfo rate limited:', error.message);
                await sock.sendMessage(m.chat, { react: { text: '🏗️', key: m.key } });
                return reply('`✘ Rate limit hit — try again in a minute.`');
            }
            console.error('API Error:', error.message);
            await sock.sendMessage(m.chat, { react: { text: '🏗️', key: m.key } });
            reply('`✘ Failed to lookup number. Please try with country code.`');
        }
    }
};
