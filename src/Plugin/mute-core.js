/**
 * mute-core.js — shared state and helpers for mute/unmute commands
 * Place in: src/Plugin/mute-core.js (or wherever your shared plugins live)
 */
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { getCronOptions } = require('../Utils/timezone');

const SCHEDULE_FILE = path.join(process.cwd(), 'database', 'mute-schedules.json');

let schedules = [];
let activeCrons = {};
if (!global.muteTimers) global.muteTimers = {};

// ── Load schedules ────────────────────────────────────────────
try {
    if (fs.existsSync(SCHEDULE_FILE)) {
        schedules = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
    }
} catch (err) {
    console.error('[MUTE] Failed to load schedules:', err.message);
}

function saveSchedules() {
    try {
        fs.mkdirSync(path.dirname(SCHEDULE_FILE), { recursive: true });
        fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedules, null, 2));
    } catch (err) {
        console.error('[MUTE] Failed to save schedules:', err.message);
    }
}

// ── Time helpers ──────────────────────────────────────────────
function timeToCron(timeStr) {
    const match = timeStr.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/i);
    if (!match) return null;
    let hour = parseInt(match[1]);
    const min = match[2] ? parseInt(match[2]) : 0;
    const period = match[3]?.toLowerCase();
    if (period === 'pm' && hour < 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    if (hour < 0 || hour > 23 || min < 0 || min > 59) return null;
    return `${min} ${hour} * * *`;
}

function parseTime(str) {
    const match = str?.match(/^(\d+)(s|m|h|d|w)$/i);
    if (!match) return null;
    const map = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
    return parseInt(match[1]) * map[match[2].toLowerCase()];
}

// ── Setup on boot ─────────────────────────────────────────────
function setupMuteSchedules(sock) {
    for (const job of Object.values(activeCrons)) {
        try { job.stop(); } catch {}
    }
    activeCrons = {};

    const now = Date.now();
    const active = schedules.filter(sch => !sch.once || new Date(sch.time) > now);

    for (const sch of active) {
        try {
            const job = cron.schedule(sch.cron, async () => {
                try {
                    await sock.groupSettingUpdate(sch.group, sch.action === 'mute' ? 'announcement' : 'not_announcement');
                    await sock.sendMessage(sch.group, {
                        text: sch.action === 'mute'
                            ? '🔇 _Group auto-muted (scheduled)_'
                            : '🔊 _Group auto-unmuted (scheduled)_'
                    });
                    if (sch.once) {
                        schedules = schedules.filter(s => s.id !== sch.id);
                        saveSchedules();
                        activeCrons[sch.id]?.stop();
                        delete activeCrons[sch.id];
                    }
                } catch (err) {
                    console.error('[SCHED MUTE]', err.message);
                }
            }, getCronOptions());
            activeCrons[sch.id] = job;
        } catch (err) {
            console.error('[CRON SETUP]', sch.id, err.message);
        }
    }

    if (active.length) console.log(`[MUTE] Restored ${active.length} schedule(s)`);
}

module.exports = {
    get schedules()       { return schedules; },
    set schedules(val)    { schedules = val; },
    get activeCrons()     { return activeCrons; },
    set activeCrons(val)  { activeCrons = val; },
    saveSchedules,
    timeToCron,
    parseTime,
    setupMuteSchedules
};
