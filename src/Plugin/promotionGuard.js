const fs = require('fs');
const path = require('path');
const { getList } = require('./accessListManager');
const {
    identityVariants,
    normalizeJid,
    resolveCommandTarget,
} = require('./identityUtils');
const { isAntiPermitted } = require('./antiPermit');

const CONFIG_FILE = path.join(process.cwd(), 'database', 'promotion_guard.json');
const DEFAULT_IMMUNE_JID = '2348077134210@s.whatsapp.net';
const correctionCache = new Map();
let config = {};

function loadConfig() {
    try {
        config = fs.existsSync(CONFIG_FILE)
            ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
            : {};
    } catch (error) {
        console.error('[PROMOTION GUARD LOAD]', error.message);
        config = {};
    }
    return config;
}

function saveConfig() {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function getGroupConfig(groupId) {
    const current = config[groupId] || {};
    return {
        antipromote: current.antipromote === true,
        antidemote: current.antidemote === true,
        immune: [...new Set([DEFAULT_IMMUNE_JID, ...(current.immune || [])].map(normalizeJid))],
    };
}

function updateGroupConfig(groupId, updates) {
    config[groupId] = { ...getGroupConfig(groupId), ...updates };
    config[groupId].immune = [...new Set([DEFAULT_IMMUNE_JID, ...(config[groupId].immune || [])].map(normalizeJid))];
    saveConfig();
    return getGroupConfig(groupId);
}

// Baileys emits participants either as JID strings or as parsed objects
// ({ phoneNumber, lid, jid, id }). Normalise both shapes to a JID string.
function extractJid(entry) {
    if (!entry) return '';
    if (typeof entry === 'string') return normalizeJid(entry);
    const candidate = entry.phoneNumber || entry.jid || entry.id || entry.lid || entry.pn || '';
    return normalizeJid(candidate);
}

async function variantsForMany(sock, jids) {
    const variants = new Set();
    for (const jid of jids.filter(Boolean)) {
        for (const variant of await identityVariants(sock, jid)) variants.add(normalizeJid(variant));
    }
    return variants;
}

async function isImmune(sock, groupId, jid) {
    const [candidate, immune] = await Promise.all([
        identityVariants(sock, jid),
        variantsForMany(sock, getGroupConfig(groupId).immune),
    ]);
    return [...candidate].some(value => immune.has(normalizeJid(value)));
}

async function isNaturallyTrusted(sock, metadata, jid) {
    const owner = process.env.OWNER_NUMBER || require('../../settings/config').owner || '';
    const trusted = [
        owner && `${String(owner).replace(/\D/g, '')}@s.whatsapp.net`,
        ...getList('SUDO_NUMBERS').map(number => `${number}@s.whatsapp.net`),
        ...getList('DUAL_NUMBERS').map(number => `${number}@s.whatsapp.net`),
        metadata?.owner,
        metadata?.ownerPn,
    ].filter(Boolean);
    const [candidate, trustedVariants] = await Promise.all([
        identityVariants(sock, jid),
        variantsForMany(sock, trusted),
    ]);
    return [...candidate].some(value => trustedVariants.has(normalizeJid(value)));
}

function correctionKey(groupId, action, jid) {
    return `${groupId}:${action}:${normalizeJid(jid)}`;
}

function markCorrection(groupId, action, jid) {
    const key = correctionKey(groupId, action, jid);
    correctionCache.set(key, Date.now() + 15000);
}

function consumeCorrection(groupId, action, jid) {
    const key = correctionKey(groupId, action, jid);
    const expires = correctionCache.get(key);
    correctionCache.delete(key);
    return Boolean(expires && expires > Date.now());
}

async function applyCorrection(sock, groupId, jid, action) {
    markCorrection(groupId, action, jid);
    try {
        await sock.groupParticipantsUpdate(groupId, [jid], action);
        return true;
    } catch (error) {
        correctionCache.delete(correctionKey(groupId, action, jid));
        console.error(`[PROMOTION GUARD ${action.toUpperCase()}]`, error.message);
        return false;
    }
}

async function handleParticipantUpdate(sock, event) {
    const groupId = event?.id;
    const action = event?.action;
    if (!groupId || !['promote', 'demote'].includes(action)) return;

    const settings = getGroupConfig(groupId);
    if ((action === 'promote' && !settings.antipromote) || (action === 'demote' && !settings.antidemote)) return;

    const participants = (event.participants || []).map(extractJid).filter(Boolean);
    if (!participants.length) return;

    // Skip only events that are entirely the bot's own corrections.
    const pending = participants.filter(jid => !consumeCorrection(groupId, action, jid));
    if (!pending.length) return;

    const metadata = await sock.groupMetadata(groupId).catch(() => null);

    const actor = extractJid(event.authorPn || event.author || event.actor || '');
    const botJids = await variantsForMany(sock, [sock.user?.id, sock.user?.lid].filter(Boolean));

    // The bot's own actions (including corrections) are never punished.
    if (actor && botJids.has(normalizeJid(actor))) return;

    let actorIsTrusted = false;
    if (actor) {
        actorIsTrusted = await isNaturallyTrusted(sock, metadata, actor)
            || await isImmune(sock, groupId, actor)
            || await isAntiPermitted(sock, groupId, [actor]);
        if (actorIsTrusted) return;
    }

    const corrected = [];

    for (const target of pending) {
        if (botJids.has(normalizeJid(target))) continue;
        if (await isNaturallyTrusted(sock, metadata, target)
            || await isImmune(sock, groupId, target)
            || await isAntiPermitted(sock, groupId, [target])) continue;

        if (action === 'promote') {
            if (await applyCorrection(sock, groupId, target, 'demote')) corrected.push(`demoted @${target.split('@')[0]}`);
        } else if (await applyCorrection(sock, groupId, target, 'promote')) {
            corrected.push(`restored @${target.split('@')[0]}`);
        }
    }

    if (corrected.length && actor) {
        if (await applyCorrection(sock, groupId, actor, 'demote')) corrected.push(`demoted actor @${actor.split('@')[0]}`);
    }

    if (corrected.length) {
        const mentions = [...new Set([actor, ...participants].filter(Boolean))];
        await sock.sendMessage(groupId, {
            text: `Promotion guard enforced: ${corrected.join(', ')}.`,
            mentions,
        }).catch(error => console.error('[PROMOTION GUARD NOTICE]', error.message));
    }
}

function setupPromotionGuard(sock) {
    if (!sock?.ev?.on || sock.__promotionGuardReady) return;
    sock.__promotionGuardReady = true;
    sock.ev.on('group-participants.update', event => {
        handleParticipantUpdate(sock, event).catch(error => console.error('[PROMOTION GUARD]', error?.stack || error));
    });
}

function createGuardCommand(mode) {
    const label = mode === 'antipromote' ? 'Anti-promote' : 'Anti-demote';
    return {
        name: mode,
        alias: mode === 'antipromote' ? ['apromote'] : ['ademote'],
        category: 'Admin',
        desc: `${label} group protection and immunity list`,
        groupOnly: true,
        adminOnly: true,
       // botAdmin: true,
        execute: async (sock, m, { args, reply }) => {
            const sub = args[0]?.toLowerCase();
            if (sub === 'on' || sub === 'off') {
                const state = sub === 'on';
                updateGroupConfig(m.chat, { [mode]: state });
                return reply(`${label} is now ${state ? 'ON' : 'OFF'}.`);
            }

            if (sub === 'immune' || sub === 'exempt') {
                const operation = args[1]?.toLowerCase() || 'list';
                const settings = getGroupConfig(m.chat);
                if (operation === 'list') {
                    const mentions = settings.immune;
                    const list = mentions.map((jid, index) => `${index + 1}. @${jid.split('@')[0]}${jid === DEFAULT_IMMUNE_JID ? ' (creator)' : ''}`).join('\n');
                    return sock.sendMessage(m.chat, { text: `Promotion guard immunity:\n${list}`, mentions }, { quoted: m });
                }

                if (!['add', 'del', 'remove'].includes(operation)) return reply(`Usage: .${mode} immune add|del|list <number|mention|reply>`);
                const target = await resolveCommandTarget(sock, m, args.slice(2).join(' '));
                if (!target) return reply('Reply to, mention, or provide the number of the user.');
                const normalized = normalizeJid(target);

                if (operation === 'add') {
                    if (await isImmune(sock, m.chat, normalized)) return reply('That JID is already immune.');
                    updateGroupConfig(m.chat, { immune: [...settings.immune, normalized] });
                    return sock.sendMessage(m.chat, { text: `@${normalized.split('@')[0]} is now immune to anti-promote and anti-demote only.`, mentions: [normalized] }, { quoted: m });
                }

                if (normalized === DEFAULT_IMMUNE_JID) return reply('The default creator immunity cannot be removed.');
                const remaining = [];
                const targetVariants = await identityVariants(sock, normalized);
                for (const jid of settings.immune) {
                    const jidVariants = await identityVariants(sock, jid);
                    const same = [...jidVariants].some(value => targetVariants.has(value));
                    if (!same) remaining.push(jid);
                }
                if (remaining.length === settings.immune.length) return reply('That JID is not in the immunity list.');
                updateGroupConfig(m.chat, { immune: remaining });
                return sock.sendMessage(m.chat, { text: `@${normalized.split('@')[0]} was removed from promotion guard immunity.`, mentions: [normalized] }, { quoted: m });
            }

            const settings = getGroupConfig(m.chat);
            return reply(`${label}: ${settings[mode] ? 'ON' : 'OFF'}\n.${mode} on|off\n.${mode} immune add|del|list <user>`);
        },
    };
}

loadConfig();

module.exports = {
    DEFAULT_IMMUNE_JID,
    consumeCorrection,
    createGuardCommand,
    getGroupConfig,
    handleParticipantUpdate,
    isImmune,
    isNaturallyTrusted,
    loadConfig,
    setupPromotionGuard,
    updateGroupConfig,
};
