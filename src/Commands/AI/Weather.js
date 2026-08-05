const axios = require('axios');
const config = require('../../../settings/config');

const WEATHER_API_KEY = process.env.WEATHER_API_KEY || config.api?.weather || '';

function getWeatherEmoji(weather) {
    const map = {
        Thunderstorm: '⛈️',
        Drizzle: '🌦️',
        Rain: '🌧️',
        Snow: '❄️',
        Mist: '🌫️',
        Smoke: '💨',
        Haze: '🌫️',
        Dust: '🌪️',
        Fog: '🌫️',
        Sand: '🏜️',
        Ash: '🌋',
        Squall: '💨',
        Tornado: '🌪️',
        Clear: '☀️',
        Clouds: '☁️'
    };
    return map[weather] || '🌍';
}

module.exports = {
    name: 'weather',
    alias: ['wthr', 'forecast', 'climate'],
    desc: 'Get weather forecast in premium table',
    category: 'Search',
    usage: `.weather <city>`,
    reactions: { start: '⛅', success: '✨', error: '❔' },

    execute: async (sock, m, { args, reply, prefix }) => {
        const city = args.join(' ').trim();
        
        if (!city) {
            return reply(
                `╭─❍ *WEATHER*\n│\n` +
                `│ ⚉ *Usage:* ${prefix}weather <city>\n│\n` +
                `│ ✪ *Example:*\n` +
                `│ ${prefix}weather Lagos\n` +
                `│ ${prefix}weather London\n` +
                `│ ${prefix}weather Tokyo\n│\n` +
                `│ ⛅ *Real-time weather data*\n` +
                `╰──────────────────`
            );
        }

        await sock.sendMessage(m.chat, { react: { text: '⛅', key: m.key } });

        try {
            const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${WEATHER_API_KEY}&units=metric`;
            const { data } = await axios.get(url, { timeout: 15000 });

            const emoji = getWeatherEmoji(data.weather[0].main);
            const sunrise = new Date(data.sys.sunrise * 1000).toLocaleTimeString();
            const sunset = new Date(data.sys.sunset * 1000).toLocaleTimeString();
            const visibility = (data.visibility / 1000).toFixed(1);

            await sock.sendMessage(m.chat, {
                headerText: `## ${emoji} ${data.name}, ${data.sys.country}`,
                contentText: '---',
                title: '📊 Weather Report',
                table: [
                    ['🌤️ Condition', `${emoji} ${data.weather[0].description}`],
                    ['🌡️ Temperature', `${data.main.temp}°C`],
                    ['🤒 Feels Like', `${data.main.feels_like}°C`],
                    ['📉 Min / Max', `${data.main.temp_min}°C / ${data.main.temp_max}°C`],
                    ['💧 Humidity', `${data.main.humidity}%`],
                    ['🌬️ Wind', `${data.wind.speed} m/s`],
                    ['📊 Pressure', `${data.main.pressure} hPa`],
                    ['👁️ Visibility', `${visibility} km`],
                    ['🌅 Sunrise', sunrise],
                    ['🌇 Sunset', sunset],
                    ['🌐 Coordinates', `${data.coord.lat}, ${data.coord.lon}`]
                ],
                footerText: '💡 SWIPE ⇆ for details • Powered by CRYSNOVA AI'
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '📅', key: m.key } });

        } catch (error) {
            console.error('[WEATHER ERROR]', error.message);
            await sock.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
            
            reply(
                `╭─❍ *WEATHER*\n│\n` +
                `│ ✘ *City not found or API error*\n│\n` +
                `│ Check the city name and try again.\n` +
                `╰──────────────────`
            );
        }
    }
};
