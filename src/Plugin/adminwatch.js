'use strict';

const fs = require('fs');
const path = require('path');
const { identityVariants, isPhoneJid, normalizeJid, participantJids, resolvePhoneJid } = require('./identityUtils');
const { DEFAULT_IMMUNE_JID, isNaturallyTrusted } = require('./promotionGuard');

const SUPPORTED_ANTIS = [
    ['antibot', 'ab'],
    ['antigroupstatus', 'antigs', 'ags'],
    ['antiforward', 'antifw', 'afw'],
    ['antivv', 'antiviewonce', 'antivo'],
    ['antiimage', 'antiimg', 'noimage'],
    ['antivideo', 'antivd', 'novideo'],
    ['antiaudio', 'antiaud', 'noaudio'],
    ['antilocation', 'noloc', 'antimap'],
    ['anticontact', 'nocontact', 'anticard'],
    ['antivoice', 'novoice', 'antivn'],
    ['antidoc', 'nodoc', 'antidocument'],
    ['antipoll', 'nopoll'],
    ['antievent', 'noevent'],
    ['antinewcomer', 'newcomerlinks', 'antilinknew'],
    ['nosticker', 'antisticker', 'nostick'],
    ['antilink', 'al'],
    ['antigm', 'antigroupmention', 'antigroupmsg', 'antieveryone'],
    ['antitag', 'antimention', 'antitagall'],
    ['antispam', 'spam'],
    ['antiword', 'banword', 'wordban'],
    ['antibug', 'anti-bug', 'bugguard', 'abug'],
];
const ALIASES = new Map(SUPPORTED_ANTIS.flatMap(([name, ...aliases]) =>
    [name, ...aliases].map(alias => [alias.toLowerCase(), name])
));
const SUPPORTED_NAMES = SUPPORTED_ANTIS.map(([name]) => name);
const targetCache = new WeakMap();

function databasePath() {
    return process.env.CODY_ADMINWATCH_DB || path.join(process.cwd(), 'database', 'adminwatch.json');
}

function readDatabase() {
    try {
        const file = databasePath();
        return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    } catch {
        return {};
    }
}

