const fs = require('fs');
const path = require('path');


const DB_PATH = path.join(process.cwd(), 'database', 'antigm.json');
const WARN_DB_PATH = path.join(process.cwd(), 'database', 'antigm_warns.json');

function loadDB() {
    if (!fs.existsSync(DB_PATH)) return {};
    try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return {}; }
}

function saveDB(data) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function loadWarns() {
    if (!fs.existsSync(WARN_DB_PATH)) return {};
    try { return JSON.parse(fs.readFileSync(WARN_DB_PATH, 'utf8')); } catch { return {}; }
}

function saveWarns(data) {
    fs.mkdirSync(path.dirname(WARN_DB_PATH), { recursive: true });
    fs.writeFileSync(WARN_DB_PATH, JSON.stringify(data, null, 2));
}

function isStatusMention(mek) {
    // WhatsApp can wrap the status mention in ephemeral/view-once or device
    // sent containers. Check the normalized message and the common wrappers so
    // the guard also works for messages received by CODY's current Baileys.
    let raw = mek?.message || {};
    for (let depth = 0; depth < 4 && raw; depth++) {
        if (raw.groupStatusMentionMessage || raw.statusMentionMessage) return true;
        raw = raw.ephemeralMessage?.message
            || raw.viewOnceMessage?.message
            || raw.viewOnceMessageV2?.message
            || raw.deviceSentMessage?.message
            || null;
    }
    return false;
}

// ── Command ────────────────────────────────────────────────────
module.exports = {
    name: 'antigm',
    // NOTE: 'antigroupstatus' must never be claimed here. addCommand() is
    // first-come-first-served, so this alias made the dedicated
    // Admin/antigroupstatus.js command fail to register and ".antigroupstatus
    // on" silently enabled anti-group-MENTION instead of anti-group-status.
    alias: ['antigroupmention', 'antigroupmsg', 'antieveryone'],
    desc: 'Prevent status mentions in group',
    category: 'Tools',
    groupOnly: true,
    adminOnly: true,
    reactions: { start: '🛡️', success: '😤' },

    execute: async (sock, m, { args, reply }) => {
        const db = loadDB();
        const group = m.chat;
        if (!db[group]) db[group] = { enabled: false, action: 'delete' };

        const sub = args[0]?.toLowerCase();

        if (!sub || sub === 'status') {
            const cfg = db[group];
            let actionDisplay;
            if (cfg.action === 'delete') actionDisplay = ' ꙰⊕ DELETE';
            else if (cfg.action === 'warn') actionDisplay = '⚠︎ WARN (3x → KICK)';
            else if (cfg.action === 'kick') actionDisplay = 'ಠ_ಠ KICK';
            else if (cfg.action === 'tkick') actionDisplay = '⏱️ TEMP KICK (' + (cfg.tkickDuration || '5m') + ')';
            
            return reply(
                `ಠ_ಠ *Anti Status Mention Settings*\n\n` +
                `• Status : ${cfg.enabled ? '✓ ON' : '✘ OFF'}\n` +
                `• Action : ${actionDisplay}\n\n` +
                `Commands:\n` +
                `• .antigm on / off\n` +
                `• .antigm delete → delete only\n` +
                `• .antigm warn → delete + warn (3x = kick)\n` +
                `• .antigm kick → delete + immediate kick\n` +
                `• .antigm tkick 5m → delete + temp kick\n` +
                `• .antigm resetwarn @user`
            );
        }

        if (sub === 'on') {
            db[group].enabled = true;
            saveDB(db);
            let actionText;
            if (db[group].action === 'delete') actionText = ' ꙰⊕ DELETE';
            else if (db[group].action === 'warn') actionText = '⚠︎ WARN (3x → KICK)';
            else if (db[group].action === 'kick') actionText = 'ಠ_ಠ KICK';
            else if (db[group].action === 'tkick') actionText = '⏱️ TEMP KICK (' + (db[group].tkickDuration || '5m') + ')';
            return reply(`_*✓ Anti Status Mention*_ *ON*\nAction: *${actionText}*`);
        }
        if (sub === 'off') {
            db[group].enabled = false;
            saveDB(db);
            return reply('_*✘ Anti Status Mention*_ *OFF*');
        }
        if (sub === 'delete') {
            db[group].action = 'delete';
            saveDB(db);
            return reply('_*✓ Action*_ → *DELETE* (message deleted)');
        }
        if (sub === 'warn') {
            db[group].action = 'warn';
            saveDB(db);
            return reply('_*✓ Action*_ → *WARN* (3 warns = auto kick)');
        }
        if (sub === 'kick') {
            db[group].action = 'kick';
            saveDB(db);
            return reply('_*✓ Action*_ → *KICK* (immediate removal)');
        }
        if (sub === 'tkick') {
            db[group].action = 'tkick';
            const durArg = args[1];
            db[group].tkickDuration = (durArg && /^\d+(s|m|h|d)$/i.test(durArg)) ? durArg : '5m';
            saveDB(db);
            return reply(`_*✓ Action*_ → *TEMP KICK* (auto re-added after ${db[group].tkickDuration})`);
        }
        if (sub === 'resetwarn') {
            const mentioned = m.mentionedJid?.[0];
            if (!mentioned) return reply('✐ Usage: .antigm resetwarn @user');
            const warns = loadWarns();
            const key = `${group}_${mentioned}`;
            if (warns[key]) {
                delete warns[key];
                saveWarns(warns);
                return reply(`✓ Warnings reset for @${mentioned.split('@')[0]}`);
            }
            return reply(`✘ User has no warnings.`);
        }

        reply('Usage: .antigm on | off | delete | warn | kick | tkick 5m | resetwarn @user');
    }
};

