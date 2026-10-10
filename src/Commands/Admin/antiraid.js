'use strict';
const fs = require('fs');
const path = require('path');
const { normalizeJid } = require('../../Plugin/identityUtils');
const DB_PATH = path.join(process.cwd(), 'database', 'antiraid.json');
const timers = new Map();
function readDB() {
    try { return fs.existsSync(DB_PATH) ? JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) : {}; }
    catch { return {}; }
}
function writeDB(db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
function parseDuration(value) {
    const match = String(value || '').trim().match(/^(\d+)(s|m|h|d)$/i);
    if (!match) return null;
    const amount = Number(match[1]);
    if (amount < 1 || amount > 1440) return null;
    return amount * ({ s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2].toLowerCase()]);
}
function parseThreshold(value) {
    const match = String(value || '').trim().match(/^(\d+)\/(\d+[smhd])$/i);
    if (!match) return null;
    const count = Number(match[1]);
    const windowMs = parseDuration(match[2]);
    if (count < 2 || count > 100 || !windowMs || windowMs > 7 * 86_400_000) return null;
    return { count, windowMs };
}
function participantIds(participant) {
    const values = typeof participant === 'string'
        ? [participant]
        : [participant?.id, participant?.jid, participant?.lid, participant?.phoneNumber];
    return [...new Set(values.filter(Boolean).map(normalizeJid))];
}
function isApprovalOn(metadata) {
    const value = metadata?.joinApprovalMode ?? metadata?.joinApproval?.enabled ?? metadata?.join_approval_mode;
    return value === true || value === 'on' || value === 'enabled';
}
function scheduleRestore(sock, group, restoreAt) {
    if (timers.has(group)) clearTimeout(timers.get(group));
    const wait = Math.max(0, restoreAt - Date.now());
    const timer = setTimeout(async () => {
        timers.delete(group);
        const db = readDB();
        const cfg = db[group];
        if (!cfg?.approvalChangedByRaid || !cfg.approvalUntil || cfg.approvalUntil > Date.now()) return;
        try {
            await sock.groupJoinApprovalMode(group, 'off');
            cfg.approvalChangedByRaid = false;
            cfg.approvalUntil = 0;
            writeDB(db);
            await sock.sendMessage(group, { text: 'Anti-raid temporary join approval has ended.' }).catch(() => {});
        } catch (error) {
            console.error('[ANTIRAID RESTORE ERROR]', error?.stack || error?.message || error);
        }
    }, Math.min(wait, 2_147_000_000));
    timer.unref?.();
    timers.set(group, timer);
}
async function restoreTemporaryApprovals(sock) {
    const db = readDB();
    for (const [group, cfg] of Object.entries(db)) {
        if (!cfg?.approvalChangedByRaid || !cfg.approvalUntil) continue;
        if (cfg.approvalUntil <= Date.now()) {
            try {
                await sock.groupJoinApprovalMode(group, 'off');
                cfg.approvalChangedByRaid = false;
                cfg.approvalUntil = 0;
                writeDB(db);
            } catch (error) {
                console.error('[ANTIRAID RESTORE ERROR]', error?.message || error);
            }
        } else scheduleRestore(sock, group, cfg.approvalUntil);
    }
}
function cancelApprovalRestore(group) {
    const timer = timers.get(group);
    if (timer) clearTimeout(timer);
    timers.delete(group);
    const db = readDB();
    const config = db[group];
    if (!config) return false;
    config.approvalChangedByRaid = false;
    config.approvalUntil = 0;
    writeDB(db);
    return true;
}
async function activateRaidResponse(sock, group, config, db) {
    const now = Date.now();
    config.cooldownUntil = now + config.cooldownMs;
    config.lastTriggeredAt = now;
    if (config.action === 'approval') {
        if (typeof sock.groupJoinApprovalMode !== 'function') {
            config.lastActionError = 'join approval API unavailable';
            writeDB(db);
            return false;
        }
        const metadata = await sock.groupMetadata(group).catch(() => null);
        const botIds = [sock.user?.id, sock.user?.lid].filter(Boolean).map(normalizeJid);
        const bot = metadata?.participants?.find(person => participantIds(person).some(id => botIds.includes(id)));
        if (!bot || !['admin', 'superadmin'].includes(bot.admin)) {
            config.lastActionError = 'bot is not a group admin';
            writeDB(db);
            await sock.sendMessage(group, { text: 'Anti-raid detected a join burst, but the bot needs group-admin permission to enable join approval.' }).catch(() => {});
            return false;
        }
        const wasEnabled = isApprovalOn(metadata);
        config.approvalChangedByRaid = !wasEnabled;
        config.approvalUntil = wasEnabled ? 0 : now + config.cooldownMs;
        try {
            if (!wasEnabled) await sock.groupJoinApprovalMode(group, 'on');
            config.lastActionError = '';
            writeDB(db);
            if (!wasEnabled) scheduleRestore(sock, group, config.approvalUntil);
        } catch (error) {
            config.approvalChangedByRaid = false;
            config.approvalUntil = 0;
            config.lastActionError = String(error?.message || error).slice(0, 160);
            writeDB(db);
            console.error('[ANTIRAID APPROVAL ERROR]', error?.stack || error?.message || error);
            await sock.sendMessage(group, { text: 'Anti-raid detected a join burst, but WhatsApp rejected the temporary join-approval change.' }).catch(() => {});
            return false;
        }
    }
    try {
        require('../../Plugin/modLog').recordAction(group, {
            command: 'antiraid', action: config.action === 'approval' ? 'temporary join approval' : 'notify',
        });
    } catch {}
    await sock.sendMessage(group, {
        text: `Anti-raid detected ${config.recentJoins.length} member joins within ${Math.round(config.windowMs / 60_000) || 1} minute(s).${config.action === 'approval' ? ` Join approval is ${config.approvalChangedByRaid ? `temporarily enabled for ${Math.round(config.cooldownMs / 60_000) || 1} minute(s)` : 'already enabled'}.` : ''}`,
    }).catch(() => {});
    return true;
}
async function handleParticipantUpdate(sock, update) {
    if (!update?.id || update.action !== 'add') return false;
    const db = readDB();
    const config = db[update.id];
    if (!config?.enabled) return false;
    const now = Date.now();
    const windowMs = Number(config.windowMs) || 600_000;
    const joins = Array.isArray(config.recentJoins) ? config.recentJoins : [];
    for (const participant of update.participants || []) {
        const jid = participantIds(participant)[0];
        if (jid) joins.push({ jid, timestamp: now });
    }
    config.recentJoins = joins.filter(entry => Number.isFinite(entry.timestamp) && now - entry.timestamp <= windowMs);
    writeDB(db);
    if (config.cooldownUntil && config.cooldownUntil > now) return false;
    if (config.recentJoins.length < (Number(config.threshold) || 5)) return false;
    return activateRaidResponse(sock, update.id, config, db);
}
const plugin = {
    name: 'antiraid',
    alias: ['raidguard'],
    desc: 'Detect join bursts and temporarily require join approval',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,
    execute: async (sock, m, { args = [], reply }) => {
        const db = readDB();
        const config = db[m.chat] || (db[m.chat] = {
            enabled: false, threshold: 5, windowMs: 600_000, cooldownMs: 1_800_000,
            action: 'approval', recentJoins: [], approvalChangedByRaid: false, approvalUntil: 0,
        });
        const sub = String(args[0] || 'status').toLowerCase();
        if (sub === 'status') {
            return reply(`*Anti-Raid*\n• Status: ${config.enabled ? 'ON' : 'OFF'}\n• Threshold: ${config.threshold} joins / ${Math.round(config.windowMs / 60_000)}m\n• Action: ${config.action}\n• Cooldown: ${Math.round(config.cooldownMs / 60_000)}m\n\nCommands:\n• .antiraid on / off\n• .antiraid threshold 5/10m\n• .antiraid action approval / notify\n• .antiraid cooldown 30m`);
        }
        if (sub === 'on' || sub === 'off') {
            config.enabled = sub === 'on';
            if (sub === 'off' && config.approvalChangedByRaid && config.approvalUntil) {
                config.restoreWhenDisabled = true;
            }
            writeDB(db);
            return reply(`Anti-Raid ${config.enabled ? 'enabled' : 'disabled'}.`);
        }
        if (sub === 'threshold') {
            const parsed = parseThreshold(args[1]);
            if (!parsed) return reply('Usage: .antiraid threshold <count>/<window> (example: 5/10m)');
            config.threshold = parsed.count;
            config.windowMs = parsed.windowMs;
            writeDB(db);
            return reply(`Anti-Raid threshold set to ${parsed.count} joins in ${args[1]}.`);
        }
        if (sub === 'action') {
            const action = String(args[1] || '').toLowerCase();
            if (!['approval', 'notify'].includes(action)) return reply('Usage: .antiraid action approval | notify');
            config.action = action;
            writeDB(db);
            return reply(`Anti-Raid action set to ${action}.`);
        }
        if (sub === 'cooldown') {
            const duration = parseDuration(args[1]);
            if (!duration || duration < 60_000 || duration > 86_400_000) return reply('Usage: .antiraid cooldown <1m-24h>');
            config.cooldownMs = duration;
            writeDB(db);
            return reply(`Anti-Raid response cooldown set to ${args[1]}.`);
        }
        return reply('Usage: .antiraid status | on | off | threshold <count>/<window> | action approval|notify | cooldown <duration>');
    },
    handleParticipantUpdate,
    restoreTemporaryApprovals,
    cancelApprovalRestore,
    parseDuration,
    parseThreshold,
    readDB,
    writeDB,
    stopTimers() { for (const timer of timers.values()) clearTimeout(timer); timers.clear(); },
};
module.exports = plugin;
