const axios = require('axios');

const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

const SIGN_EMOJIS = {
    'aries': '♈', 'taurus': '♉', 'gemini': '♊', 'cancer': '♋',
    'leo': '♌', 'virgo': '♍', 'libra': '♎', 'scorpio': '♏',
    'sagittarius': '♐', 'capricorn': '♑', 'aquarius': '♒', 'pisces': '♓'
};

module.exports = {
    name: 'horoscope',
    alias: ['zodiac', 'starsign', 'astrology'],
    desc: 'Get daily horoscope for any zodiac sign',
    category: 'Fun',
    usage: `.horoscope <sign>`,
    reactions: { start: '⭐', success: '👽', error: '🏗️' },

    execute: async (sock, m, { args, reply, prefix }) => {
        const sign = args[0]?.toLowerCase();
        
        if (!sign || !SIGNS.includes(sign)) {
            return reply(
                `╭─❍ *HOROSCOPE ⭐*\n│\n` +
                `│ ⚉ *Usage:* ${prefix}horoscope <sign>\n│\n` +
                `│ ✪ *Signs:*\n` +
                `│ ${SIGNS.map(s => SIGN_EMOJIS[s] + ' ' + s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}\n` +
                `╰──────────────────`
            );
        }

        await sock.sendMessage(m.chat, { react: { text: '⭐', key: m.key } });

        try {
            const res = await axios.post('https://aztro.sameerkumar.website', null, {
                params: { sign, day: 'today' },
                timeout: 10000,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const data = res.data;

            await sock.sendMessage(m.chat, {
                headerText: `## ${SIGN_EMOJIS[sign]} ${sign.charAt(0).toUpperCase() + sign.slice(1)}`,
                contentText: '---',
                title: '⭐ Daily Horoscope',
                table: [
                    ['📅 Date', data.current_date],
                    ['📝 Horoscope', data.description],
                    ['💖 Compatibility', data.compatibility],
                    ['🎨 Mood', data.mood],
                    ['🌈 Color', data.color],
                    ['🔢 Lucky Number', data.lucky_number],
                    ['⏰ Lucky Time', data.lucky_time]
                ],
                footerText: `💡 Tomorrow: ${prefix}horoscope ${sign}`
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '👽', key: m.key } });

        } catch (error) {
            await sock.sendMessage(m.chat, { react: { text: '🏗️', key: m.key } });
            reply('`✘ Failed to get horoscope`');
        }
    }
};
