/**
 * menu.js — CODY AI Menu Command
 * Fixed: Gets user name and number from message object
 */

const { getByCategory, getAll } = require('../../Plugin/crysCmd');
const { getVar } = require('../../Plugin/configManager');
const os = require('os');
const { formatBotDateTime } = require('../../Utils/timezone');

// Import font lab styles
const fontLab = require('../Core/\'.js');

const DIVIDER = '─────────────';
const READMORE = '\u200E'.repeat(625);
const DEFAULT_LIVE_PHOTO_IMAGE = 'https://cdn.crysnova.qzz.io/files/1792339436073-e78b7f21-c069-42ca-a834-0dcc0ce0e56a.jpeg';
const DEFAULT_LIVE_PHOTO_VIDEO = 'https://cdn.crysnova.qzz.io/files/1792194636345-a2540a87-30cf-414e-806a-fddb13079e19.mp4';
const MEDIA_MODES = new Set(['live', 'livephoto', 'motion', 'gif', 'image']);

const CATEGORY_ICONS = {
    'ai': 'ಠ_ಠ',
    'search': '❔',
    'admin': '🜲',
    'anime': '㋛',
    'audio': '𝄞',
    'bot': '⚉',
    'converter': '℘',
    'core': '𓀀',
    'documents': '𓂃✍︎',
    'downloader': '⎙',
    'economy': '𓃼',
    'fun': 'ಥ⁠‿⁠ಥ',
    'games': '◈',
    'group': '⃝⃘̉̉̉━⋆',
    'media': '( ͡❛ ₃ ͡❛)',
    'media-editor': '✐',
    'overlays': '彡',
    'owner': '𓋎⚇',
    'quiz': '◈',
    'reaction': '◈',
    'system': '◈',
    'tools': '⎔',
    'utils': '❂'
};

const DAY_ICONS = {
    'Monday': '☕︎',
    'Tuesday': '☻',
    'Wednesday': '✆',
    'Thursday': '☯︎',
    'Friday': '⏚',
    'Saturday': '♪⁠',
    'Sunday': '☼'
};

// Hardcoded bot name with fancy35 styling - NO SPACES between letters
const DEFAULT_BOT_NAME = '𝗖𝗢𝗗𝗬 𝗔𝗜';

function getCategoryIcon(cat) {
    return CATEGORY_ICONS[cat.toLowerCase()] || '♧';
}

function getDayIcon(day) {
    return DAY_ICONS[day] || '';
}

function formatUptime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

function getStorage() {
    try {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;
        const usedGB = (used / 1024 / 1024 / 1024).toFixed(1);
        const totalGB = (total / 1024 / 1024 / 1024).toFixed(1);
        const percent = Math.floor((used / total) * 100);
        return `${usedGB}/${totalGB}GB (${percent}%)`;
    } catch {
        return 'N/A';
    }
}

// Function to get user name from message
async function getUserName(sock, m) {
    try {
        if (m.pushName) return m.pushName;
        
        const sender = m.sender || m.key?.remoteJid;
        if (sender) {
            if (sock.store?.contacts?.get) {
                const contact = sock.store.contacts.get(sender);
                if (contact?.notify) return contact.notify;
                if (contact?.name) return contact.name;
            }
            if (global.contacts && global.contacts[sender]) {
                if (global.contacts[sender].notify) return global.contacts[sender].notify;
                if (global.contacts[sender].name) return global.contacts[sender].name;
            }
        }
        return 'User';
    } catch {
        return 'User';
    }
}

// Function to get user number from message — resolves LID → real phone number
// so a non-owner user sees THEIR number, never the session's LID.
// (@crysnovax—FIX08-07-26)
async function getUserNumber(sock, m) {
    try {
        const jid = m.sender || m.key?.remoteJid || m.from;
        if (!jid) return 'Unknown';

        try {
            const { resolvePhoneJid } = require('../../Plugin/identityUtils');
            const phone = await resolvePhoneJid(sock, [jid]);
            if (phone) {
                const num = phone.split('@')[0].replace(/\D/g, '');
                if (num && num.length >= 10) return num;
            }
        } catch {}

        let number = jid.split('@')[0];
        number = number.replace(/\D/g, '');
        if (number && number.length >= 10) return number;
        return 'Unknown';
    } catch {
        return 'Unknown';
    }
}

