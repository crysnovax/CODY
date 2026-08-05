const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Popular timezones mapping
const TIMEZONES = {
    'lagos': 'Africa/Lagos',
    'london': 'Europe/London',
    'new york': 'America/New_York',
    'los angeles': 'America/Los_Angeles',
    'chicago': 'America/Chicago',
    'toronto': 'America/Toronto',
    'tokyo': 'Asia/Tokyo',
    'dubai': 'Asia/Dubai',
    'paris': 'Europe/Paris',
    'berlin': 'Europe/Berlin',
    'mumbai': 'Asia/Kolkata',
    'delhi': 'Asia/Kolkata',
    'singapore': 'Asia/Singapore',
    'sydney': 'Australia/Sydney',
    'moscow': 'Europe/Moscow',
    'rio': 'America/Sao_Paulo',
    'beijing': 'Asia/Shanghai',
    'cairo': 'Africa/Cairo',
    'nairobi': 'Africa/Nairobi',
    'accra': 'Africa/Accra',
    'abuja': 'Africa/Lagos',
    'capetown': 'Africa/Johannesburg'
};

function getTimezone(region) {
    const key = region.toLowerCase().trim();
    if (TIMEZONES[key]) return TIMEZONES[key];
    return region;
}

async function getTimeData(timezone) {
    // Try WorldTimeAPI first
    try {
        const res = await axios.get(`https://worldtimeapi.org/api/timezone/${encodeURIComponent(timezone)}`, { timeout: 8000 });
        return { source: 'worldtimeapi', data: res.data };
    } catch (e) {
        // Fallback to Core
        try {
            const core = require('../Core/®.js');
            return await core.getTimeData(timezone);
        } catch (e2) {
            throw new Error('All time sources failed');
        }
    }
}

module.exports = {
    name: 'tm',
    alias: ['time', 'timezone', 'clock'],
    desc: 'Show current time for any region',
    category: 'Info',
    usage: `.tm <region>`,
    reactions: { start: '⏰', success: '🥏', error: '❔' },

    execute: async (sock, m, { args, reply, prefix }) => {
        const region = args.join(' ').trim();
        
        if (!region) {
            const popular = Object.keys(TIMEZONES).slice(0, 10).map(r => r.charAt(0).toUpperCase() + r.slice(1));
            return reply(
                `╭─❍ *WORLD TIME*\n│\n` +
                `│ ⚉ *Usage:* ${prefix}tm <region>\n│\n` +
                `│ ✪ *Popular:*\n` +
                `│ ${popular.join(', ')}\n│\n` +
                `│ 🌍 *Any city worldwide!*\n` +
                `╰──────────────────`
            );
        }

        await sock.sendMessage(m.chat, { react: { text: '⏰', key: m.key } });

        try {
            const timezone = getTimezone(region);
            const { source, data } = await getTimeData(timezone);
            
            const datetime = new Date(data.datetime);
            const timeString = datetime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            const dateString = datetime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const regionName = (data.timezone || timezone).split('/').pop().replace(/_/g, ' ');
            const sourceNote = source !== 'worldtimeapi' ? ` (via ${source})` : '';

            await sock.sendMessage(m.chat, {
                headerText: `## 🕐 ${regionName}`,
                contentText: '---',
                title: `📊 Time Details${sourceNote}`,
                table: [
                    ['⏰ Current Time', timeString],
                    ['📅 Date', dateString],
                    ['🌍 Timezone', data.timezone || timezone],
                    ['📊 UTC Offset', `UTC${data.utc_offset || data.utcOffset || 'N/A'}`],
                    ['🏷️ Abbreviation', data.abbreviation || 'N/A'],
                    ['☀️ DST', data.dst ? 'Active 🎭' : 'Inactive 💤'],
                    ['📅 Day of Year', `Day ${data.day_of_year || 'N/A'} / Week ${data.week_number || 'N/A'}`]
                ],
                footerText: '💡 SWIPE ⇆ for details • Set default: .settmd <region>'
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '🔖', key: m.key } });

        } catch (error) {
            console.error('[TM ERROR]', error.message);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            reply(`\`✘ Region not found. Try: Lagos, London, Tokyo, Dubai...\``);
        }
    }
};