function writeDatabase(data) {
    const file = databasePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function normalizeAntiName(name) {
    return ALIASES.get(String(name || '').trim().toLowerCase()) || null;
}

function getGroupConfig(group, database = readDatabase()) {
    const raw = database?.[group];
    const overrides = {};
    if (raw?.overrides && typeof raw.overrides === 'object' && !Array.isArray(raw.overrides)) {
        for (const [name, value] of Object.entries(raw.overrides)) {
            const canonical = normalizeAntiName(name);
            if (canonical && typeof value === 'boolean') overrides[canonical] = value;
        }
    }
    return {
        enabled: raw?.enabled === true,
        overrides,
    };
}

function isAdminwatchEnabled(group, antiName, database = readDatabase()) {
    if (!group) return false;
    const canonical = normalizeAntiName(antiName);
    if (!canonical) return false;
    const config = getGroupConfig(group, database);
    return Object.prototype.hasOwnProperty.call(config.overrides, canonical)
        ? config.overrides[canonical]
        : config.enabled;
}

function setAdminwatchAll(group, enabled) {
    const db = readDatabase();
    db[group] = { ...getGroupConfig(group, db), enabled: Boolean(enabled), overrides: {} };
    writeDatabase(db);
    return db[group];
}

function setAdminwatchAnti(group, antiName, enabled) {
    const canonical = normalizeAntiName(antiName);
    if (!canonical) return null;
    const db = readDatabase();
    const config = getGroupConfig(group, db);
    config.overrides[canonical] = Boolean(enabled);
    db[group] = config;
    writeDatabase(db);
    return db[group];
}

async function expandedIdentities(sock, values) {
    const expanded = new Set();
    for (const value of values.filter(Boolean)) {
        try {
            for (const variant of await identityVariants(sock, value)) {
                const normalized = normalizeJid(variant).toLowerCase();
                if (normalized) expanded.add(normalized);
            }
        } catch {
            // An unresolvable identity must not be treated as an eligible target.
        }
    }
    return expanded;
}

async function resolveAdminTarget(sock, m) {
    try {
        if (!sock || !m?.isGroup || !m.chat || typeof sock.groupMetadata !== 'function') return false;
        const candidates = [
            m.key?.participantAlt,
            m.key?.participant,
            m.sender,
            m.key?.remoteJidAlt,
        ].filter(value => typeof value === 'string' && value.includes('@'))
            .map(normalizeJid);
        if (!candidates.length) return false;

        const metadata = await sock.groupMetadata(m.chat).catch(() => null);
        if (!Array.isArray(metadata?.participants)) return false;
        const candidateIds = await expandedIdentities(sock, candidates);
        if (!candidateIds.size) return false;

        let senderRecord = null;
        let senderRecordIds = [];
        for (const participant of metadata.participants) {
            const ids = participantJids(participant);
            const expanded = await expandedIdentities(sock, ids);
            if ([...expanded].some(id => candidateIds.has(id))) {
                senderRecord = participant;
                senderRecordIds = ids;
                break;
            }
        }
        if (!senderRecord || !['admin', 'superadmin'].includes(senderRecord.admin)) return false;

        // If neither the message nor its matched metadata participant can be
        // resolved to a phone JID, fail closed instead of guessing role status.
        const resolvedPhone = await resolvePhoneJid(sock, [...candidates, ...senderRecordIds]);
        if (!resolvedPhone || !isPhoneJid(resolvedPhone)) return false;

        const allSenderIds = [...new Set([...candidates, ...senderRecordIds, resolvedPhone])];
        for (const id of allSenderIds) {
            if (await isNaturallyTrusted(sock, metadata, id)) return false;
        }

        const creatorIds = await expandedIdentities(sock, [DEFAULT_IMMUNE_JID]);
        const senderVariants = await expandedIdentities(sock, allSenderIds);
        if ([...senderVariants].some(id => creatorIds.has(id))) return false;
        return true;
    } catch {
        return false;
    }
}

function cachedAdminTarget(sock, m) {
    if (!m || typeof m !== 'object' || !sock || typeof sock !== 'object') return Promise.resolve(false);
    let perSocket = targetCache.get(m);
    if (!perSocket) {
        perSocket = new WeakMap();
        targetCache.set(m, perSocket);
    }
    if (!perSocket.has(sock)) perSocket.set(sock, resolveAdminTarget(sock, m));
    return perSocket.get(sock);
}

// When the setting is off, this is deliberately a no-op: existing anti
// behavior (including each anti's established admin exemption) remains intact.
async function shouldApplyAdminwatch(sock, m, antiName) {
    if (!m?.isGroup || !m.chat || !isAdminwatchEnabled(m.chat, antiName)) return true;
    return cachedAdminTarget(sock, m);
}

function statusLine(group, antiName) {
    const config = getGroupConfig(group);
    const overridden = Object.prototype.hasOwnProperty.call(config.overrides, antiName);
    const value = isAdminwatchEnabled(group, antiName);
    return `• ${antiName}: ${value ? 'ON' : 'OFF'}${overridden ? ' (override)' : ' (all)'}`;
}

const command = {
    name: 'adminwatch',
    alias: ['admin-watch'],
    desc: 'Apply message-based anti systems to eligible group admins only',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,
    reactions: { start: '🛡️', success: '✅' },
    execute: async (sock, m, { args = [], reply }) => {
        const first = String(args[0] || 'status').toLowerCase();
        if (first === 'on' || first === 'off') {
            if (args.length > 1) return reply('Usage: .adminwatch on | off | status');
            setAdminwatchAll(m.chat, first === 'on');
            return reply(`Adminwatch is now ${first.toUpperCase()} for all supported message-based anti systems in this group. Per-anti overrides were cleared.`);
        }

        if (first === 'status' && args.length <= 1) {
            const config = getGroupConfig(m.chat);
            const lines = SUPPORTED_NAMES.map(name => statusLine(m.chat, name)).join('\n');
            return reply(`*Adminwatch for this group* (all: ${config.enabled ? 'ON' : 'OFF'})\n${lines}\n\nUsage: .adminwatch on | off | status\nPer anti: .adminwatch <anti-command> on | off | status`);
        }

        const canonical = normalizeAntiName(first);
        if (!canonical) {
            return reply(`Unknown or unsupported anti command. Supported: ${SUPPORTED_NAMES.join(', ')}\nUsage: .adminwatch on | off | status | <anti-command> on | off | status`);
        }
        const action = String(args[1] || 'status').toLowerCase();
        if (args.length > 2 || !['on', 'off', 'status'].includes(action)) {
            return reply(`Usage: .adminwatch ${canonical} on | off | status`);
        }
        if (action === 'status') {
            const config = getGroupConfig(m.chat);
            const overridden = Object.prototype.hasOwnProperty.call(config.overrides, canonical);
            return reply(`Adminwatch for ${canonical}: *${isAdminwatchEnabled(m.chat, canonical) ? 'ON' : 'OFF'}* (${overridden ? 'per-anti override' : `inherits all=${config.enabled ? 'ON' : 'OFF'}`}).`);
        }
        setAdminwatchAnti(m.chat, canonical, action === 'on');
        return reply(`Adminwatch for ${canonical} is now ${action.toUpperCase()} in this group.`);
    },
};

module.exports = {
    ALIASES,
    DEFAULT_IMMUNE_JID,
    SUPPORTED_ANTIS,
    SUPPORTED_NAMES,
    command,
    getGroupConfig,
    isAdminwatchEnabled,
    normalizeAntiName,
    readDatabase,
    resolveAdminTarget,
    setAdminwatchAll,
    setAdminwatchAnti,
    shouldApplyAdminwatch,
    writeDatabase,
};