// ── Message Handler ────────────────────────────────────────────
module.exports.handleAntiGM = async function(sock, m, mek) {
    try {
        if (!m.isGroup || m.key?.fromMe) return;

        // Only fire on status mentions
        if (!isStatusMention(mek)) return;

        const db = loadDB();
        const group = m.chat;
        if (!db[group]?.enabled) return;

        const action = db[group].action || 'delete';

        // Admins are exempt
        const meta = await sock.groupMetadata(group).catch(() => null);
        if (!meta) return;

        const admins = meta.participants
            .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
            .map(p => p.id.replace(/:\d+@/, '@'));
        const senderNorm = (m.sender || '').replace(/:\d+@/, '@');
        if (admins.includes(senderNorm)) return;

        const sender = m.sender;

        // Delete the message FIRST for all actions
        await sock.sendMessage(group, { delete: m.key }).catch(() => {});

        if (action === 'delete') {
            await sock.sendMessage(group, {
                text: `ⓘ @${sender.split('@')[0]} *Status mention detected!* \nStatus mentions are not allowed here. Message deleted. ಥ⁠‿⁠ಥ`,
                mentions: [sender]
            }).catch(() => {});
        }
        else if (action === 'warn') {
            // Load warns fresh from file
            const warns = loadWarns();
            const warnKey = `${group}_${sender}`;
            
            // Initialize or increment
            if (!warns[warnKey]) {
                warns[warnKey] = { count: 0, user: sender };
            }
            warns[warnKey].count++;
            
            // Save immediately
            saveWarns(warns);
            
            const warnCount = warns[warnKey].count;
            console.log(`[ANTIGM WARN] ${sender.split('@')[0]} now has ${warnCount}/3 warnings`);
            
            if (warnCount >= 3) {
                // Delete warns before kicking
                delete warns[warnKey];
                saveWarns(warns);
                
                await sock.sendMessage(group, {
                    text: `ಠ_ಠ @${sender.split('@')[0]} *KICKED* \n3/3 warnings - Status mentions.`,
                    mentions: [sender]
                }).catch(() => {});
                
                await sock.groupParticipantsUpdate(group, [sender], 'remove').catch(() => {});
            } else {
                await sock.sendMessage(group, {
                    text: `⚠︎ @${sender.split('@')[0]} *Warning ${warnCount}/3*\nStatus mentions are not allowed. ${3 - warnCount} more = kick! ಥ⁠‿⁠ಥ`,
                    mentions: [sender]
                }).catch(() => {});
            }
        }
        else if (action === 'kick') {
            await sock.sendMessage(group, {
                text: `ಠ_ಠ @${sender.split('@')[0]} *KICKED* for status mentioning.`,
                mentions: [sender]
            }).catch(() => {});
            
            await sock.groupParticipantsUpdate(group, [sender], 'remove').catch(() => {});
        }
        else if (action === 'tkick') {
            // temp kick — auto re-added after the duration (@crysnovax—FIX06-08-26)
            const { tkick, parseTime } = require('../../Plugin/tkick');
            const durText = db[group].tkickDuration || '5m';
            const durMs = parseTime(durText) || 5 * 60 * 1000;

            await sock.sendMessage(group, {
                text: `⏱️ @${sender.split('@')[0]} *TEMP KICKED* for status mentioning — auto re-added after ${durText}.`,
                mentions: [sender]
            }).catch(() => {});

            await tkick(sock, group, sender, durMs, 'status mention (antigm)');
        }

        console.log(`[ANTIGM] ${action} → ${sender.split('@')[0]} | status mention`);

    } catch (err) {
        console.error('[ANTIGM ERROR]', err.message);
    }
};

module.exports.isStatusMention = isStatusMention;
