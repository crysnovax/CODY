// Core/®-utils.js — Time utilities with smart API rotation

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');

const ENV_PATH = path.join(__dirname, '../.env');
const DB_PATH = path.join(__dirname, '../database/timezones.json');

// ── RAPIDAPI CONFIGURATION (YOUR ACTUAL KEY) ──────────────────────────────
const RAPIDAPI_KEY = 'bebbe34903msh5b866dbc4eeee83p1015f4jsnfa9f6d69aca9';
const RAPIDAPI_HOST = 'world-time-by-api-ninjas.p.rapidapi.com';

// ── API PROVIDERS WITH SMART ROTATION ───────────────────────────────────
const TIME_PROVIDERS = [
    {
        name: 'RapidAPI (Primary)',
        enabled: true,
        type: 'rapidapi',
        execute: async (timezone) => {
            // Extract city from timezone (e.g., "Africa/Lagos" → "Lagos")
            const city = timezone.split('/').pop().replace(/_/g, ' ');
            
            const response = await axios({
                method: 'GET',
                url: 'https://world-time-by-api-ninjas.p.rapidapi.com/v1/worldtime',
                params: { city: city },
                headers: {
                    'x-rapidapi-key': RAPIDAPI_KEY,
                    'x-rapidapi-host': RAPIDAPI_HOST
                },
                timeout: 8000
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
        enabled: true,
        type: 'worldtime',
        execute: async (timezone) => {
            const response = await axios.get(
                `https://worldtimeapi.org/api/timezone/${encodeURIComponent(timezone)}`,
                { timeout: 8000 }
            );
            
            return {
                datetime: response.data.datetime,
                timezone: response.data.timezone,
                utc_offset: response.data.utc_offset,
                dst: response.data.dst,
                day_of_week: moment(response.data.datetime).tz(timezone).day(),
                source: 'WorldTimeAPI'
            };
        }
    }
];

// ── LOCAL FALLBACK (when all APIs fail) ─────────────────────────────────
const getLocalFallback = (timezone) => {
    if (!moment.tz.zone(timezone)) throw new RangeError(`Invalid IANA time zone: ${timezone}`);
    const now = moment.tz(timezone);
    return {
        datetime: now.toISOString(),
        timezone: timezone,
        utc_offset: now.format('Z'),
        dst: now.isDST(),
        day_of_week: now.day(),
        day_of_year: now.dayOfYear(),
        week_number: now.isoWeek(),
        abbreviation: now.zoneAbbr(),
        source: 'Local Fallback'
    };
};

// ── MAIN FUNCTION WITH SMART ROTATION ───────────────────────────────────
const getTimeData = async (timezone) => {
    let lastError = null;
    
    for (const provider of TIME_PROVIDERS) {
        if (!provider.enabled) continue;
        
        try {
            console.log(`⏰ Trying ${provider.name}...`);
            const result = await provider.execute(timezone);
            console.log(`✅ ${provider.name} successful`);
            return result;
        } catch (error) {
            console.warn(`❌ ${provider.name} failed:`, error.message);
            lastError = error;
            continue;
        }
    }
    
    // All APIs failed, use local fallback
    console.warn(`⚠️ All APIs failed, using local fallback`);
    return getLocalFallback(timezone);
};

// ── USER TIMEZONE MANAGEMENT ────────────────────────────────────────────
const getUserTimezone = (userId) => {
    const envKey = `USER_TZ_${userId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    if (process.env[envKey]) return process.env[envKey];
    
    if (fs.existsSync(DB_PATH)) {
        try {
            const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
            if (db[userId]) return db[userId];
        } catch {}
    }
    
    return 'Africa/Lagos'; // Default
};

const saveUserTimezone = (userId, region) => {
    // Save to JSON
    const db = fs.existsSync(DB_PATH) ? JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) : {};
    db[userId] = region;
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    
    // Save to .env
    const envKey = `USER_TZ_${userId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    let envContent = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
    envContent = envContent.replace(new RegExp(`${envKey}=.*\\n?`, 'g'), '');
    envContent += `${envKey}=${region}\n`;
    fs.writeFileSync(ENV_PATH, envContent);
};

// ── TIMEZONE MAPPING ────────────────────────────────────────────────────
const TIMEZONE_MAP = {
    'lagos': 'Africa/Lagos',
    'london': 'Europe/London',
    'new york': 'America/New_York',
    'tokyo': 'Asia/Tokyo',
    'dubai': 'Asia/Dubai',
    'paris': 'Europe/Paris',
    'abuja': 'Africa/Lagos',
    'ikeja': 'Africa/Lagos',
    'manila': 'Asia/Manila',
    'sydney': 'Australia/Sydney'
};

const getTimezone = (region) => {
    const key = (region || '').toLowerCase().trim();
    return TIMEZONE_MAP[key] || region;
};

module.exports = {
    getUserTimezone,
    saveUserTimezone,
    getTimeData,
    getTimezone
};
