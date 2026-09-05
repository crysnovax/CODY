// — Anti Tag / Anti Mass Mention
const fs   = require('fs');
const path = require('path');
const { stripBotMarker } = require('../../Plugin/antiText');

const DB_PATH = path.join(process.cwd(), 'database', 'antitag.json');
const WARN_DB_PATH = path.join(process.cwd(), 'database', 'antitag_warns.json');

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

function collectMentionData(value, state, seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);

    for (const field of ['mentionedJid', 'mentionedJidAlt', 'statusMentions']) {
        const entries = value[field];
        if (Array.isArray(entries)) entries.filter(Boolean).forEach(jid => state.mentions.add(jid));
    }

    if (value.mentionAll === true || value.isMentionAll === true) state.hasAllMention = true;
    const nonJid = value.nonJidMentions;
    if (Array.isArray(nonJid)) state.nonJidMentionCount += nonJid.length;
    else if (Number(nonJid) > 0) state.nonJidMentionCount += Number(nonJid);

    for (const child of Object.values(value)) {
        if (Array.isArray(child)) child.forEach(item => collectMentionData(item, state, seen));
        else collectMentionData(child, state, seen);
    }
}

function getMentions(m) {
    const state = { mentions: new Set(), nonJidMentionCount: 0, hasAllMention: false };
    collectMentionData(m.message || {}, state);
    collectMentionData(m.msg || {}, state);
    for (const jid of m.mentionedJid || []) state.mentions.add(jid);
    return { ...state, mentions: [...state.mentions] };
}

function norm(jid) {
    return String(jid || '').replace(/:\d+@/, '@').toLowerCase();
}

function sameIdentity(first, second) {
    if (!first || !second) return false;
    if (norm(first) === norm(second)) return true;
    const firstNumber = norm(first).endsWith('@s.whatsapp.net') ? norm(first).split('@')[0] : '';
    const secondNumber = norm(second).endsWith('@s.whatsapp.net') ? norm(second).split('@')[0] : '';
    return Boolean(firstNumber && secondNumber && firstNumber === secondNumber);
}

