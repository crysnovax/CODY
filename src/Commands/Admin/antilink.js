const fs = require('fs');
const path = require('path');
const { stripBotMarker, stripQuotedDeep } = require('../../Plugin/antiText');
const { isModerationEnabled } = require('../../Plugin/moderationControl');
const { isAntiPermitted } = require('../../Plugin/antiPermit');
const { isAdminwatchEnabled, shouldApplyAdminwatch } = require('../../Plugin/adminwatch');

const DB_PATH = path.join(process.cwd(), 'database', 'antilink.json');
const WARN_DB_PATH = path.join(process.cwd(), 'database', 'antilink_warns.json');

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

function ensureGroupConfig(db, group) {
    if (!db[group]) {
        db[group] = { enabled: false, action: 'delete', whitelist: [], permit: [], domains: [] };
    } else {
        if (!db[group].hasOwnProperty('whitelist')) db[group].whitelist = [];
        if (!db[group].hasOwnProperty('permit')) db[group].permit = [];
        if (!db[group].hasOwnProperty('domains')) db[group].domains = [];
        if (!db[group].hasOwnProperty('action')) db[group].action = 'delete';
        if (!db[group].hasOwnProperty('enabled')) db[group].enabled = false;
    }
    return db[group];
}

const MESSAGE_TEXT_FIELDS = new Set([
    'text', 'caption', 'matchedText', 'contentText', 'selectedDisplayText', 'title', 'canonicalUrl'
]);
const TEXT_MESSAGE_TYPES = new Set(['conversation', 'extendedTextMessage']);
const POLL_MESSAGE_TYPES = new Set([
    'pollCreationMessage', 'pollCreationMessageV2', 'pollCreationMessageV3',
    'pollCreationMessageV4', 'pollCreationMessageV5', 'pollResultSnapshotMessage'
]);
const PRODUCT_MESSAGE_TYPES = new Set(['productMessage']);
const STRUCTURED_LINK_MESSAGE_TYPES = new Set([...POLL_MESSAGE_TYPES, ...PRODUCT_MESSAGE_TYPES]);
const MEDIA_MESSAGE_TYPES = new Set([
    'imageMessage', 'videoMessage', 'instantImageMessage', 'ptvMessage', 'audioMessage',
    'documentMessage', 'documentWithCaptionMessage', 'stickerMessage', 'stickerPackMessage',
    'stickerSyncRmrMessage', 'lottieStickerMessage', 'audioStickerMessage', 'albumMessage',
    'eventCoverImage', 'pollCreationOptionImageMessage', 'statusStickerInteractionMessage'
]);
const IGNORED_MESSAGE_SUBTREES = new Set([
    'quotedMessage', 'quoted', 'contextInfo', 'messageContextInfo', 'productImage', 'catalogImage',
    'image', 'video', 'audio', 'document', 'sticker', 'thumbnail', 'externalAdReply'
]);
const MESSAGE_WRAPPER_TYPES = new Set([
    'raw', 'message', 'msg', 'ephemeralMessage', 'deviceSentMessage', 'viewOnceMessage',
    'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'editedMessage', 'protocolMessage'
]);
const MESSAGE_ROOT_TYPES = new Set([
    ...TEXT_MESSAGE_TYPES, ...STRUCTURED_LINK_MESSAGE_TYPES, ...MEDIA_MESSAGE_TYPES
]);

function shouldScanSerializedText(messageType) {
    return !messageType || TEXT_MESSAGE_TYPES.has(messageType) || STRUCTURED_LINK_MESSAGE_TYPES.has(messageType);
}

