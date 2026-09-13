const { createAntiMessageModeration } = require('../../Plugin/antiMessageModeration');
const { normalizeJid } = require('../../Plugin/identityUtils');

// Deep scan. handleModeration hands this detector a payload shaped like
// { raw, message, msg, serialized }, and WhatsApp nests the group-status
// envelope inside ephemeral / view-once / documentWithCaption wrappers.
// A fixed key list only followed those wrappers one level down from the
// message itself, so the payload never matched and this hook could not fire.
function isGroupStatusMessage(message, seen = new WeakSet()) {
    if (!message || typeof message !== 'object' || seen.has(message)) return false;
    seen.add(message);

    // The envelope WhatsApp wraps around a group story.
    if (message.groupStatusMessage || message.groupStatusMessageV2) return true;
    // Marker plogme adds with the `groupStatus: true` send flag.
    if (message.contextInfo?.isGroupStatus === true) return true;

    return Object.values(message).some(value => isGroupStatusMessage(value, seen));
}

function isUserJid(jid = '') {
    const normalized = normalizeJid(jid);
    return normalized.endsWith('@s.whatsapp.net') || normalized.endsWith('@lid');
}

function participantIdentities(participant = {}) {
    return [participant.phoneNumber, participant.id, participant.lid]
        .filter(isUserJid)
        .map(normalizeJid);
}

async function buildAuthorCandidates(sock, m, mek, context = {}) {
    const rawKey = mek?.key || m.key || {};
    const candidates = [
        context.senderJid,
        rawKey.participantAlt,
        m.key?.participantAlt,
        rawKey.participant,
        m.key?.participant,
        m.sender,
        ...(context.senderRecord ? participantIdentities(context.senderRecord) : []),
    ].filter(isUserJid).map(normalizeJid);

    const mapper = sock?.signalRepository?.lidMapping;
    for (const jid of [...candidates]) {
        try {
            if (jid.endsWith('@lid') && mapper?.getPNForLID) {
                const pn = await mapper.getPNForLID(jid);
                if (isUserJid(pn)) candidates.push(normalizeJid(pn));
            } else if (jid.endsWith('@s.whatsapp.net') && mapper?.getLIDForPN) {
                const lid = await mapper.getLIDForPN(jid);
                if (isUserJid(lid)) candidates.push(normalizeJid(lid));
            }
        } catch {}
    }

    return [...new Set(candidates)].sort((a, b) => {
        const aPhone = a.endsWith('@s.whatsapp.net') ? 0 : 1;
        const bPhone = b.endsWith('@s.whatsapp.net') ? 0 : 1;
        return aPhone - bPhone;
    });
}

function buildDeleteKeys(chat, messageId, authors, rawKey = {}) {
    const keys = authors.map(participant => ({
        remoteJid: chat,
        fromMe: false,
        id: messageId,
        participant,
    }));
    if (rawKey?.id) keys.push({ ...rawKey, remoteJid: chat, fromMe: false });

    const seen = new Set();
    return keys.filter(key => {
        const signature = `${key.remoteJid}|${key.id}|${key.participant || ''}|${key.participantAlt || ''}`;
        if (!key.id || seen.has(signature)) return false;
        seen.add(signature);
        return true;
    });
}

async function deleteGroupStatus(sock, m, mek, context = {}) {
    const rawKey = mek?.key || m.key || {};
    const authors = await buildAuthorCandidates(sock, m, mek, context);
    const keys = buildDeleteKeys(m.chat, rawKey.id || m.key?.id, authors, rawKey);
    // Prefer a resolved phone identity when available. The untouched raw key remains
    // in the candidate list as the final compatibility attempt.
    const failures = [];
    const hasDedicatedDelete = typeof sock.deleteGroupStatus === 'function';

    for (const key of keys) {
        try {
            if (hasDedicatedDelete) {
                await sock.deleteGroupStatus(m.chat, key);
            } else {
                await sock.sendMessage(m.chat, { delete: key });
            }
            return key;
        } catch (error) {
            failures.push({
                participantType: key.participant?.endsWith('@lid') ? 'lid' : 'phone',
                message: error?.message || String(error),
            });
        }
    }

    console.error('[ANTIGROUPSTATUS REVOKE ATTEMPTS]', failures);
    throw new Error(`WhatsApp rejected ${failures.length} group-status revoke attempt(s)`);
}

const plugin = createAntiMessageModeration({
    command: 'antigroupstatus',
    aliases: ['antigs', 'ags'],
    label: 'Anti Group Status',
    description: 'Moderate real group-status posts',
    databaseName: 'antigroupstatus.json',
    warningDatabaseName: 'antigroupstatus_warns.json',
    detector: isGroupStatusMessage,
    violationLabel: 'group-status posts',
    deleteMessage: deleteGroupStatus
});

plugin.handleAntiGroupStatus = plugin.handleModeration;
plugin.isGroupStatusMessage = isGroupStatusMessage;
plugin.buildAuthorCandidates = buildAuthorCandidates;
plugin.buildDeleteKeys = buildDeleteKeys;
plugin.deleteGroupStatus = deleteGroupStatus;

module.exports = plugin;