// ── Command ────────────────────────────────────────────────────
module.exports = {
    name: 'antitag',
    alias: ['antimention', 'antitagall'],
    desc: 'Prevent mass tagging / @everyone mentions in group',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,
    reactions: { start: '🛡️', success: '😑' },

    execute: async (sock, m, { args, reply, prefix }) => {
        const db    = loadDB();
        const group = m.chat;
        if (!db[group]) db[group] = { enabled: false, action: 'delete', minTags: 2 };

        const sub = args[0]?.toLowerCase();

        if (!sub || sub === 'status') {
            const cfg = db[group];
            let actionDisplay;
            if (cfg.action === 'delete') actionDisplay = ' ꙰⊕ DELETE';
            else if (cfg.action === 'warn') actionDisplay = '⚠︎ WARN (3x → KICK)';
            else if (cfg.action === 'kick') actionDisplay = 'ಠ_ಠ KICK';
            else if (cfg.action === 'tkick') actionDisplay = '⏱️ TEMP KICK (' + (cfg.tkickDuration || '5m') + ')';
            
            return reply(
                `☠︎︎ *Anti Tag Settings*\n\n` +
                `❏• Status   : ${cfg.enabled ? '😤 ON' : '✘ OFF'}\n` +
                `❏• Action   : ${actionDisplay}\n` +
                `❏• Min tags : ${cfg.minTags || 2} mentions to trigger\n\n` +
                `_Hidetag / mass mentions always blocked when ON_\n\n` +
                `Commands:\n` +
                `❏• .antitag on / off\n` +
                `❏• .antitag delete → delete only\n` +
                `❏• .antitag warn → delete + warn (3x = kick)\n` +
                `❏• .antitag kick → delete + immediate kick\n` +
                `❏• .antitag tkick 5m → delete + temp kick\n` +
                `❏• .antitag min 3 → set minimum mentions\n` +
                `❏• .antitag resetwarn @user`
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
            return reply(`${prefix}_*亗 Anti tag*_ _*ON*_\n_*Action:*_ *${actionText}*\nMin mentions: *${db[group].minTags}*\n\n_Mass tagging will be deleted_`);
        }
        if (sub === 'off') {
            db[group].enabled = false;
            saveDB(db);
            return reply('_*✘ Anti tag *OFF*◦*_');
        }
        if (sub === 'delete') {
            db[group].action = 'delete';
            saveDB(db);
            return reply('_*✓ Action →*_ *DELETE* (message deleted)');
        }
        if (sub === 'warn') {
            db[group].action = 'warn';
            saveDB(db);
            return reply('_*ಠ_ಠ Action →*_ *WARN* (3 warns = auto kick)');
        }
        if (sub === 'kick') {
            db[group].action = 'kick';
            saveDB(db);
            return reply('_*✓ Action →*_ *KICK* (immediate removal)');
        }
        if (sub === 'tkick') {
            db[group].action = 'tkick';
            const durArg = args[1];
            db[group].tkickDuration = (durArg && /^\d+(s|m|h|d)$/i.test(durArg)) ? durArg : '5m';
            saveDB(db);
            return reply(`_*✓ Action →*_ *TEMP KICK* (auto re-added after ${db[group].tkickDuration})`);
        }
        if (sub === 'min' && args[1]) {
            const num = parseInt(args[1]);
            if (isNaN(num) || num < 1) return reply('_*ಠ_ಠ Must be a number greater than 0*_');
            db[group].minTags = num;
            saveDB(db);
            return reply(`_*✓ Min mentions →*_ *${num}*`);
        }
        if (sub === 'resetwarn') {
            const mentioned = m.mentionedJid?.[0];
            if (!mentioned) return reply(`${prefix}✐ Usage: antitag resetwarn @user`);
            const warns = loadWarns();
            const key = `${group}_${mentioned}`;
            if (warns[key]) {
                delete warns[key];
                saveWarns(warns);
                return reply(`${prefix}✓ Warnings reset for @${mentioned.split('@')[0]}`, { mentions: [mentioned] });
            }
            return reply(`✘ User has no warnings.`);
        }

        reply('ಠ_ಠ _*Usage: .antitag on | off | delete | warn | kick | tkick 5m | min <number> | resetwarn @user*_');
    }
};

// ── Message Handler ────────────────────────────────────────────
module.exports.handleAntiTag = async function(sock, m) {
    try {
        if (!m.isGroup || m.key?.fromMe) return;

        const db    = loadDB();
        const group = m.chat;
        if (!db[group]?.enabled) return;

        const minTags    = db[group].minTags || 2;
        const action     = db[group].action  || 'delete';
        
        // Get ALL mentions from the message
        const { mentions, nonJidMentionCount, hasAllMention } = getMentions(m);
        const hasNonJid = nonJidMentionCount > 0;
        const uniqueMentions = [...new Set(mentions.map(norm).filter(Boolean))];
        const mentionCount = uniqueMentions.length;

        // Get text for hidetag detection
        const text = stripBotMarker(m.text || m.body || m.message?.conversation || m.message?.extendedTextMessage?.text || '');
        const invisibleCount = (text.match(/[\u200e\u200f\u200b\u2060\u061c\ufeff]/g) || []).length;
        const isHideTag = invisibleCount >= 2;

        // Trigger if: @all mention OR nonJidMentions (hidetag/@all) OR hidetag (invisible chars) OR enough mentions
        const shouldTrigger = hasAllMention || hasNonJid || isHideTag || mentionCount >= minTags;

        if (!shouldTrigger) return;

        // Get group metadata
        const meta = await sock.groupMetadata(group).catch(() => null);
        if (!meta) return;

        // Admin exemption - admins are safe
        const senderCandidates = [m.sender, m.key?.participant, m.key?.participantAlt].filter(Boolean);
        const senderRecord = meta.participants.find(participant => {
            const identities = [participant.id, participant.jid, participant.lid, participant.phoneNumber].filter(Boolean);
            return identities.some(identity => senderCandidates.some(sender => sameIdentity(identity, sender)));
        });
        if (senderRecord?.admin) return;

        const botCandidates = [sock.user?.id, sock.user?.lid].filter(Boolean);
        if (senderCandidates.some(sender => botCandidates.some(bot => sameIdentity(sender, bot)))) return;

        const sender = m.sender;
        let triggerReason;
        if (hasAllMention) triggerReason = '@all mention';
        else if (hasNonJid) triggerReason = `hidetag (${nonJidMentionCount} non-JID mentions)`;
        else if (isHideTag) triggerReason = 'hidetag (invisible chars)';
        else triggerReason = `${mentionCount} tags (min: ${minTags})`;

        // Delete the message FIRST for all actions
        await sock.sendMessage(group, { delete: m.key }).catch(() => {});

        if (action === 'delete') {
            await sock.sendMessage(group, {
                text: `_ಠ_ಠ @${sender.split('@')[0]}_ _*Mass tagging is not allowed here!*_\n\n_${triggerReason}_\n_Message deleted._`,
                mentions: [sender]
            });
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
            console.log(`[ANTITAG WARN] ${sender.split('@')[0]} now has ${warnCount}/3 warnings`);
            
            if (warnCount >= 3) {
                // Delete warns before kicking
                delete warns[warnKey];
                saveWarns(warns);
                
                await sock.sendMessage(group, {
                    text: `_ಠ_ಠ @${sender.split('@')[0]} *KICKED*_\n_3/3 warnings - Mass tagging._\n\n_${triggerReason}_`,
                    mentions: [sender]
                });
                
                await sock.groupParticipantsUpdate(group, [sender], 'remove').catch(() => {});
            } else {
                await sock.sendMessage(group, {
                    text: `_ಠ_ಠ @${sender.split('@')[0]} *Warning ${warnCount}/3*_\n_Mass tagging is not allowed. ${3 - warnCount} more = kick!_\n\n_${triggerReason}_`,
                    mentions: [sender]
                });
            }
        }
        else if (action === 'kick') {
            await sock.sendMessage(group, {
                text: `_ಠ_ಠ @${sender.split('@')[0]} *KICKED for mass tagging!*_\n\n_${triggerReason}_`,
                mentions: [sender]
            });
            await sock.groupParticipantsUpdate(group, [sender], 'remove').catch(() => {});
        }
        else if (action === 'tkick') {
            // temp kick — auto re-added after the duration (@crysnovax—FIX06-08-26)
            const { tkick, parseTime } = require('../../Plugin/tkick');
            const durText = db[group]?.tkickDuration || '5m';
            const durMs = parseTime(durText) || 5 * 60 * 1000;

            await sock.sendMessage(group, {
                text: `_⏱️ @${sender.split('@')[0]} *TEMP KICKED for mass tagging!*_\n\n_${triggerReason}_\n_Auto re-added after ${durText}._`,
                mentions: [sender]
            });

            await tkick(sock, group, sender, durMs, 'mass tagging (antitag)');
        }

        console.log(`[ANTI TAG] ${action} → ${sender.split('@')[0]} | ${triggerReason}`);

    } catch (err) {
        console.error('[ANTI TAG ERROR]', err.message);
    }
};

module.exports.getMentions = getMentions;
module.exports.collectMentionData = collectMentionData;
