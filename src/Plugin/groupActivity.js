'use strict';

const fs = require('fs');
const path = require('path');
const { identityVariants, normalizeJid } = require('./identityUtils');

const MAX_SEEN_IDS_PER_GROUP = 1200;
let loadedPath = null;
let state = { groups: {} };

function statePath() {
    return path.join(process.cwd(), 'database', 'group-activity.json');
}

function readState() {
    const filename = statePath();
    if (filename === loadedPath) return state;
    loadedPath = filename;
    try {
        const parsed = JSON.parse(fs.readFileSync(filename, 'utf8'));
        state = parsed && typeof parsed === 'object' && parsed.groups
            ? parsed
            : { groups: {} };
    } catch {
        state = { groups: {} };
    }
    return state;
}

function saveState() {
    const filename = statePath();
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    const temporary = `${filename}.tmp-${process.pid}`;
    fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    fs.renameSync(temporary, filename);
}

function normalizeIdentity(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (/^\+?\d{7,15}$/.test(raw)) return `${raw.replace(/\D/g, '')}@s.whatsapp.net`;
    if (!raw.includes('@')) return null;
    const jid = normalizeJid(raw);
    if (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@c.us') || jid.endsWith('@lid')) return jid;
    return null;
}

function messageParticipantIds(m, rawMessage) {
    const key = rawMessage?.key || m?.key || {};
    const ids = [
        key.participantAlt,
        m?.key?.participantAlt,
        m?.sender,
        key.participant,
        m?.key?.participant,
    ].map(normalizeIdentity).filter(Boolean);
    return [...new Set(ids)];
}

function trackGroupMessage(m, rawMessage = m) {
    const key = rawMessage?.key || m?.key || {};
    const chat = String(m?.chat || key.remoteJid || '');
    if (!chat.endsWith('@g.us') || key.fromMe || m?.key?.fromMe) return false;

    const message = rawMessage?.message || m?.message;
    if (!message || typeof message !== 'object') return false;
    if (message.protocolMessage || message.reactionMessage) return false;

    const ids = messageParticipantIds(m, rawMessage);
    if (!ids.length) return false;
    const messageId = String(key.id || m?.key?.id || '');
    const data = readState();
    const now = Date.now();
    const group = data.groups[chat] || (data.groups[chat] = {
        startedAt: now,
        updatedAt: now,
        members: {},
        seenMessageIds: [],
    });

    if (messageId && group.seenMessageIds.includes(messageId)) return false;

    const primary = ids.find(id => id.endsWith('@s.whatsapp.net') || id.endsWith('@c.us'))
        || ids.find(id => id.endsWith('@lid'))
        || ids[0];
    let record = Object.values(group.members).find(candidate =>
        [candidate.jid, ...(candidate.ids || [])].some(id => ids.includes(id))
    );
    if (!record) {
        record = { jid: primary, ids: ids.slice(), count: 0, lastAt: null };
        group.members[primary] = record;
    } else {
        record.ids = [...new Set([...(record.ids || []), ...ids])].slice(0, 6);
    }
    record.count = (Number(record.count) || 0) + 1;
    record.lastAt = now;
    group.updatedAt = now;
    if (messageId) {
        group.seenMessageIds.push(messageId);
        if (group.seenMessageIds.length > MAX_SEEN_IDS_PER_GROUP) {
            group.seenMessageIds = group.seenMessageIds.slice(-MAX_SEEN_IDS_PER_GROUP);
        }
    }
    saveState();
    return true;
}

function participantIds(participant) {
    return [...new Set([
        participant?.phoneNumber,
        participant?.id,
        participant?.jid,
        participant?.lid,
    ].map(normalizeIdentity).filter(Boolean))];
}

async function expandedIds(sock, ids) {
    const expanded = new Set(ids);
    for (const id of ids) {
        for (const variant of await identityVariants(sock, id)) {
            const normalized = normalizeIdentity(variant);
            if (normalized) expanded.add(normalized);
        }
    }
    return expanded;
}

function mentionJid(participant) {
    return participantIds(participant)[0] || '';
}

async function getParticipantCounts(sock, groupId, participants = []) {
    const group = readState().groups[groupId];
    const records = Object.values(group?.members || {});
    const indexed = await Promise.all(records.map(async record => ({
        record,
        ids: await expandedIds(sock, [...new Set([record.jid, ...(record.ids || [])].map(normalizeIdentity).filter(Boolean))]),
    })));

    return Promise.all(participants.map(async participant => {
        const ids = await expandedIds(sock, participantIds(participant));
        const matches = indexed.filter(entry => [...entry.ids].some(id => ids.has(id)));
        return {
            participant,
            jid: mentionJid(participant),
            count: matches.reduce((sum, entry) => sum + (Number(entry.record.count) || 0), 0),
            lastAt: matches.reduce((latest, entry) => Math.max(latest, Number(entry.record.lastAt) || 0), 0) || null,
        };
    }));
}

async function isBotParticipant(sock, participant) {
    const selfIds = [sock?.user?.id, sock?.user?.lid].map(normalizeIdentity).filter(Boolean);
    if (!selfIds.length) return false;
    const [self, member] = await Promise.all([
        expandedIds(sock, selfIds),
        expandedIds(sock, participantIds(participant)),
    ]);
    return [...member].some(id => self.has(id));
}

function getTrackingStartedAt(groupId) {
    return readState().groups[groupId]?.startedAt || null;
}

module.exports = {
    trackGroupMessage,
    getParticipantCounts,
    getTrackingStartedAt,
    isBotParticipant,
};