// Function to detect chat type
function getChatType(m) {
    const jid = m.chat || m.key?.remoteJid || '';
    if (jid.includes('@g.us')) return 'Group';
    if (jid.includes('@s.whatsapp.net')) return 'Private';
    return 'Unknown';
}

/**
 * Convert text to styled font using fancy35
 * fancy35 gives: 𝗖𝗢𝗗𝗬 𝗔𝗜 (bold serif)
 * IMPORTANT: NO spaces between characters - spaces break the font rendering
 */
function toStyledName(text) {
    if (!text || text.trim() === '') {
        return DEFAULT_BOT_NAME;
    }
    
    // Remove any markdown/formatting
    text = text.replace(/[*_~`]/g, '');
    
    // Always use fancy35 - DO NOT add spaces between characters
    if (fontLab.fancy35 && typeof fontLab.fancy35 === 'function') {
        return fontLab.fancy35(text);
    }
    
    // Fallback: just return the text
    return text;
}

module.exports = {
    name: 'menu',
    alias: ['help', 'list', 'menubit'],
    desc: 'Show CODY AI menu with all commands',
    category: 'Bot',
    reactions: { start: '💬', success: '✨' },
    execute: async (sock, m, { args, reply, prefix, config }) => {
        
        // Get user info directly from message
        const userName = await getUserName(sock, m);
        const userNum = await getUserNumber(sock, m);
        
        // Get bot name from config or use default — config is optional (e.g.
        // when invoked via .plogme run menu) so never crash on it
        // (@crysnovax—FIX08-07-26)
        const rawBotName = (config?.settings?.title) || getVar('BOT_NAME') || '';
        const botName = toStyledName(rawBotName);
        
        // uptime follows the preserved startTime so updates don't reset it (@crysnovax—FIX06-08-26)
        const startTime = global.crysStats?.startTime || Date.now() - process.uptime() * 1000;
        const uptimeMin = Math.floor((Date.now() - startTime) / 60000);
        const now = new Date();
        const time = formatBotDateTime(now, 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        const dayName = formatBotDateTime(now, 'en-US', { weekday: 'long' });
        const dayIcon = getDayIcon(dayName);
        const storage = getStorage();
        const chatType = getChatType(m);
        
        // Get categories and commands
        let categories = getByCategory() || {};

        // `.menu` defaults to the configured live photo. Explicit `gif` and
        // `image` modes preserve the previous menu media behavior; a category
        // can still be supplied as the second argument (for example, `.menu gif Media`).
        const requestedMode = String(args?.[0] || '').trim().toLowerCase();
        const mediaMode = MEDIA_MODES.has(requestedMode) ? requestedMode : 'livephoto';
        // .menu <category> — only show that category (@crysnovax—FIX12-08-26)
        const catFilter = args?.[0] && !MEDIA_MODES.has(requestedMode)
            ? String(args[0]).trim().toLowerCase()
            : (args?.[1] ? String(args[1]).trim().toLowerCase() : '');
        if (catFilter) {
            const matched = {};
            for (const [cat, cmds] of Object.entries(categories)) {
                const key = String(cat).toLowerCase();
                if (key === catFilter || key.includes(catFilter) || catFilter.includes(key)) matched[cat] = cmds;
            }
            if (!Object.keys(matched).length) {
                const available = Object.keys(categories).join('`, `');
                return reply(`_✘ Category *${args[0]}* not found._\n\n*Available categories:*\n\`${available}\`\n\n_Usage: ${prefix}menu <category>_`);
            }
            categories = matched;
        }
        
        // Count unique commands (without aliases)
        let totalCmds = 0;
        const allCommands = getAll();
        if (allCommands && typeof allCommands.forEach === 'function') {
            const uniqueNames = new Set();
            allCommands.forEach((cmd, key) => {
                const originalName = cmd.cmd || cmd.name || key;
                if (!cmd.aliasOf && !uniqueNames.has(originalName)) {
                    uniqueNames.add(originalName);
                    totalCmds++;
                }
            });
        } else if (allCommands && typeof allCommands.size === 'number') {
            totalCmds = allCommands.size;
        }
        
        // Build menu text with new styling
        let text = '';
        text += `‎ㅤ   ⚫︎  ${botName}  ⚫︎\n\n`;
        text += `˗ˏˋ ☏ ˎˊ˗  *Hello, ${userName}*  ✦\n`;
        text += `${DIVIDER}\n`;
        text += `⎔ Number  · ⇆ ${userNum}\n`;
        text += `⎔ Prefix  ·  ⇆ [ ${prefix} ]\n`;
        text += `⎔ Cmds    · ⇆ ${totalCmds} commands\n`;
        text += `⎔ Uptime  · ⇆ ${formatUptime(uptimeMin)}\n`;
        text += `⎔ Chat  .  ⇆ ${chatType}\n`;
        text += `⎔ Day  .  ⇆ ${dayName} ${dayIcon}\n`;
        text += `⎔ Time    · ⇆ ${time}\n`;
        text += `⎔ RAM     · ⇆ ${storage}\n`;
        text += `${DIVIDER}\n`;
        text += READMORE;
        
        // List commands by category with indented styling
        for (const [catName, cmds] of Object.entries(categories)) {
            if (!cmds || cmds.length === 0) continue;
            const icon = getCategoryIcon(catName);
            text += `\n⌬ ⤷ *${catName.toUpperCase()}* ${icon}\n`;
            const seen = new Set();
            for (const cmd of cmds) {
                const cmdName = cmd.cmd || cmd.name;
                if (!cmdName) continue;
                if (cmd.aliasOf) continue;
                if (seen.has(cmdName.toLowerCase())) continue;
                seen.add(cmdName.toLowerCase());
                text += `︎ ︎ ︎ ︎ ︎ ︎ ︎ ︎ ︎ ︎ ︎ ︎ ︎ ︎ ︎ ︎ ︎⊹ ${prefix}${cmdName}\n`;
            }
        }
        
        text += `\n‎ㅤ   ⚫︎  ${botName}  ⚫︎`;
        
        // Runtime overrides apply instantly; MENU_URL from .env must also drive
        // the default menu media instead of being bypassed by fixed URLs.
        const freshConfig = require('../../../settings/config');
        const configuredMediaUrl = getVar('MENU_URL') || process.env.MENU_URL || getVar('THUMB_URL') || process.env.THUMB_URL || freshConfig.thumbUrl || '';
        const isAnimatedMedia = url => /\.(mp4|gif|webm|mov)(?:[?#].*)?$/i.test(String(url || ''));
        const liveVideoUrl = isAnimatedMedia(configuredMediaUrl) ? configuredMediaUrl : DEFAULT_LIVE_PHOTO_VIDEO;
        const liveThumbnailUrl = configuredMediaUrl && !isAnimatedMedia(configuredMediaUrl) ? configuredMediaUrl : DEFAULT_LIVE_PHOTO_IMAGE;

        if (mediaMode === 'live' || mediaMode === 'livephoto' || mediaMode === 'motion') {
            return sock.sendPhotoLive(m.chat, {
                video: liveVideoUrl,
                thumbnail: liveThumbnailUrl,
                caption: text,
            }, m);
        }

        const thumbUrl = mediaMode === 'image'
            ? (isAnimatedMedia(configuredMediaUrl) ? DEFAULT_LIVE_PHOTO_IMAGE : (configuredMediaUrl || DEFAULT_LIVE_PHOTO_IMAGE))
            : (configuredMediaUrl || DEFAULT_LIVE_PHOTO_VIDEO);
        // Preserve the existing GIF/video-or-image behavior for explicit GIF mode.
        const isGif = isAnimatedMedia(thumbUrl);
        
        const messagePayload = {
            caption: text,
            contextInfo: {
                forwardingScore: 1,
                isForwarded: true,
                participant: '0@s.whatsapp.net',
                remoteJid: '0@s.whatsapp.net'
            }
        };
        
        if (isGif) {
            messagePayload.video = { url: thumbUrl };
            messagePayload.gifPlayback = true;
        } else {
            messagePayload.image = { url: thumbUrl };
        }
        
        await sock.sendMessage(m.chat, messagePayload);
    }
};
