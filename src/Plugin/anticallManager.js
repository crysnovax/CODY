const fs = require('fs');
const path = require('path');
const { identityVariants, isPhoneJid } = require('./identityUtils');

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

async function isIdentityInList(sock, jid, list = []) {
    if (!jid || !Array.isArray(list) || !list.length) return false;
    const callerIds = await identityVariants(sock, normalizeJid(jid));
    for (const item of list) {
        const itemIds = await identityVariants(sock, normalizeJid(item));
        if ([...callerIds].some(id => itemIds.has(id))) return true;
    }
    return false;
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

function getUnknownCallReason(config) {
    const configuredUnknownReason = typeof config.unknownReason === 'string' &&
        config.unknownReason.trim() && config.unknownReason !== defaultConfig.unknownReason
        ? config.unknownReason
        : null;
    const configuredReason = typeof config.reason === 'string' &&
        config.reason.trim() && config.reason !== defaultConfig.reason
        ? config.reason
        : null;

    return configuredUnknownReason || configuredReason || config.unknownReason || defaultConfig.unknownReason;
}

async function sendCallRejection(sock, call, reason) {
    let rejected = false;
    try {
        if (typeof sock.rejectCall === 'function') {
            await sock.rejectCall(call.id, call.from);
            rejected = true;
        }
    } catch (error) {
        console.error('[ANTICALL REJECT ERROR]', error?.message || error);
    }

    const candidates = [call?.from, call?.fromAlt].filter(Boolean);
    const recipients = new Set();
    for (const candidate of candidates) {
        recipients.add(normalizeJid(candidate));
        for (const variant of await identityVariants(sock, normalizeJid(candidate))) {
            recipients.add(normalizeJid(variant));
        }
    }
    const orderedRecipients = [...recipients].filter(jid =>
        jid.endsWith('@s.whatsapp.net') || jid.endsWith('@c.us') || jid.endsWith('@lid')
    ).sort((left, right) => Number(isPhoneJid(right)) - Number(isPhoneJid(left)));

    let reasonSent = false;
    let lastError = null;
    for (const recipient of orderedRecipients) {
        try {
            await sock.sendMessage(recipient, { text: String(reason) });
            reasonSent = true;
            break;
        } catch (error) {
            lastError = error;
        }
    }
    if (!reasonSent && lastError) {
        console.error('[ANTICALL REASON SEND ERROR]', lastError?.message || lastError);
    }
    return { rejected, reasonSent };
}

async function handleIncomingCall(sock, call, config) {
    if (!call || call.status !== 'offer' || !call.from) return { blocked: false };
    if (!Array.isArray(config.whitelist)) config.whitelist = [];
    if (!Array.isArray(config.blacklist)) config.blacklist = [];
    if (!Array.isArray(config.pendingPhoneReject)) config.pendingPhoneReject = [];

    const callerJid = normalizeJid(call.from);
    if (await isIdentityInList(sock, callerJid, config.whitelist)) {
        return { blocked: false, whitelisted: true, callerJid };
    }

    const callerVariants = await identityVariants(sock, callerJid);
    const callerPhoneJid = [...callerVariants].find(isPhoneJid);
    const callerPhone = callerPhoneJid?.split('@')[0] || null;
    const pendingIndex = callerPhone
        ? config.pendingPhoneReject.findIndex(value => String(value).replace(/\D/g, '') === callerPhone)
        : -1;

    // A pending phone entry is already an explicit reject-list decision.
    // Upgrade it to a canonical JID before consulting the unknown-caller
    // switch, so its configured reason is never replaced by unknownReason.
    if (pendingIndex >= 0) {
        config.pendingPhoneReject.splice(pendingIndex, 1);
        for (const jid of [callerPhoneJid, callerJid]) {
            if (jid && !config.blacklist.some(item => normalizeJid(item) === normalizeJid(jid))) {
                config.blacklist.push(normalizeJid(jid));
            }
        }
        saveConfig(config);
        const reason = config.reason || defaultConfig.reason;
        const delivery = await sendCallRejection(sock, call, reason);
        return { blocked: true, unknown: false, callerJid, reason, ...delivery };
    }

    if (await isIdentityInList(sock, callerJid, config.blacklist)) {
        const reason = config.reason || defaultConfig.reason;
        const delivery = await sendCallRejection(sock, call, reason);
        return { blocked: true, unknown: false, callerJid, reason, ...delivery };
    }

    if (!config.enabled) return { blocked: false, callerJid };
    if (!isWithinSchedule(config.schedule || defaultConfig.schedule)) {
        return { blocked: false, callerJid, outsideSchedule: true };
    }

    const reason = getUnknownCallReason(config);
    const delivery = await sendCallRejection(sock, call, reason);
    return { blocked: true, unknown: true, callerJid, reason, ...delivery };
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
    isIdentityInList,
    handleIncomingCall,
    normalizeJid,
    findLidForPhone,
    defaultConfig
};
