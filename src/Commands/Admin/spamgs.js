'use strict';
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { canRunBroadcast, broadcastAccessMessage } = require('../../Plugin/broadcastAccess');
const { createGroupStatusPayload } = require('../../Utils/groupStatus');
const { getCronOptions, getBotTimezone } = require('../../Utils/timezone');
const DB_PATH = path.join(process.cwd(), 'database', 'spamgs-schedules.json');
let schedules = [];
const jobs = new Map();
try { if (fs.existsSync(DB_PATH)) schedules = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { schedules = []; }
function save() { fs.mkdirSync(path.dirname(DB_PATH), { recursive: true }); fs.writeFileSync(DB_PATH, JSON.stringify(schedules, null, 2)); }
function duration(value) {
    const match = String(value || '').match(/^(\d+)(s|m|h)$/i);
    if (!match) return null;
    const ms = Number(match[1]) * ({ s: 1000, m: 60000, h: 3600000 }[match[2].toLowerCase()]);
    return ms >= 1000 && ms <= 3600000 ? ms : null;
}
function timeCron(value) {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
    return `${Number(match[2])} ${Number(match[1])} * * *`;
}
async function groupsOf(sock) {
    if (typeof sock.groupFetchAllParticipating !== 'function') return [];
    const all = await sock.groupFetchAllParticipating().catch(() => null);
    return Object.keys(all || {}).filter(jid => jid.endsWith('@g.us'));
}
async function postStatus(sock, source, groups, caption = '') {
    if (typeof sock.sendGroupStatus !== 'function') {
        throw new Error('sendGroupStatus is unavailable; CODY requires plogme 2.2.0 or newer.');
    }
    const payload = await createGroupStatusPayload(source, caption);
    let sent = 0;
    for (const group of groups) {
        try {
            await sock.sendGroupStatus(group, payload);
            sent += 1;
        } catch (error) {
            console.error('[SPAMGS]', group, error?.message || error);
        }
    }
    return sent;
}
async function runSchedule(sock, schedule) {
    const groups = await groupsOf(sock);
    let total = 0;
    for (let i = 0; i < schedule.repeat; i++) {
        try { total += await postStatus(sock, schedule.source, groups, schedule.caption || ''); }
        catch (error) { console.error('[SPAMGS]', error?.message || error); }
        if (i + 1 < schedule.repeat) await new Promise(resolve => setTimeout(resolve, schedule.delayMs));
    }
    return { total, groupCount: groups.length };
}
function stopJob(id) { try { jobs.get(id)?.stop(); } catch {} jobs.delete(id); }
function startJob(sock, schedule) {
    stopJob(schedule.id);
    const job = cron.schedule(schedule.cron, () => runSchedule(sock, schedule), getCronOptions());
    jobs.set(schedule.id, job);
}
function setupSpamSchedules(sock) { for (const schedule of schedules) if (schedule?.cron) startJob(sock, schedule); }
function usage(prefix) {
    return `Usage: ${prefix}spamgs [repeat] [delay] [daily HH:MM] <image-URL and caption>\nReply to an image or text to use it instead. Example: ${prefix}spamgs https://example.com/photo.jpg My caption`;
}
module.exports = {
    name: 'spamgs',
    alias: ['groupstatusspam', 'statusspam'],
    desc: 'Send native group statuses repeatedly or on a daily schedule',
    category: 'Admin',
    groupOnly: false,
    adminOnly: false,
    reactions: { start: '📣', success: '✅' },
    setupSpamSchedules,
    execute: async (sock, m, { args = [], reply, prefix = '.', isOwner, isDual, isAdmin, isGroupAdmin }) => {
        if (!canRunBroadcast(m, { isOwner, isDual, isAdmin, isGroupAdmin })) {
            return reply(broadcastAccessMessage(m));
        }
        const sub = String(args[0] || '').toLowerCase();
        if (sub === 'list') {
            if (!schedules.length) return reply('No daily spamgs schedules are active.');
            return reply(`*SpamGS schedules (${getBotTimezone()})*\n${schedules.map(s => `• ${s.id}: ${s.time}, ${s.repeat}x every ${s.delay}`).join('\n')}`);
        }
        if (sub === 'cancel') {
            const removed = schedules.length;
            for (const s of schedules) stopJob(s.id);
            schedules = [];
            save();
            return reply(`Cancelled ${removed} spamgs schedule(s).`);
        }

        let repeat = 1;
        let delay = '1s';
        let delayMs = duration(delay);
        let isDaily = false;
        let dailyTime;
        let contentStart = 0;
        const firstIsCount = /^\d+$/.test(String(args[0] || ''));
        if (firstIsCount && (args.length === 1 || duration(args[1]) || String(args[2] || '').toLowerCase() === 'daily')) {
            repeat = Number(args[0]);
            delay = args[1] || '1s';
            delayMs = duration(delay);
            contentStart = args[1] ? 2 : 1;
            if (String(args[2] || '').toLowerCase() === 'daily') {
                isDaily = true;
                dailyTime = args[3];
                contentStart = 4;
            }
            if (!Number.isInteger(repeat) || repeat < 1 || repeat > 20 || !delayMs) {
                return reply(usage(prefix));
            }
        }

        const contentText = args.slice(contentStart).join(' ').trim();
        const source = m.quoted || contentText;
        const storedSource = m.quoted?.fakeObj || contentText;
        const caption = m.quoted ? contentText : '';
        if (!source) return reply(usage(prefix));
        if (typeof sock.sendGroupStatus !== 'function') {
            return reply('This command requires plogme 2.2.0 or newer with sendGroupStatus support.');
        }

        if (isDaily) {
            const cronExpr = timeCron(dailyTime);
            if (!cronExpr) return reply('Invalid daily time. Use 24-hour HH:MM, for example 18:30.');
            const id = `${m.chat}-${Date.now()}`;
            const schedule = { id, cron: cronExpr, time: dailyTime, repeat, delayMs, delay, source: storedSource, caption };
            schedules.push(schedule);
            save();
            startJob(sock, schedule);
            return reply(`📅 Daily native group-status schedule saved at ${dailyTime} (${getBotTimezone()}): ${repeat}x with ${delay} delay.`);
        }

        const result = await runSchedule(sock, { repeat, delayMs, source, caption });
        return reply(`📣 Native group status posted ${repeat} time(s) to ${result.groupCount} group(s); ${result.total} successful post(s).`);
    }
};
