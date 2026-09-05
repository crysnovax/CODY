const fs   = require('fs');
const path = require('path');
const { stripBotMarker } = require('../../Plugin/antiText');

const DB_PATH = path.join(process.cwd(), 'database', 'antiword.json');
const WARN_DB_PATH = path.join(process.cwd(), 'database', 'antiword_warns.json');

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

function containsBannedWord(text, bannedWords) {
    const lowerText = text.toLowerCase();
    return bannedWords.some(word => lowerText.includes(word.toLowerCase()));
}

function extractText(m) {
    if (m.text) return stripBotMarker(m.text);
    if (m.body) return stripBotMarker(m.body);
    const msg = m.message || m.msg || {};
    if (msg.conversation) return stripBotMarker(msg.conversation);
    if (msg.extendedTextMessage?.text) return stripBotMarker(msg.extendedTextMessage.text);
    if (msg.imageMessage?.caption) return stripBotMarker(msg.imageMessage.caption);
    if (msg.videoMessage?.caption) return stripBotMarker(msg.videoMessage.caption);
    if (msg.documentMessage?.caption) return stripBotMarker(msg.documentMessage.caption);
    if (msg.audioMessage?.caption) return stripBotMarker(msg.audioMessage.caption);
    if (m.quoted?.text) return stripBotMarker(m.quoted.text);
    return '';
}

