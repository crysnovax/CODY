const axios = require('axios');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'database', 'timezones.json');

// ── RAPIDAPI CONFIGURATION (YOUR ACTUAL KEY) ──────────────────────────────
const RAPIDAPI_KEY = 'bebbe34903msh5b866dbc4eeee83p1015f4jsnfa9f6d69aca9';
const RAPIDAPI_HOST = 'world-time-by-api-ninjas.p.rapidapi.com';

function getDB() {
    try { if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch {}
    return {};
}

const TIMEZONES = {
    'lagos': 'Africa/Lagos', 'london': 'Europe/London', 'new york': 'America/New_York',
    'tokyo': 'Asia/Tokyo', 'dubai': 'Asia/Dubai', 'paris': 'Europe/Paris'
};

function getTimezone(region) {
    const key = (region || '').toLowerCase().trim();
    return TIMEZONES[key] || region;
}

// ── SMART TIME FETCHER WITH ROTATION ──────────────────────────────────────
async function getTimeData(city) {
    const providers = [
        {
            name: 'RapidAPI (Primary)',
            execute: async () => {
                const response = await axios({
                    method: 'GET',
                    url: 'https://world-time-by-api-ninjas.p.rapidapi.com/v1/worldtime',
                    params: { city: city },
                    headers: {
                        'x-rapidapi-key': RAPIDAPI_KEY,
                        'x-rapidapi-host': RAPIDAPI_HOST
                    },
                    timeout: 10000
                });
                return {
                    datetime: response.data.datetime,
                    timezone: response.data.timezone,
                    utc_offset: response.data.utc_offset,
                    dst: response.data.dst,
                    day_of_week: response.data.day_of_week,
                    source: 'RapidAPI'
                };
            }
        },
        {
            name: 'WorldTimeAPI (Fallback)',
            execute: async () => {
                const response = await axios.get(
                    `https://worldtimeapi.org/api/timezone/${encodeURIComponent(city)}`,
                    { timeout: 10000 }
                );
                return {
                    datetime: response.data.datetime,
                    timezone: response.data.timezone,
                    utc_offset: response.data.utc_offset,
                    dst: response.data.dst,
                    day_of_week: new Date(response.data.datetime).getDay(),
                    source: 'WorldTimeAPI'
                };
            }
        }
    ];

    for (const provider of providers) {
        try {
            const result = await provider.execute();
            return result;
        } catch (error) {
            console.warn(`❌ ${provider.name} failed:`, error.message);
            continue;
        }
    }

    throw new Error('All time APIs failed');
}

module.exports = {
    name: 'tmd',
    alias: ['timedefault', 'mytime', 'dt'],
    desc: 'Show time for your default region',
    category: 'Info',
    usage: `.tmd`,
    reactions: { start: '⏰', success: '✨', error: '❔' },

    execute: async (sock, m, { reply, prefix }) => {
        const db = getDB();
        const userId = m.sender;
        const userDefault = db[userId];

        if (!userDefault) {
            return reply(
                `╭─❍ *DEFAULT TIME*\n│\n` +
                `│ ✘ No default region set!\n│\n` +
                `│ Set one: ${prefix}settmd <region>\n` +
                `│ Example: ${prefix}settmd Lagos\n` +
                `╰──────────────────`
            );
        }

        await sock.sendMessage(m.chat, { react: { text: '⏰', key: m.key } });

        try {
            const timezone = getTimezone(userDefault);
            // Extract city name (e.g., "Africa/Lagos" → "Lagos")
            const cityName = timezone.split('/').pop().replace(/_/g, ' ');
            
            const timeData = await getTimeData(cityName);
            
            const datetime = new Date(timeData.datetime);
            const timeString = datetime.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit', 
                hour12: true 
            });
            const dateString = datetime.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            const regionName = timeData.timezone?.split('/').pop().replace(/_/g, ' ') || userDefault;

            await sock.sendMessage(m.chat, {
                headerText: `## 🕐 My Time 🏠`,
                contentText: '---',
                title: `📊 ${regionName} *(Default)*`,
                table: [
                    ['⏰ Current Time', timeString],
                    ['📅 Date', dateString],
                    ['🌍 Timezone', timeData.timezone || timezone],
                    ['📊 UTC Offset', timeData.utc_offset],
                    ['☀️ DST', timeData.dst ? 'Active 🥏' : 'Inactive 😴'],
                    ['🔌 Source', timeData.source]
                ],
                footerText: '💡 Change: .settmd <region> | .tm for other cities'
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '🥏', key: m.key } });

        } catch (err) {
            console.error('[TMD ERROR]', err.message);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            reply(`\`✘ Failed to get time. Try .tm ${userDefault} instead.\``);
        }
    }
};
