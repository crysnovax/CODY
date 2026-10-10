'use strict';
const fs = require('fs');
const path = require('path');
const { normalizeJid } = require('../../Plugin/identityUtils');
const DB_PATH = path.join(process.cwd(), 'database', 'slowmode.json');
const lastMessageAt = new Map();
const lastNoticeAt = new Map();
function readDB() {
    try { return fs.existsSync(DB_PATH) ? JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) : {}; }
    catch { return {}; }
}
function writeDB(db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
function parseDuration(input) {
    const match = String(input || '').trim().match(/^(\d+)(s|m|h)$/i);
    if (!match) return null;
    const amount = Number(match[1]);
    const ms = amount * ({ s: 1000, m: 60_000, h: 3_600_000 }[match[2].toLowerCase()]);
    return amount >= 1 && ms <= 86_400_000 ? ms : null;
}
function groupParticipant(metadata, candidates) {
    const ids = new Set(candidates.filter(Boolean).map(normalizeJid));
    return (metadata?.participants || []).find(person =>
        [person.id, person.jid, person.lid, person.phoneNumber].filter(Boolean).map(normalizeJid).some(id => ids.has(id))
    );
}
const plugin = {
    name: 'slowmode',
    alias: ['slow'],
    desc: 'Limit how often non-admin members can post in a group',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,
    execute: async (sock, m, { args = [], reply }) => {
        const db = readDB();
        const cfg = db[m.chat] || (db[m.chat] = { enabled: false, intervalMs: 10_000 });
        const sub = String(args[0] || 'status').toLowerCase();
        if (sub === 'status') return reply(`*Slowmode*\n• Status: ${cfg.enabled ? 'ON' : 'OFF'}\n• Interval: ${Math.round((cfg.intervalMs || 10_000) / 1000)}s\n\nCommands:\n• .slowmode 10s\n• .slowmode on / off\n• .slowmode status`);
        if (sub === 'off') {
            cfg.enabled = false;
            writeDB(db);
            return reply('Slowmode disabled.');
        }
        if (sub === 'on') {
            cfg.enabled = true;
            if (!Number.isFinite(cfg.intervalMs) || cfg.intervalMs < 1000) cfg.intervalMs = 10_000;
            writeDB(db);
            return reply(`Slowmode enabled: one message every ${Math.round(cfg.intervalMs / 1000)}s for non-admin members.`);
        }
        const interval = parseDuration(sub);
        if (!interval) return reply('Usage: .slowmode <1s–24h> | on | off | status');
        cfg.enabled = true;
        cfg.intervalMs = interval;
        writeDB(db);
        return reply(`Slowmode enabled: one message every ${args[0]} for non-admin members.`);
    },
    handleSlowmode: async function handleSlowmode(sock, m, mek) {
        try {
            if (!m?.isGroup || m.key?.fromMe || !m.sender) return false;
            const cfg = readDB()[m.chat];
            if (!cfg?.enabled || !Number.isFinite(cfg.intervalMs) || cfg.intervalMs < 1000) return false;
            const now = Date.now();
            const metadata = await sock.groupMetadata(m.chat).catch(() => null);
            const senderIds = [m.sender, m.key?.participant, m.key?.participantAlt];
            const sender = groupParticipant(metadata, senderIds);
            if (sender?.admin === 'admin' || sender?.admin === 'superadmin') return false;
            const bot = groupParticipant(metadata, [sock.user?.id, sock.user?.lid]);
            if (!bot || !['admin', 'superadmin'].includes(bot.admin)) {
                const key = `bot-admin:${m.chat}`;
                if (now - (lastNoticeAt.get(key) || 0) > 300_000) {
                    lastNoticeAt.set(key, now);
                    await sock.sendMessage(m.chat, { text: 'Slowmode needs the bot to be a group admin so it can remove extra messages.' }, { quoted: mek }).catch(() => {});
                }
                return false;
            }
            const senderId = normalizeJid(m.sender);
            const key = `${m.chat}:${senderId}`;
            const previous = lastMessageAt.get(key);
            lastMessageAt.set(key, now);
            if (!previous || now - previous >= cfg.intervalMs) return false;
            try {
                await sock.sendMessage(m.chat, { delete: mek?.key || m.key });
            } catch (error) {
                console.error('[SLOWMODE DELETE ERROR]', error?.stack || error?.message || error);
                return false;
            }
            try {
                require('../../Plugin/modLog').recordAction(m.chat, {
                    command: 'slowmode', actor: m.sender, target: m.sender, action: 'delete',
                });
            } catch {}
            const noticeKey = `member:${key}`;
            if (now - (lastNoticeAt.get(noticeKey) || 0) > cfg.intervalMs) {
                lastNoticeAt.set(noticeKey, now);
                await sock.sendMessage(m.chat, {
                    text: `@${senderId.split('@')[0]} slowmode is on. Please wait ${Math.ceil((cfg.intervalMs - (now - previous)) / 1000)}s before posting again.`,
                    mentions: [m.sender],
                }, { quoted: mek }).catch(() => {});
            }
            return true;
        } catch (error) {
            console.error('[SLOWMODE ERROR]', error?.stack || error?.message || error);
            return false;
        }
    },
};
plugin.parseDuration = parseDuration;
plugin.readDB = readDB;
plugin.writeDB = writeDB;
module.exports = plugin;
