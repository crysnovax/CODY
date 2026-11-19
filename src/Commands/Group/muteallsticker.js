// muteallsticker.js — mutes ALL stickers from a user (user-level sticker ban).
// The old mutesticker behavior moved here. @crysnovax—FIX06-08-26
const fs = require('fs');
const path = require('path');
const { participantJids } = require('../../Plugin/identityUtils');

const STICKER_MUTE_FILE = path.join(__dirname, '../../database/mutedStickersAll.json');

const initDb = () => {
    const dir = path.dirname(STICKER_MUTE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(STICKER_MUTE_FILE)) fs.writeFileSync(STICKER_MUTE_FILE, '{}');
};

const getMutedDb = () => {
    initDb();
    try { return JSON.parse(fs.readFileSync(STICKER_MUTE_FILE, 'utf8')); } catch { return {}; }
};

const saveMutedDb = data => {
    fs.writeFileSync(STICKER_MUTE_FILE, JSON.stringify(data, null, 2));
};

/* ================= TIME ================= */

const parseTime = str => {
    const match = str?.match(/^(\d+)(s|m|h|d|w|mo)$/i);
    if (!match) return null;
    const num = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    const map = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000, mo: 2592000000 };
    return num * map[unit];
};

const formatTime = ms => {
    if (!ms) return '∞ (forever)';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
};

const getUserName = (sock, jid) => {
    try {
        const contact = sock.store?.contacts?.get?.(jid);
        if (contact?.notify) return contact.notify;
        if (contact?.name) return contact.name;
        if (contact?.verifiedName) return contact.verifiedName;
    } catch {}
    return jid.split('@')[0];
};

module.exports = {
    name: 'muteallsticker',
    alias: ['stickerbanall', 'banallsticker', 'unmuteallsticker'],
    category: 'Group',
    desc: 'Delete every sticker from a user — a full sticker mute',
    reactions: { start: '🗯️', success: '🚫' },

    execute: async (sock, m, { args, prefix, reply, isGroup, isAdmin, sender, mentionedJid }) => {
        if (!isGroup) return reply('✘ _*This command works only in groups*_');

        const db = getMutedDb();
        const chatId = m.chat;
        if (!db[chatId]) db[chatId] = {};

        const textLower = (m.text || '').toLowerCase();
        const isUnmute = textLower.startsWith(prefix + 'unmuteallsticker');

        /* ================= TARGET DETECTION ================= */
        let targetJid = null;

        if (mentionedJid?.length) targetJid = mentionedJid[0];
        else if (m.quoted?.sender) targetJid = m.quoted.sender;
        else {
            const match = (m.text || '').match(/@(\d+)/);
            if (match) targetJid = match[1] + '@s.whatsapp.net';
        }
        if (!targetJid && /^\d+$/.test(args[0])) targetJid = args[0] + '@s.whatsapp.net';

        if (!targetJid) return reply(`✘ Specify user\nExample:\n${prefix}muteallsticker @user 30m reason`);

        /* ================= META ================= */
        const meta = await sock.groupMetadata(chatId);
        const targetParticipant = meta.participants.find(p => participantJids(p).includes(targetJid));
        const isTargetAdmin = targetParticipant?.admin === 'admin' || targetParticipant?.admin === 'superadmin';
        const targetName = getUserName(sock, targetJid);

        /* ================= UNMUTE ================= */
        if (isUnmute) {
            if (!db[chatId][targetJid]) return reply(`✘ ${targetName} is not sticker-muted`);
            delete db[chatId][targetJid];
            saveMutedDb(db);
            await sock.sendMessage(chatId, {
                text: ` 𓄄 @${targetJid.split('@')[0]} *sticker unmuted*`,
                mentions: [targetJid]
            }, { quoted: m });
            return;
        }

        /* ================= VALIDATION ================= */
        if (targetJid === sender) return reply('✘ _*Cannot sticker-mute yourself*_');
        if (targetJid === meta.owner) return reply('✘ _*Cannot sticker-mute group owner*_');
        if (isTargetAdmin && !isAdmin) return reply('✘ _*Only admins can sticker-mute admins*_');

        /* ================= TIME ================= */
        let timeMs = null;
        const timeArg = args.find(a => /^\d+(s|m|h|d|w|mo)$/i.test(a));
        if (timeArg) timeMs = parseTime(timeArg);
        // no time = forever, just like muteuser (@crysnovax—FIX06-08-26)

        /* ================= REASON ================= */
        const reason = args.filter(a =>
            !a.includes('@') && !a.match(/^\d+(s|m|h|d|w|mo)$/i)
        ).join(' ') || 'No reason';

        /* ================= SAVE ================= */
        const until = timeMs ? Date.now() + timeMs : null;

        db[chatId][targetJid] = {
            mutedBy: sender,
            reason,
            time: Date.now(),
            until,
            duration: timeMs || null
        };
        saveMutedDb(db);

        /* ================= AUTO UNMUTE ================= */
        if (timeMs) {
            setTimeout(async () => {
                const db = getMutedDb();
                if (db[chatId]?.[targetJid]) {
                    delete db[chatId][targetJid];
                    saveMutedDb(db);
                    await sock.sendMessage(chatId, {
                        text: `🔊 @${targetJid.split('@')[0]} *auto sticker-unmuted*`,
                        mentions: [targetJid]
                    }).catch(() => {});
                }
            }, timeMs);
        }

        /* ================= SUCCESS ================= */
        await sock.sendMessage(chatId, {
            text:
                `_*𓉤 ALL STICKERS MUTED*_\n\n` +
                `✦ Target: @${targetJid.split('@')[0]}\n` +
                `⚉ Reason: ${reason}\n` +
                `⏱️ Duration: ${formatTime(timeMs)}`,
            mentions: [targetJid]
        }, { quoted: m });
    }
};

/* ================= STICKER MESSAGE HANDLER ================= */

module.exports.handleMutedSticker = async (sock, m, isGroup) => {
    if (!isGroup) return false;

    const db = getMutedDb();
    const chatId = m.chat;
    const sender = m.sender;

    if (!db[chatId]?.[sender]) return false;

    const muteInfo = db[chatId][sender];

    if (muteInfo.until && Date.now() > muteInfo.until) {
        delete db[chatId][sender];
        saveMutedDb(db);
        return false;
    }

    const isSticker = m.mtype === 'stickerMessage' ||
                      Object.keys(m.message || {})[0] === 'stickerMessage';
    if (!isSticker) return false;

    try {
        await sock.sendMessage(chatId, { delete: m.key });
        return true;
    } catch (err) {
        console.error('[ALL STICKER MUTE DELETE ERROR]', err.message);
        return false;
    }
};

module.exports.isStickerMuted = (chatId, userId) => {
    const db = getMutedDb();
    return !!db[chatId]?.[userId];
};
