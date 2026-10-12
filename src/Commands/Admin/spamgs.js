'use strict';
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { proto } = require('plogme');
const { canRunBroadcast, broadcastAccessMessage } = require('../../Plugin/broadcastAccess');
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
async function postStatus(sock, source, groups) {
    let sent = 0;
    for (const group of groups) {
        try {
            // Group JIDs are not valid statusJidList recipients. Send the
            // message directly to each group and mark it as a native group
            // status so WhatsApp renders it in that group's status surface.
            await sock.sendMessage(group, {
                forward: source,
                force: true,
                groupStatus: true,
            });
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
        try { total += await postStatus(sock, schedule.source, groups); } catch (error) { console.error('[SPAMGS]', error?.message || error); }
        if (i + 1 < schedule.repeat) await new Promise(resolve => setTimeout(resolve, schedule.delayMs));
    }
    return total;
}
function stopJob(id) { try { jobs.get(id)?.stop(); } catch {} jobs.delete(id); }
function startJob(sock, schedule) {
    stopJob(schedule.id);
    const job = cron.schedule(schedule.cron, () => runSchedule(sock, schedule));
    jobs.set(schedule.id, job);
}
function setupSpamSchedules(sock) { for (const schedule of schedules) if (schedule?.cron) startJob(sock, schedule); }
module.exports = {
    name: 'spamgs',
    alias: ['groupstatusspam', 'statusspam'],
    desc: 'Post a quoted message as group status repeatedly or daily',
    category: 'Admin',
    groupOnly: false,
    adminOnly: false,
    reactions: { start: '📣', success: '✅' },
    setupSpamSchedules,
    execute: async (sock, m, { args, reply, prefix, isOwner, isDual, isAdmin, isGroupAdmin }) => {
        if (!canRunBroadcast(m, { isOwner, isDual, isAdmin, isGroupAdmin })) {
            return reply(broadcastAccessMessage(m));
        }
        const sub = String(args[0] || '').toLowerCase();
        if (sub === 'list') {
            if (!schedules.length) return reply('No daily spamgs schedules are active.');
            return reply(`*SpamGS schedules*\n${schedules.map(s => `• ${s.id}: ${s.time}, ${s.repeat}x every ${s.delay}`).join('\n')}`);
        }
        if (sub === 'cancel') {
            const removed = schedules.length;
            for (const s of schedules) stopJob(s.id);
            schedules = [];
            save();
            return reply(`Cancelled ${removed} spamgs schedule(s).`);
        }
        const repeat = Number(args[0] || 1);
        const delayMs = duration(args[1] || '1s');
        const isDaily = String(args[2] || '').toLowerCase() === 'daily';
        const dailyTime = args[3];
        const textStart = isDaily ? 4 : 2;
        const statusText = args.slice(textStart).join(' ').trim();
        const source = m.quoted?.fakeObj || (statusText ? proto.WebMessageInfo.fromObject({ key: { remoteJid: m.chat, fromMe: true, id: `SPAMGS-${Date.now()}` }, message: { conversation: statusText } }) : null);
        if (!Number.isInteger(repeat) || repeat < 1 || repeat > 20 || !delayMs || !source) {
            return reply(`Usage: ${prefix}spamgs <repeat> <delay> [daily HH:MM]\nReply to any message, e.g. ${prefix}spamgs 3 5s or ${prefix}spamgs 2 10s daily 18:30`);
        }
        if (isDaily) {
            const cronExpr = timeCron(dailyTime);
            if (!cronExpr) return reply('Invalid daily time. Use 24-hour HH:MM, for example 18:30.');
            const id = `${m.chat}-${Date.now()}`;
            const schedule = { id, cron: cronExpr, time: dailyTime, repeat, delayMs, delay: args[1], source };
            schedules.push(schedule);
            save();
            startJob(sock, schedule);
            return reply(`📅 Daily spamgs schedule saved at ${dailyTime}: ${repeat}x with ${args[1]} delay.`);
        }
        const total = await runSchedule(sock, { repeat, delayMs, source });
        return reply(`📣 Group status posted ${repeat} time(s) to ${total / repeat} group(s).`);
    }
};
