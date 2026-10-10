'use strict';
const fs = require('fs');
const path = require('path');
const { normalizeJid, resolvePhoneJid } = require('../../Plugin/identityUtils');
const { stripQuotedDeep } = require('../../Plugin/antiText');
const { getMessageText, hasLink } = require('./antilink');

const DB_PATH = path.join(process.cwd(), 'database', 'antinewcomer.json');
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
    if (amount < 1 || amount > 365) return null;
    return amount * ({ s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2].toLowerCase()]);
}
function participantIds(participant) {
    const values = typeof participant === 'string'
        ? [participant]
        : [participant?.id, participant?.jid, participant?.lid, participant?.phoneNumber];
    return [...new Set(values.filter(Boolean).map(normalizeJid))];
}
function handleParticipantUpdate(update) {
    if (!update?.id || !['add', 'remove'].includes(update.action)) return false;
    const db = readDB();
    const config = db[update.id];
    // Only retain join history for groups where an admin configured this feature.
    if (!config) return false;
    if (!config.joined || typeof config.joined !== 'object') config.joined = {};
    for (const participant of update.participants || []) {
        for (const jid of participantIds(participant)) {
            if (update.action === 'add') config.joined[jid] = Date.now();
            else delete config.joined[jid];
        }
    }
    writeDB(db);
    return true;
}

const plugin = {
    name: 'antinewcomer',
    alias: ['newcomerlinks', 'antilinknew'],
    desc: 'Block links from new members for a configurable period after joining',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,
    reactions: { start: '🛡️', success: '🚫' },
    execute: async (sock, m, { args = [], reply }) => {
        const db = readDB();
        const config = db[m.chat] || (db[m.chat] = { enabled: false, windowMs: 600_000, joined: {} });
        if (!config.joined || typeof config.joined !== 'object') config.joined = {};
        const sub = String(args[0] || 'status').toLowerCase();
        if (sub === 'status') {
            const mins = Math.round((config.windowMs || 600_000) / 60_000);
            return reply(`*Anti Newcomer Links*\n\n• Status: ${config.enabled ? 'ON' : 'OFF'}\n• New-member link restriction: ${mins} minute(s) after joining\n• Action: DELETE links\n\nCommands:\n• .antinewcomer links 10m\n• .antinewcomer on / off\n• .antinewcomer status`);
        }
        if (sub === 'off') {
            config.enabled = false;
            writeDB(db);
            return reply('Anti Newcomer Links disabled.');
        }
        if (sub === 'on') {
            config.enabled = true;
            if (!Number.isFinite(config.windowMs) || config.windowMs < 1000) config.windowMs = 600_000;
            writeDB(db);
            return reply(`Anti Newcomer Links enabled for ${Math.round(config.windowMs / 60_000)} minute(s) after joining.`);
        }
        if (sub === 'links') {
            const duration = args[1] ? parseDuration(args[1]) : (config.windowMs || 600_000);
            if (!duration) return reply('Usage: .antinewcomer links <duration> (for example: 10m, 1h, 1d)');
            config.enabled = true;
            config.windowMs = duration;
            writeDB(db);
            return reply(`Newcomer link restriction enabled for ${args[1] || `${Math.round(duration / 60_000)}m`} after joining.`);
        }
        return reply('Usage: .antinewcomer status | on | off | links <duration>');
    },
    handleParticipantUpdate,
    handleAntiNewcomer: async function handleAntiNewcomer(sock, m, mek) {
        try {
            if (!m?.isGroup || m.key?.fromMe) return false;
            const db = readDB();
            const config = db[m.chat];
            if (!config?.enabled || !Number.isFinite(config.windowMs) || config.windowMs < 1000) return false;
            const candidates = [m.key?.participantAlt, mek?.key?.participantAlt, m.sender, m.key?.participant].filter(Boolean);
            const resolved = await resolvePhoneJid(sock, candidates);
            if (resolved) candidates.push(resolved);
            const joined = config.joined || {};
            const timestamps = [...new Set(candidates.map(normalizeJid))]
                .map(jid => joined[jid])
                .filter(Number.isFinite);
            if (!timestamps.length) return false;
            const joinTime = Math.min(...timestamps);
            const age = Date.now() - joinTime;
            if (age < 0 || age > config.windowMs) return false;

            const payload = stripQuotedDeep({
                raw: mek?.__rawMessage || mek?.message || {},
                message: m.message || {},
                msg: m.msg || {},
            });
            const text = getMessageText(payload).join(' ');
            if (!hasLink(text)) return false;

            const metadata = await sock.groupMetadata(m.chat).catch(() => null);
            const senderRecord = metadata?.participants?.find(participant =>
                participantIds(participant).some(jid => candidates.map(normalizeJid).includes(jid))
            );
            if (senderRecord?.admin === 'admin' || senderRecord?.admin === 'superadmin') return false;
            const botIds = [sock.user?.id, sock.user?.lid].filter(Boolean).map(normalizeJid);
            const botRecord = metadata?.participants?.find(participant => participantIds(participant).some(jid => botIds.includes(jid)));
            if (!botRecord || !['admin', 'superadmin'].includes(botRecord.admin)) {
                await sock.sendMessage(m.chat, { text: 'Anti Newcomer Links cannot delete links because the bot is not a group admin.' }, { quoted: mek }).catch(() => {});
                return false;
            }
            try {
                await sock.sendMessage(m.chat, { delete: mek?.key || m.key });
            } catch (error) {
                console.error('[ANTINEWCOMER DELETE ERROR]', error?.stack || error?.message || error);
                return false;
            }
            const sender = resolved || candidates.map(normalizeJid).find(jid => jid.endsWith('@s.whatsapp.net')) || m.sender;
            await sock.sendMessage(m.chat, {
                text: `@${String(sender).split('@')[0]} links are restricted for the first ${Math.round(config.windowMs / 60_000) || 1} minute(s) after joining.`,
                mentions: [sender],
            }, { quoted: mek }).catch(() => {});
            return true;
        } catch (error) {
            console.error('[ANTINEWCOMER ERROR]', error?.stack || error?.message || error);
            return false;
        }
    }
};
plugin.parseDuration = parseDuration;
plugin.participantIds = participantIds;
plugin.readDB = readDB;
plugin.writeDB = writeDB;
module.exports = plugin;