function getMessageText(value) {
    const texts = [];
    const seen = new WeakSet();
    const add = value => {
        const text = stripBotMarker(String(value || '')).trim();
        if (text) texts.push(text);
    };
    const walkText = node => {
        if (!node || typeof node !== 'object' || seen.has(node)) return;
        seen.add(node);
        for (const [key, child] of Object.entries(node)) {
            if (IGNORED_MESSAGE_SUBTREES.has(key) || MEDIA_MESSAGE_TYPES.has(key)) continue;
            if (typeof child === 'string' && MESSAGE_TEXT_FIELDS.has(key)) add(child);
            else if (child && typeof child === 'object' && key === 'text') walkText(child);
        }
    };
    const walkStructured = node => {
        if (!node || typeof node !== 'object' || seen.has(node)) return;
        seen.add(node);
        for (const [key, child] of Object.entries(node)) {
            if (IGNORED_MESSAGE_SUBTREES.has(key) || MEDIA_MESSAGE_TYPES.has(key)) continue;
            if (typeof child === 'string') {
                const text = stripBotMarker(child).trim();
                if (text && hasLink(text)) texts.push(text);
            } else if (child && typeof child === 'object') {
                walkStructured(child);
            }
        }
    };
    const walkRoot = node => {
        if (!node || typeof node !== 'object' || seen.has(node)) return;
        seen.add(node);
        for (const [key, child] of Object.entries(node)) {
            if (IGNORED_MESSAGE_SUBTREES.has(key)) continue;
            if (typeof child === 'string' && key === 'conversation') add(child);
            else if (TEXT_MESSAGE_TYPES.has(key) && child && typeof child === 'object') walkText(child);
            else if (STRUCTURED_LINK_MESSAGE_TYPES.has(key) && child && typeof child === 'object') walkStructured(child);
            else if (MESSAGE_WRAPPER_TYPES.has(key) && child && typeof child === 'object') walkRoot(child);
        }
    };
    walkRoot(value);
    return [...new Set(texts)];
}

function getRootMessageType(value, seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return null;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
        if (IGNORED_MESSAGE_SUBTREES.has(key)) continue;
        if (MESSAGE_ROOT_TYPES.has(key)) return key;
        if (MESSAGE_WRAPPER_TYPES.has(key) && child && typeof child === 'object') {
            const nested = getRootMessageType(child, seen);
            if (nested) return nested;
        }
    }
    return null;
}

function hasLink(text) {
    if (/(?:https?:\/\/|www\.|chat\.whatsapp\.com|wa\.me)/i.test(text)) return true;
    // Bare domains — require whitespace or line start before the domain so
    // words like "okay" (where "kay.com" looks like a domain) are not
    // flagged.  The character-class after the space includes common link-
    // delimiters such as < > and ( ) but excludes regular letters/digits.
    return /(?:^|(?<=\s))(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>]*)?/i.test(text);
}

