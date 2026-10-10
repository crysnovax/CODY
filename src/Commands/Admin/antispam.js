// ZEE BOT V2 — Anti Spam
const fs   = require('fs');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'database', 'antispam.json');
const WARN_DB_PATH = path.join(process.cwd(), 'database', 'antispam_warns.json');

// Spam tracking cache (in-memory, cleared on restart)
const messageCache = new Map(); // group: { userId: { count, firstTime, lastTime } }
const MUTE_CACHE = new Map(); // Muted users with expiry

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

// Helper to normalize JID
function norm(jid) {
    return (jid || '').replace(/:\d+@/, '@').replace('@lid', '@s.whatsapp.net');
}

// ── Command ────────────────────────────────────────────────────
module.exports = {
    name: 'antispam',
    alias: ['antispam', 'spam'],
    desc: 'Prevent spam / message flooding in group',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,
    reactions: { start: '🤬', success: '🐾' },

    execute: async (sock, m, { args, reply }) => {
        const db    = loadDB();
        const group = m.chat;
        if (!db[group]) {
            db[group] = {
                enabled: false,
                action: 'delete',
                maxMessages: 5,
                timeWindow: 5000, // 5 seconds
                muteDuration: 60000 // 1 minute
            };
        }

        const sub = args[0]?.toLowerCase();

        if (!sub || sub === 'status') {
            const cfg = db[group];
            let actionDisplay;
            if (cfg.action === 'delete') actionDisplay = ' ꙰⊕ DELETE';
            else if (cfg.action === 'warn') actionDisplay = '⚠︎ WARN (3x → KICK)';
            else if (cfg.action === 'kick') actionDisplay = 'ಠ_ಠ KICK';
            else if (cfg.action === 'mute') actionDisplay = '🔇 MUTE';
            else if (cfg.action === 'tkick') actionDisplay = '⏱️ TEMP KICK (' + (cfg.tkickDuration || '5m') + ')';
            
            return reply(
                `⚠︎ *Anti Spam Settings*\n\n` +
                `• Status    : ${cfg.enabled ? '*ON ✓*' : '*OFF ✘*'}\n` +
                `• Action    : ${actionDisplay}\n` +
                `• Max msgs  : ${cfg.maxMessages || 5}\n` +
                `• Time window : ${(cfg.timeWindow || 5000) / 1000}s\n` +
                `• Mute duration : ${(cfg.muteDuration || 60000) / 1000}s\n\n` +
                `Commands:\n` +
                `• .antispam on / off\n` +
                `• .antispam delete → delete only\n` +
                `• .antispam warn → delete + warn (3x = kick)\n` +
                `• .antispam kick → delete + immediate kick\n` +
                `• .antispam tkick 5m → delete + temp kick\n` +
                `• .antispam mute → delete + mute\n` +
                `• .antispam max <number>\n` +
                `• .antispam time <seconds>\n` +
                `• .antispam duration <seconds>\n` +
                `• .antispam resetwarn @user`
            );
        }

        if (sub === 'on') {
            db[group].enabled = true;
            saveDB(db);
            let actionText;
            if (db[group].action === 'delete') actionText = ' ꙰⊕ DELETE';
            else if (db[group].action === 'warn') actionText = '⚠︎ WARN (3x → KICK)';
            else if (db[group].action === 'kick') actionText = 'ಠ_ಠ KICK';
            else if (db[group].action === 'mute') actionText = '🔇 MUTE';
            else if (db[group].action === 'tkick') actionText = '⏱️ TEMP KICK (' + (db[group].tkickDuration || '5m') + ')';
            return reply(`*⟁⃝⚠︎ Anti Spam ON*\nAction: ${actionText}\nMax ${db[group].maxMessages} msgs in ${db[group].timeWindow / 1000}s`);
        }
        if (sub === 'off') {
            db[group].enabled = false;
            saveDB(db);
            return reply('_*✓ Anti Spam OFF*_');
        }
        if (sub === 'delete') {
            db[group].action = 'delete';
            saveDB(db);
            return reply('_*✓ Action → DELETE*_ (message deleted)');
        }
        if (sub === 'warn') {
            db[group].action = 'warn';
            saveDB(db);
            return reply('_*✓ Action → WARN*_ (3 warns = auto kick)');
        }
        if (sub === 'kick') {
            db[group].action = 'kick';
            saveDB(db);
            return reply('_*✓ Action → KICK*_ (immediate removal)');
        }
        if (sub === 'tkick') {
            db[group].action = 'tkick';
            const durArg = args[1];
            db[group].tkickDuration = (durArg && /^\d+(s|m|h|d)$/i.test(durArg)) ? durArg : '5m';
            saveDB(db);
            return reply(`_*✓ Action → TEMP KICK*_ (auto re-added after ${db[group].tkickDuration})`);
        }
        if (sub === 'mute') {
            db[group].action = 'mute';
            saveDB(db);
            return reply('_*✓ Action → MUTE*_');
        }
        if (sub === 'max' && args[1]) {
            const num = parseInt(args[1]);
            if (isNaN(num) || num < 2) return reply('_*Must be at least 2 messages*_');
            db[group].maxMessages = num;
            saveDB(db);
            return reply(`_*✓ Max messages → ${num}*_`);
        }
        if (sub === 'time' && args[1]) {
            const secs = parseInt(args[1]);
            if (isNaN(secs) || secs < 2) return reply('_*Must be at least 2 seconds*_');
            db[group].timeWindow = secs * 1000;
            saveDB(db);
            return reply(`_*✓ Time window → ${secs}s*_`);
        }
        if (sub === 'duration' && args[1]) {
            const secs = parseInt(args[1]);
            if (isNaN(secs) || secs < 5) return reply('_*Must be at least 5 seconds*_');
            db[group].muteDuration = secs * 1000;
            saveDB(db);
            return reply(`_*✓ Mute duration → ${secs}s*_`);
        }
        if (sub === 'resetwarn') {
            const mentioned = m.mentionedJid?.[0];
            if (!mentioned) return reply(`Usage: antispam resetwarn @user`);
            const warns = loadWarns();
            const key = `${group}_${mentioned}`;
            if (warns[key]) {
                delete warns[key];
                saveWarns(warns);
                return reply(`Warnings reset for @${mentioned.split('@')[0]}`, { mentions: [mentioned] });
            }
            return reply(`User has no warnings.`);
        }

        reply('ಠ_ಠ _*Usage: .antispam on | off | delete | warn | kick | tkick 5m | mute | max <n> | time <s> | duration <s> | resetwarn @user*_');
    }
};