module.exports = {
    name: 'antiword',
    alias: ['banword', 'wordban'],
    desc: 'Delete messages containing banned words',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,
    reactions: { start: '🛡️', success: '🗑️' },

    execute: async (sock, m, { args, reply }) => {
        const db    = loadDB();
        const group = m.chat;
        if (!db[group]) db[group] = { enabled: false, words: [], action: 'delete' };

        const sub = args[0]?.toLowerCase();

        if (!sub || sub === 'status') {
            const cfg = db[group];
            const wordList = cfg.words.length 
                ? cfg.words.map(w => `❏ ${w}`).join('\n')
                : '❏ none';
            
            let actionDisplay;
            if (cfg.action === 'delete') actionDisplay = ' ꙰⊕ DELETE';
            else if (cfg.action === 'warn') actionDisplay = '⚠︎ WARN (3x → KICK)';
            else if (cfg.action === 'kick') actionDisplay = 'ಠ_ಠ KICK';
            else if (cfg.action === 'tkick') actionDisplay = '⏱️ TEMP KICK (' + (cfg.tkickDuration || '5m') + ')';
            
            return reply(
                `⚠︎ *Anti‑Word Settings*\n\n` +
                `• Status : ${cfg.enabled ? '✓ ON' : '✘ OFF'}\n` +
                `• Action : ${actionDisplay}\n` +
                `• Words  :\n${wordList}\n\n` +
                `Commands:\n` +
                `• .antiword on / off\n` +
                `• .antiword delete → delete only\n` +
                `• .antiword warn → delete + warn (3x = kick)\n` +
                `• .antiword kick → delete + immediate kick\n` +
                `• .antiword tkick 5m → delete + temp kick\n` +
                `• .antiword add <word1> <word2> ...\n` +
                `• .antiword remove <word>\n` +
                `• .antiword list\n` +
                `• .antiword resetwarn @user`
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
            return reply(`✓ Anti‑Word *ON* 亗\nAction: ${actionText}`);
        }
        if (sub === 'off') {
            db[group].enabled = false;
            saveDB(db);
            return reply(`✘ Anti‑Word *OFF*`);
        }
        if (sub === 'delete') {
            db[group].action = 'delete';
            saveDB(db);
            return reply(`🗑️ Action → *DELETE* (message deleted)`);
        }
        if (sub === 'warn') {
            db[group].action = 'warn';
            saveDB(db);
            return reply(`⚠︎ Action → *WARN* (3 warns = auto kick)`);
        }
        if (sub === 'kick') {
            db[group].action = 'kick';
            saveDB(db);
            return reply(`ಠ_ಠ Action → *KICK* (immediate removal)`);
        }
        if (sub === 'tkick') {
            db[group].action = 'tkick';
            const durArg = args[1];
            db[group].tkickDuration = (durArg && /^\d+(s|m|h|d)$/i.test(durArg)) ? durArg : '5m';
            saveDB(db);
            return reply(`⏱️ Action → *TEMP KICK* (auto re-added after ${db[group].tkickDuration})`);
        }

        if (sub === 'add') {
            const words = args.slice(1).filter(w => w && w.trim());
            if (!words.length) return reply(`${prefix}✐ Usage: antiword add <word1> <word2> ...`);
            
            const newWords = [];
            for (const w of words) {
                const word = w.toLowerCase();
                if (!db[group].words.includes(word)) {
                    db[group].words.push(word);
                    newWords.push(word);
                }
            }
            saveDB(db);
            if (newWords.length) {
                return reply(`${prefix}✓ Added:\n${newWords.map(w => `❏ ${w}`).join('\n')}`);
            } else {
                return reply(`✘ All words already banned.`);
            }
        }

        if (sub === 'remove') {
            const word = args[1]?.toLowerCase();
            if (!word) return reply(`${prefix}✐ Usage: antiword remove <word>`);
            const idx = db[group].words.indexOf(word);
            if (idx === -1) return reply(`✘ "${word}" not found.`);
            db[group].words.splice(idx, 1);
            saveDB(db);
            return reply(`🗑️ Removed: ❏ ${word}`);
        }

        if (sub === 'list') {
            const words = db[group].words;
            if (!words.length) return reply(`❏ No banned words in this group.`);
            let text = `𓃼 *Banned words:*\n`;
            text += words.map((w, i) => `❏ ${w}`).join('\n');
            return reply(text);
        }
        
        if (sub === 'resetwarn') {
            const mentioned = m.mentionedJid?.[0];
            if (!mentioned) return reply(`${prefix}✐ Usage: antiword resetwarn @user`);
            const warns = loadWarns();
            const key = `${group}_${mentioned}`;
            if (warns[key]) {
                delete warns[key];
                saveWarns(warns);
                return reply(`${prefix}✓ Warnings reset for @${mentioned.split('@')[0]}`);
            }
            return reply(`✘ User has no warnings.`);
        }

        return reply(`${prefix}𒆜 Usage:\nantiword on/off\n.antiword delete/warn/kick/tkick 5m\n.antiword add <words>\n.antiword remove <word>\n.antiword list\n.antiword resetwarn @user`);
    }
};

// ── Message Handler ──────────────────────────────────────────────
module.exports.handleAntiWord = async function(sock, m, mek) {
    try {
        if (!m.isGroup) return;
        if (m.key?.fromMe) return;

        const db = loadDB();
        const group = m.chat;
        const cfg = db[group];
        if (!cfg?.enabled) return;
        if (!cfg.words?.length) return;

        const text = extractText(m);
        if (!text) return;
        if (!containsBannedWord(text, cfg.words)) return;

        const meta = await sock.groupMetadata(group).catch(() => null);
        if (!meta) return;

        const sender = m.sender;
        const admins = meta.participants
            .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
            .map(p => p.id.replace(/:\d+@/, '@'));
        const senderNorm = (sender || '').replace(/:\d+@/, '@');
        if (admins.includes(senderNorm)) return;

        const action = cfg.action || 'delete';

        // Delete the message FIRST for all actions
        await sock.sendMessage(group, { delete: m.key }).catch(() => {});

        if (action === 'delete') {
            await sock.sendMessage(group, {
                text: `ⓘ @${sender.split('@')[0]} *Banned word detected!* \nYour message was deleted. ಥ⁠‿⁠ಥ`,
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
            console.log(`[ANTIWORD WARN] ${sender.split('@')[0]} now has ${warnCount}/3 warnings`);
            
            if (warnCount >= 3) {
                // Delete warns before kicking
                delete warns[warnKey];
                saveWarns(warns);
                
                await sock.sendMessage(group, {
                    text: `ಠ_ಠ @${sender.split('@')[0]} *KICKED* \n3/3 warnings - Banned words.`,
                    mentions: [sender]
                }).catch(() => {});
                
                await sock.groupParticipantsUpdate(group, [sender], 'remove').catch(() => {});
            } else {
                await sock.sendMessage(group, {
                    text: `⚠︎ @${sender.split('@')[0]} *Warning ${warnCount}/3*\nBanned words are not allowed. ${3 - warnCount} more = kick! ಥ⁠‿⁠ಥ`,
                    mentions: [sender]
                }).catch(() => {});
            }
        }
        else if (action === 'kick') {
            await sock.sendMessage(group, {
                text: `ಠ_ಠ @${sender.split('@')[0]} *KICKED* for using a banned word.`,
                mentions: [sender]
            }).catch(() => {});
            await sock.groupParticipantsUpdate(group, [sender], 'remove').catch(() => {});
        }
        else if (action === 'tkick') {
            // temp kick — auto re-added after the duration (@crysnovax—FIX06-08-26)
            const { tkick, parseTime } = require('../../Plugin/tkick');
            const durText = cfg.tkickDuration || '5m';
            const durMs = parseTime(durText) || 5 * 60 * 1000;

            await sock.sendMessage(group, {
                text: `⏱️ @${sender.split('@')[0]} *TEMP KICKED* for using a banned word — auto re-added after ${durText}.`,
                mentions: [sender]
            }).catch(() => {});

            await tkick(sock, group, sender, durMs, 'banned word (antiword)');
        }
    } catch (err) {
        console.error('[ANTIWORD ERROR]', err.message);
    }
};