function cleanUrl(value) {
    return String(value || '').trim()
        .replace(/^[^a-z0-9]+/i, '')
        .replace(/[),.!?]+$/g, '');
}
function extractUrls(text) {
    const matches = [];
    const withScheme = (text.match(/https?:\/\/[^\s<>]+/gi) || []).map(cleanUrl);
    for (const url of withScheme) if (url && !matches.includes(url)) matches.push(url);
    const bare = text.match(/(?:^|[^a-z0-9-])(?:(?:[a-z0-9-]+\.)+[a-z]{2,})(?:\/[^\s<>]*)?/gi) || [];
    for (const raw of bare) {
        const url = cleanUrl(raw);
        if (!url || /^https?:\/\//i.test(url)) continue;
        const alreadySchemed = matches.some(full => full.replace(/^https?:\/\//i, '') === url);
        if (!alreadySchemed && !matches.includes(url)) matches.push(url);
    }
    return matches;
}

function extractDomains(urls) {
    const domains = [];
    for (const url of urls) {
        try {
            const domain = url.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
            domains.push(domain);
        } catch (e) {}
    }
    return domains;
}

function isUrlAllowed(urls, whitelist) {
    if (!whitelist || !whitelist.length) return false;
    return urls.some(url => whitelist.some(allowed => url === allowed));
}

function isPermitted(urls, permitList) {
    if (!permitList || !permitList.length) return false;
    return urls.some(url => permitList.some(permitted =>
        url.toLowerCase().startsWith(permitted.toLowerCase())
    ));
}

function isDomainAllowed(urls, domainList) {
    if (!domainList || !domainList.length) return false;
    const domains = extractDomains(urls);
    return domains.some(domain => domainList.some(allowedDomain => 
        domain === allowedDomain.toLowerCase() || domain.endsWith('.' + allowedDomain.toLowerCase())
    ));
}

module.exports = {
    name: 'antilink',
    alias: ['al'],
    desc: 'Block links, with allow (exact URL), permit (URL prefix), domain whitelist, delete/warn/kick actions',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,
    reactions: { start: '🖇️', success: '🚫' },

    execute: async (sock, m, { args, reply }) => {
        if (!m.isGroup) return reply('`⚉ Group only`');

        const db = loadDB();
        const group = m.chat;
        const cfg = ensureGroupConfig(db, group);
        saveDB(db);

        const sub = args[0]?.toLowerCase();

        if (!sub || sub === 'status') {
            const whitelist = cfg.whitelist.length ? cfg.whitelist.map(u => `❏ ${u}`).join('\n') : '❏ none';
            const permit = cfg.permit.length ? cfg.permit.map(u => `❏ ${u}`).join('\n') : '❏ none';
            const domains = cfg.domains.length ? cfg.domains.map(d => `❏ ${d}`).join('\n') : '❏ none';

            let actionDisplay;
            if (cfg.action === 'delete') actionDisplay = ' ꙰⊕ DELETE';
            else if (cfg.action === 'warn') actionDisplay = '⚠︎ WARN (3x → KICK)';
            else if (cfg.action === 'kick') actionDisplay = 'ಠ_ಠ KICK';
            else if (cfg.action === 'tkick') actionDisplay = '⏱️ TEMP KICK (' + (cfg.tkickDuration || '5m') + ')';

            return reply(
                `🖇️ *AntiLink Settings*\n\n` +
                `• Status : ${cfg.enabled ? '✓ ON' : '✘ OFF'}\n` +
                `• Action : ${actionDisplay}\n\n` +
                `*Allowed (exact link)*:\n${whitelist}\n\n` +
                `*Permit (link starts with)*:\n${permit}\n\n` +
                `*Domains (whitelisted)*:\n${domains}\n\n` +
                `Commands:\n` +
                `• .antilink on / off\n` +
                `• .antilink delete / warn / kick / tkick 5m\n` +
                `• .antilink add <domain>\n` +
                `• .antilink remove <domain>\n` +
                `• .antilink allow <full_link>\n` +
                `• .antilink disallow <full_link>\n` +
                `• .antilink permit <url_prefix>\n` +
                `• .antilink unpermit <url_prefix>\n` +
                `• .antilink allowlist / permitlist / domainlist\n` +
                `• .antilink resetwarn @user\n` +
                `• .antilink clear`
            );
        }

        if (sub === 'on') {
            cfg.enabled = true;
            saveDB(db);
            let actionText;
            if (cfg.action === 'delete') actionText = ' ꙰⊕ DELETE';
            else if (cfg.action === 'warn') actionText = '⚠︎ WARN (3x → KICK)';
            else if (cfg.action === 'kick') actionText = 'ಠ_ಠ KICK';
            else if (cfg.action === 'tkick') actionText = '⏱️ TEMP KICK (' + (cfg.tkickDuration || '5m') + ')';
            return reply(`亗 *AntiLink Enabled*\nAction: ${actionText}`);
        }
        if (sub === 'off') {
            cfg.enabled = false;
            saveDB(db);
            return reply(`✘ AntiLink *Disabled*`);
        }
        if (sub === 'delete') {
            cfg.action = 'delete';
            saveDB(db);
            return reply(` ꙰⊕ Action → *DELETE* (message deleted)`);
        }
        if (sub === 'warn') {
            cfg.action = 'warn';
            saveDB(db);
            return reply(`⚠︎ Action → *WARN* (3 warns = auto kick)`);
        }
        if (sub === 'kick') {
            cfg.action = 'kick';
            saveDB(db);
            return reply(`ಠ_ಠ Action → *KICK* (immediate removal)`);
        }
        if (sub === 'tkick') {
            cfg.action = 'tkick';
            const durArg = args[1];
            cfg.tkickDuration = (durArg && /^\d+(s|m|h|d)$/i.test(durArg)) ? durArg : '5m';
            saveDB(db);
            return reply(`⏱️ Action → *TEMP KICK* (auto re-added after ${cfg.tkickDuration})`);
        }

        // ── NEW: ADD DOMAIN ──────────────────────────────────────────────
        if (sub === 'add') {
            const domain = args[1]?.trim().toLowerCase();
            if (!domain) return reply(`✐ Usage: .antilink add <domain>\nExample: .antilink add github.com`);
            
            // Remove http://, https://, www., and trailing slashes
            let cleanDomain = domain.replace(/^https?:\/\//i, '').replace(/^www\./, '').replace(/\/$/, '');
            
            if (cfg.domains.includes(cleanDomain)) return reply('`✘ Domain already whitelisted.`');
            cfg.domains.push(cleanDomain);
            saveDB(db);
            return reply(`✓ Domain whitelisted:\n❏ ${cleanDomain}\n\n_Any link containing this domain will be allowed._`);
        }

        // ── NEW: REMOVE DOMAIN ───────────────────────────────────────────
        if (sub === 'remove') {
            const domain = args[1]?.trim().toLowerCase();
            if (!domain) return reply('`✐ Usage: .antilink remove <domain>`');
            
            let cleanDomain = domain.replace(/^https?:\/\//i, '').replace(/^www\./, '').replace(/\/$/, '');
            const idx = cfg.domains.indexOf(cleanDomain);
            if (idx === -1) return reply('`✘ Domain not found in whitelist.`');
            cfg.domains.splice(idx, 1);
            saveDB(db);
            return reply(` ꙰ Removed domain from whitelist:\n❏ ${cleanDomain}`);
        }

        // ── NEW: CLEAR ALL SETTINGS ──────────────────────────────────────
        if (sub === 'clear') {
            cfg.enabled = false;
            cfg.action = 'delete';
            cfg.whitelist = [];
            cfg.permit = [];
            cfg.domains = [];
            saveDB(db);
            return reply(`۞ *AntiLink Settings Cleared*\n\n• Status: OFF\n• Action: DELETE\n• All whitelists, permits, and domains removed.`);
        }

        if (sub === 'allow') {
            const url = args[1]?.trim();
            if (!url || !url.startsWith('http')) return reply(`✐ Usage: .antilink allow <full_link>\nExample: .antilink allow https://youtube.com/watch?v=abc123`);
            if (cfg.whitelist.includes(url)) return reply('`✘ Link already allowed.`');
            cfg.whitelist.push(url);
            saveDB(db);
            return reply(`✓ Allowed link:\n❏ ${url}`);
        }
        if (sub === 'disallow') {
            const url = args[1]?.trim();
            if (!url) return reply('`✐ Usage: .antilink disallow <full_link>`');
            const idx = cfg.whitelist.indexOf(url);
            if (idx === -1) return reply('`✘ Link not found in allowlist.`');
            cfg.whitelist.splice(idx, 1);
            saveDB(db);
            return reply(` ꙰ Removed from allowlist:\n❏ ${url}`);
        }
        if (sub === 'permit') {
            const url = args[1]?.trim();
            if (!url || !url.startsWith('http')) return reply(`✐ Usage: .antilink permit <url_prefix>\nExample: .antilink permit https://whatsapp.com/channel`);
            if (cfg.permit.includes(url)) return reply('`✘ URL prefix already permitted.`');
            cfg.permit.push(url);
            saveDB(db);
            return reply(`✓ Permitted prefix:\n❏ ${url}`);
        }
        if (sub === 'unpermit') {
            const url = args.slice(1).join(' ')?.trim();
            if (!url) return reply('`✐ Usage: .antilink unpermit <url_prefix>`');
            const idx = cfg.permit.findIndex(p => p === url);
            if (idx === -1) return reply('`✘ Prefix not found in permit list.`');
            const removed = cfg.permit.splice(idx, 1);
            saveDB(db);
            return reply(` ꙰ Removed from permit:\n❏ ${removed[0]}`);
        }
        if (sub === 'allowlist') {
            if (!cfg.whitelist.length) return reply(`❏ No allowed links.`);
            let text = `✓ *Allowed links (exact match)*:\n`;
            text += cfg.whitelist.map(u => `❏ ${u}`).join('\n');
            return reply(text);
        }
        if (sub === 'permitlist') {
            if (!cfg.permit.length) return reply(`❏ No permitted prefixes.`);
            let text = `✓ *Permitted prefixes (starts with)*:\n`;
            text += cfg.permit.map(u => `❏ ${u}`).join('\n');
            return reply(text);
        }
        if (sub === 'domainlist') {
            if (!cfg.domains.length) return reply(`❏ No whitelisted domains.`);
            let text = `✓ *Whitelisted Domains*:\n`;
            text += cfg.domains.map(d => `❏ ${d}`).join('\n');
            return reply(text);
        }
        if (sub === 'resetwarn') {
            const mentioned = m.mentionedJid?.[0];
            if (!mentioned) return reply('`✐ Usage: .antilink resetwarn @user`');
            const warns = loadWarns();
            const key = `${group}_${mentioned}`;
            if (warns[key]) {
                delete warns[key];
                saveWarns(warns);
                return reply(`✓ Warnings reset for @${mentioned.split('@')[0]}`);
            }
            return reply('`✘ User has no warnings.`');
        }

        return reply(`𒆜 Usage:\nantilink on/off\n.antilink delete/warn/kick/tkick 5m\n.antilink add <domain>\n.antilink remove <domain>\n.antilink allow <full_link>\n.antilink disallow <full_link>\n.antilink permit <url_prefix>\n.antilink unpermit <url_prefix>\n.antilink allowlist/permitlist/domainlist\n.antilink resetwarn @user\n.antilink clear`);
    }
};

// ── Message Handler ──────────────────────────────────────────────
module.exports.getMessageText = getMessageText;
module.exports.hasLink = hasLink;
module.exports.extractUrls = extractUrls;
module.exports.shouldScanSerializedText = shouldScanSerializedText;
module.exports.handleAntiLink = async function(sock, m, mek) {
    try {
        if (!m.isGroup || !isModerationEnabled(m.chat)) return;
        if (m.key?.fromMe && !m.__editModeration) return;
        const adminwatchEnabled = isAdminwatchEnabled(m.chat, 'antilink');
        if (!await shouldApplyAdminwatch(sock, m, 'antilink')) return;

        const db = loadDB();
        const group = m.chat;
        if (!db[group]) return;

        const cfg = db[group];
        if (!cfg.enabled) return;

        // Keep ordinary text moderation, but only recurse through poll/product
        // structured payloads. Media, stickers, previews, events and other rich
        // payloads are deliberately excluded to prevent proto transport URLs
        // from being mistaken for links sent by the user.
        const rawMessage = mek?.__rawMessage || mek?.message || {};
        const messageType = [m.mtype, getRootMessageType(m.message), getRootMessageType(rawMessage)]
            .filter(Boolean)
            .find(type => MEDIA_MESSAGE_TYPES.has(type))
            || [m.mtype, getRootMessageType(m.message), getRootMessageType(rawMessage)]
                .filter(Boolean)
                .find(type => MESSAGE_ROOT_TYPES.has(type))
            || m.mtype
            || null;
        const canScanSerializedText = shouldScanSerializedText(messageType);
        const msg = stripQuotedDeep({
            ...(rawMessage || {}),
            ...(m.message || {}),
            ...(STRUCTURED_LINK_MESSAGE_TYPES.has(messageType) && m.msg
                ? { [messageType]: m.msg }
                : {})
        });

        const parts = [
            ...(canScanSerializedText ? [stripBotMarker(m.text), stripBotMarker(m.body)] : []),
            ...getMessageText(msg),
        ].filter(Boolean);
        const text = [...new Set(parts)].join(' ');

        if (!text) return;
        if (!hasLink(text)) return;

        const urls = extractUrls(text);

        // Check allowlist (exact URL match)
        if (cfg.whitelist && cfg.whitelist.length && isUrlAllowed(urls, cfg.whitelist)) return;

        // Check permit list (URL starts with prefix)
        if (cfg.permit && cfg.permit.length && isPermitted(urls, cfg.permit)) return;

        // ── NEW: Check domain whitelist ──
        if (cfg.domains && cfg.domains.length && isDomainAllowed(urls, cfg.domains)) return;

        const meta = await sock.groupMetadata(group).catch(() => null);
        if (!meta) return;

        const sender = m.sender;
        if (!sender) return;

        if (await isAntiPermitted(sock, group, [sender, m.key?.participant, m.key?.participantAlt])) return;
        const senderNorm = sender.replace(/:\d+@/, '@');
        const admins = meta.participants
            .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
            .map(p => p.id.replace(/:\d+@/, '@'));
        if (!adminwatchEnabled && !m.__editModeration && admins.includes(senderNorm)) return;

        const action = cfg.action || 'delete';
        let auditAction = action;

        // Revoke the original target message, not the encrypted edit
        // transport envelope. Keep a fallback for non-encrypted edits.
        const deleteKey = mek?.__deleteKey || m.__deleteKey || mek?.key || m.key;
        let deleted = false;
        try {
            await sock.sendMessage(group, { delete: deleteKey });
            deleted = true;
        } catch (error) {
            console.error('[ANTILINK DELETE ERROR]', error?.stack || error?.message || error);
        }

        if (action === 'delete') {
            await sock.sendMessage(group, {
                text: `ⓘ @${sender.split('@')[0]} *Link detected!*\nLinks are not allowed here. ${deleted ? 'Message deleted.' : 'I detected it, but WhatsApp rejected deletion.'} ಥ⁠‿⁠ಥ`,
                mentions: [sender]
            }, { quoted: mek || m }).catch(() => {});
        }
        else if (action === 'warn') {
            const warns = loadWarns();
            const warnKey = `${group}_${sender}`;

            if (!warns[warnKey]) {
                warns[warnKey] = { count: 0, user: sender };
            }
            warns[warnKey].count++;
            saveWarns(warns);

            const warnCount = warns[warnKey].count;

            if (warnCount >= 3) {
                auditAction = 'warn→kick';
                delete warns[warnKey];
                saveWarns(warns);

                await sock.sendMessage(group, {
                    text: `ಠ_ಠ @${sender.split('@')[0]} *KICKED*\n3/3 warnings - Sent a link.`,
                    mentions: [sender]
                }).catch(() => {});

                await sock.groupParticipantsUpdate(group, [sender], 'remove').catch(() => {});
            } else {
                await sock.sendMessage(group, {
                    text: `⚠︎ @${sender.split('@')[0]} *Warning ${warnCount}/3*\nLinks are not allowed. ${3 - warnCount} more = kick! ಥ⁠‿⁠ಥ`,
                    mentions: [sender]
                }).catch(() => {});
            }
        }
        else if (action === 'kick') {
            await sock.sendMessage(group, {
                text: `ಠ_ಠ @${sender.split('@')[0]} *KICKED* for sending a link.`,
                mentions: [sender]
            }, { quoted: mek || m }).catch(() => {});

            await sock.groupParticipantsUpdate(group, [sender], 'remove').catch(() => {});
        }
        else if (action === 'tkick') {
            // temp kick — auto re-added after the duration (@crysnovax—FIX06-08-26)
            const { tkick, parseTime } = require('../../Plugin/tkick');
            const durText = cfg.tkickDuration || '5m';
            const durMs = parseTime(durText) || 5 * 60 * 1000;

            await sock.sendMessage(group, {
                text: `⏱️ @${sender.split('@')[0]} *TEMP KICKED* for sending a link — auto re-added after ${durText}.`,
                mentions: [sender]
            }, { quoted: mek || m }).catch(() => {});

            await tkick(sock, group, sender, durMs, 'sent a link (antilink)');
        }

        try {
            require('../../Plugin/modLog').recordAction(group, {
                command: 'antilink', actor: sender, target: sender, action: auditAction,
            });
        } catch {}

    } catch (err) {
        console.error('[ANTILINK ERROR]', err.message);
    }
};