// ── Message Handler ────────────────────────────────────────────
module.exports.handleAntiSpam = async function(sock, m) {
    try {
        if (!m.isGroup || m.key?.fromMe) return;

        const db    = loadDB();
        const group = m.chat;
        if (!db[group]?.enabled) return;

        const sender = m.sender;
        const now = Date.now();

        // Check if user is muted
        const muteKey = `${group}:${sender}`;
        const muteExpiry = MUTE_CACHE.get(muteKey);
        if (muteExpiry && now < muteExpiry) {
            // User is muted - delete their message
            await sock.sendMessage(group, { delete: m.key }).catch(() => {});
            console.log(`[ANTI SPAM] Muted user message deleted: ${sender.split('@')[0]}`);
            return;
        }

        // Get group config
        const maxMessages = db[group].maxMessages || 5;
        const timeWindow = db[group].timeWindow || 5000;
        const action = db[group].action || 'delete';
        const muteDuration = db[group].muteDuration || 60000;

        // Get or create group cache
        if (!messageCache.has(group)) {
            messageCache.set(group, new Map());
        }
        const groupCache = messageCache.get(group);

        // Get or create user data
        if (!groupCache.has(sender)) {
            groupCache.set(sender, { count: 0, firstTime: now, lastTime: now });
        }
        const userData = groupCache.get(sender);

        // Reset if time window expired
        if (now - userData.firstTime > timeWindow) {
            userData.count = 0;
            userData.firstTime = now;
        }

        // Increment message count
        userData.count++;
        userData.lastTime = now;

        // Check if spam threshold reached
        if (userData.count >= maxMessages) {
            // Check admin exemption
            const meta = await sock.groupMetadata(group).catch(() => null);
            if (meta) {
                const admins = meta.participants.filter(p => p.admin).map(p => norm(p.id));
                const senderNorm = norm(sender);
                if (admins.includes(senderNorm)) {
                    // Admin exempt - reset count
                    userData.count = 0;
                    return;
                }
            }

            // Delete the current message
            await sock.sendMessage(group, { delete: m.key }).catch(() => {});

            if (action === 'delete') {
                await sock.sendMessage(group, {
                    text: `_ⓘ @${sender.split('@')[0]} *Spam detected!*_\n\n_${userData.count} messages in ${timeWindow / 1000}s_\n_Message deleted._`,
                    mentions: [sender]
                }, { quoted: m }).catch(() => {});
                
                console.log(`[ANTI SPAM] Deleted: ${sender.split('@')[0]} | ${userData.count} msgs`);
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
                console.log(`[ANTISPAM WARN] ${sender.split('@')[0]} now has ${warnCount}/3 warnings`);
                
                if (warnCount >= 3) {
                    // Delete warns before kicking
                    delete warns[warnKey];
                    saveWarns(warns);
                    
                    await sock.sendMessage(group, {
                        text: `_ಠ_ಠ @${sender.split('@')[0]} *KICKED*_\n_3/3 warnings - Spamming._\n\n_${userData.count} messages in ${timeWindow / 1000}s_`,
                        mentions: [sender]
                    }, { quoted: m }).catch(() => {});
                    
                    await sock.groupParticipantsUpdate(group, [sender], 'remove').catch(() => {});
                    console.log(`[ANTI SPAM] Kicked: ${sender.split('@')[0]} | 3 warns`);
                } else {
                    await sock.sendMessage(group, {
                        text: `_⚠︎ @${sender.split('@')[0]} *Warning ${warnCount}/3*_\n_STOP SPAMMING! ${3 - warnCount} more = kick!_\n\n_${userData.count} messages in ${timeWindow / 1000}s_`,
                        mentions: [sender]
                    }, { quoted: m }).catch(() => {});
                    console.log(`[ANTI SPAM] Warned: ${sender.split('@')[0]} | ${warnCount}/3`);
                }
            }
            else if (action === 'mute') {
                const expiry = now + muteDuration;
                MUTE_CACHE.set(muteKey, expiry);
                
                await sock.sendMessage(group, {
                    text: `_🔇 @${sender.split('@')[0]} has been muted for spamming!_\n\n_${userData.count} messages in ${timeWindow / 1000}s_\n_Muted for ${muteDuration / 1000}s_`,
                    mentions: [sender]
                }, { quoted: m }).catch(() => {});
                
                // Schedule unmute
                setTimeout(() => {
                    MUTE_CACHE.delete(muteKey);
                    sock.sendMessage(group, { text: `_🔊 @${sender.split('@')[0]} has been unmuted._`, mentions: [sender] }).catch(() => {});
                }, muteDuration);
                
                console.log(`[ANTI SPAM] Muted: ${sender.split('@')[0]} for ${muteDuration / 1000}s`);
            }
            else if (action === 'kick') {
                await sock.sendMessage(group, {
                    text: `_ಠ_ಠ @${sender.split('@')[0]} *KICKED for spamming!*_\n\n_${userData.count} messages in ${timeWindow / 1000}s_`,
                    mentions: [sender]
                }, { quoted: m }).catch(() => {});
                
                await sock.groupParticipantsUpdate(group, [sender], 'remove').catch(() => {});
                groupCache.delete(sender);
                console.log(`[ANTI SPAM] Kicked: ${sender.split('@')[0]}`);
            }
            else if (action === 'tkick') {
                // temp kick — auto re-added after the duration (@crysnovax—FIX06-08-26)
                const { tkick, parseTime } = require('../../Plugin/tkick');
                const durText = db[group].tkickDuration || '5m';
                const durMs = parseTime(durText) || 5 * 60 * 1000;

                await sock.sendMessage(group, {
                    text: `_⏱️ @${sender.split('@')[0]} *TEMP KICKED for spamming!*_\n\n_${userData.count} messages in ${timeWindow / 1000}s_\n_Auto re-added after ${durText}._`,
                    mentions: [sender]
                }, { quoted: m }).catch(() => {});

                await tkick(sock, group, sender, durMs, 'spamming (antispam)');
                groupCache.delete(sender);
                console.log(`[ANTI SPAM] Temp kicked: ${sender.split('@')[0]}`);
            }

            // Reset count after action
            userData.count = 0;
            userData.firstTime = now;
        }

        // Clean up old entries (occasionally)
        if (Math.random() < 0.01) {
            for (const [uid, data] of groupCache.entries()) {
                if (now - data.lastTime > timeWindow * 2) {
                    groupCache.delete(uid);
                }
            }
        }

    } catch (err) {
        console.error('[ANTI SPAM ERROR]', err.message);
    }
};

// ─── Helper to check if user is muted (for other commands) ───
module.exports.isMuted = function(group, user) {
    const muteKey = `${group}:${user}`;
    const expiry = MUTE_CACHE.get(muteKey);
    return expiry && Date.now() < expiry;
};

// ─── Helper to manually unmute ───
module.exports.unmute = function(group, user) {
    const muteKey = `${group}:${user}`;
    return MUTE_CACHE.delete(muteKey);
};

// ─── Helper to manually mute ───
module.exports.mute = function(group, user, duration) {
    const muteKey = `${group}:${user}`;
    MUTE_CACHE.set(muteKey, Date.now() + duration);
};
