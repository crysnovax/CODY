const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(process.cwd(), 'database', 'anticall.json');

const defaultConfig = {
    enabled: false,                      // OFF by default
    reason: '`📵 CALL N⚉T PERMITTED ✐`',
    unknownReason: '`📵 Unknown number – call blocked.`',
    schedule: {
        enabled: false,
        type: 'always',
        start: '22:00',
        end: '06:00',
        days: [],
        dates: [],
        months: []
    },
    blacklist: [],
    whitelist: [],
    pendingPhoneReject: []
};

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            return { ...defaultConfig, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
        }
    } catch {}
    // The deploy starter may provide the initial value through ANTI_CALL, but
    // an existing JSON file remains authoritative after first configuration.
    const envEnabled = process.env.ANTI_CALL;
    return {
        ...defaultConfig,
        enabled: envEnabled === undefined ? defaultConfig.enabled :
            ['true', '1', 'yes', 'on'].includes(String(envEnabled).trim().toLowerCase())
    };
}

function saveConfig(config) {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function normalizeJid(jid) {
    if (!jid) return '';
    let cleaned = jid.trim().toLowerCase();
    cleaned = cleaned.replace(/:\d+(@|$)/, '$1');
    return cleaned;
}

function isInBlacklist(jid, blacklist) {
    const norm = normalizeJid(jid);
    return blacklist.some(item => normalizeJid(item) === norm);
}

function isInWhitelist(jid, whitelist) {
    const norm = normalizeJid(jid);
    return whitelist.some(item => normalizeJid(item) === norm);
}

function isWithinSchedule(schedule) {
    if (!schedule.enabled) return true;
    const now = new Date();

    if (schedule.type === 'once') {
        const start = new Date(schedule.start);
        const end = new Date(schedule.end);
        return now >= start && now <= end;
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = schedule.start.split(':').map(Number);
    const [endH, endM] = schedule.end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    let timeOk = false;
    if (endMinutes >= startMinutes) {
        timeOk = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
        timeOk = currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
    if (!timeOk) return false;

    if (schedule.days?.length) {
        const day = now.getDay();
        if (!schedule.days.includes(day)) return false;
    }
    if (schedule.dates?.length) {
        const date = now.getDate();
        if (!schedule.dates.includes(date)) return false;
    }
    if (schedule.months?.length) {
        const month = now.getMonth();
        if (!schedule.months.includes(month)) return false;
    }
    return true;
}

function findLidForPhone(phone) {
    const sessionsDir = path.join(process.cwd(), 'sessions');
    try {
        const files = fs.readdirSync(sessionsDir).filter(f => f.startsWith('lid-mapping'));
        for (const file of files) {
            const content = JSON.parse(fs.readFileSync(path.join(sessionsDir, file), 'utf8'));
            for (const [lid, jid] of Object.entries(content)) {
                if (jid.includes(phone)) {
                    return lid;
                }
            }
        }
    } catch (e) {}
    return null;
}

module.exports = {
    loadConfig,
    saveConfig,
    isWithinSchedule,
    isInBlacklist,
    isInWhitelist,
    normalizeJid,
    findLidForPhone,
    defaultConfig
};
