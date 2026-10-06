'use strict';

const crypto = require('node:crypto');

const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000;
const pendingByPoll = new Map();
const pendingByGroup = new Map();
const wiredSockets = new WeakSet();
let decryptPollVotePromise;

function normalizeJid(value) {
    return String(value || '').replace(/:\d+@/, '@').trim().toLowerCase();
}

function asBytes(value) {
    if (Buffer.isBuffer(value)) return Buffer.from(value);
    if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
    if (value instanceof ArrayBuffer) return Buffer.from(value);
    if (Array.isArray(value)) return Buffer.from(value);
    if (value && value.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data);
    if (value && Array.isArray(value.data)) return Buffer.from(value.data);
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (/^[0-9a-f]{64}$/i.test(text)) return Buffer.from(text, 'hex');
    if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(text)) return null;
    return Buffer.from(text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '='), 'base64');
}

function optionHash(option) {
    return crypto.createHash('sha256').update(Buffer.from(String(option))).digest();
}

function unwrap(message) {
    let content = message?.message || message || {};
    for (let i = 0; i < 6; i++) {
        const next = content.ephemeralMessage?.message
            || content.viewOnceMessage?.message
            || content.viewOnceMessageV2?.message
            || content.documentWithCaptionMessage?.message;
        if (!next) break;
        content = next;
    }
    return content;
}

function pollVoteFromMessage(message) {
    return unwrap(message)?.pollUpdateMessage || null;
}

function selectedHashes(vote) {
    const content = vote?.pollVoteMessage || vote?.vote || vote || {};
    const selected = content.selectedOptions;
    const values = Array.isArray(selected) ? selected : selected == null ? [] : [selected];
    return values.map(asBytes).filter(value => value?.length === 32);
}

function voterJids(key, sock) {
    const candidates = [
        key?.participantAlt,
        key?.remoteJidAlt,
        key?.participant,
        key?.remoteJid,
    ].map(normalizeJid).filter(Boolean);
    return [...new Set(candidates)];
}

function adminRecords(metadata, sock) {
    const botAliases = new Set([sock?.user?.id, sock?.user?.lid, sock?.user?.jid]
        .map(normalizeJid).filter(Boolean));
    return (metadata?.participants || [])
        .filter(p => p?.admin === 'admin' || p?.admin === 'superadmin')
        .map(p => ({
            participant: p,
            aliases: new Set([
                p.id, p.jid, p.lid,
                p.phoneNumber && `${String(p.phoneNumber).replace(/\D/g, '')}@s.whatsapp.net`,
            ].map(normalizeJid).filter(Boolean)),
        }))
        .filter(admin => ![...admin.aliases].some(alias => botAliases.has(alias)));
}

function matchAdmin(candidates, admins) {
    for (const candidate of candidates) {
        for (const admin of admins) {
            if (admin.aliases.has(candidate)) return admin;
        }
    }
    return null;
}

function matchAllowedVoter(candidates, allowedVoters) {
    const allowed = new Set(allowedVoters.map(normalizeJid).filter(Boolean));
    const matched = candidates.find(candidate => allowed.has(candidate));
    return matched || null;
}

function allowedVoterCandidates(key) {
    const participantCandidates = [key?.participantAlt, key?.participant]
        .map(normalizeJid).filter(Boolean);
    if (participantCandidates.length) return [...new Set(participantCandidates)];
    return [...new Set([key?.remoteJidAlt, key?.remoteJid].map(normalizeJid).filter(Boolean))];
}

function resolvePollVoteId(message, update, entry) {
    const outerKey = message?.key || {};
    const voterKey = update?.pollUpdateMessageKey || outerKey;
    if (normalizeJid(outerKey.remoteJid) && normalizeJid(outerKey.remoteJid) !== entry.chatId) return null;
    if (normalizeJid(voterKey.remoteJid) && normalizeJid(voterKey.remoteJid) !== entry.chatId) return null;
    return voterKey;
}

async function getDecryptedHashes(vote, entry, voterKey, sock) {
    const direct = selectedHashes(vote);
    if (direct.length) return direct;

    const content = vote?.pollVoteMessage || vote?.vote || vote || {};
    const encPayload = asBytes(content.encPayload);
    const encIv = asBytes(content.encIv);
    if (!encPayload?.length || !encIv?.length || !entry.pollEncKey?.length) return [];

    try {
        decryptPollVotePromise ||= import('plogme/lib/Utils/process-message.js').then(mod => mod.decryptPollVote);
        const decryptPollVote = await decryptPollVotePromise;
        const voterCandidates = voterJids(voterKey, sock);
        const creatorCandidates = entry.pollCreatorJids;
        const successes = new Map();
        for (const pollCreatorJid of creatorCandidates) {
            for (const voterJid of voterCandidates) {
                try {
                    const decoded = decryptPollVote({ encPayload, encIv }, {
                        pollCreatorJid,
                        pollMsgId: entry.pollId,
                        pollEncKey: entry.pollEncKey,
                        voterJid,
                    });
                    const hashes = selectedHashes(decoded);
                    if (hashes.length) successes.set(hashes.map(hash => hash.toString('hex')).join(','), hashes);
                } catch {}
            }
        }
        return successes.size === 1 ? [...successes.values()][0] : [];
    } catch (error) {
        console.error('[POLL APPROVAL] Could not load/decrypt poll vote:', error.message);
        return [];
    }
}

function clearPending(entry) {
    clearTimeout(entry.timer);
    pendingByPoll.delete(entry.pollId);
    if (pendingByGroup.get(entry.chatId) === entry) pendingByGroup.delete(entry.chatId);
}

async function finish(entry, result, sock) {
    if (entry.finished) return;
    entry.finished = true;
    clearPending(entry);
    try {
        if (result === 'cancel') {
            await sock.sendMessage(entry.chatId, { text: `🛑 *${entry.actionLabel} cancelled by an authorized voter.* No changes were made.` });
            return;
        }
        await sock.sendMessage(entry.chatId, { text: `✅ Approval reached for *${entry.actionLabel}*. Continuing now.` });
        await entry.onApproved();
    } catch (error) {
        console.error('[POLL APPROVAL] Approved action failed:', error?.stack || error);
        await sock.sendMessage(entry.chatId, { text: `✘ Approval passed, but *${entry.actionLabel}* failed safely: ${error?.message || error}` }).catch(() => {});
    }
}

async function processVote(sock, message, update, vote) {
    const outerKey = message?.key || {};
    const pollId = update?.pollCreationMessageKey?.id || outerKey.id;
    const entry = pendingByPoll.get(pollId);
    if (!entry || entry.finished || Date.now() >= entry.expiresAt) return;

    const voterKey = resolvePollVoteId(message, update, entry);
    if (!voterKey) return;
    const candidates = voterJids(voterKey, sock);
    if (!candidates.length) return;

    let admins = [];
    let voterId;
    if (entry.allowedVoters?.length) {
        voterId = matchAllowedVoter(allowedVoterCandidates(voterKey), entry.allowedVoters);
        if (!voterId) return;
    } else {
        let metadata;
        try { metadata = await sock.groupMetadata(entry.chatId); } catch { return; }
        admins = adminRecords(metadata, sock);
        if (!admins.length) return;
        const voter = matchAdmin(candidates, admins);
        if (!voter) return;
        voterId = [...voter.aliases].sort()[0];
    }

    const hashes = await getDecryptedHashes(vote, entry, voterKey, sock);
    if (hashes.length !== 1) return;
    const selected = hashes[0];
    const continueHash = optionHash(entry.options[0]);
    const cancelHash = optionHash(entry.options[1]);
    let choice;
    if (selected.equals(continueHash)) choice = 'continue';
    else if (selected.equals(cancelHash)) choice = 'cancel';
    else return;

    entry.votes.set(voterId, choice);
    if (choice === 'cancel') return finish(entry, 'cancel', sock);

    // Strict majority of the current admins must vote Continue. A sole-admin
    // group therefore needs that admin's own vote; additional admins raise the
    // quorum. Recalculated on every update, so stale membership cannot lower it.
    const continueCount = entry.allowedVoters?.length
        ? [...entry.votes.entries()].filter(([id, value]) => value === 'continue'
            && entry.allowedVoters.some(allowed => normalizeJid(allowed) === id)).length
        : [...entry.votes.entries()].filter(([id, value]) => value === 'continue'
            && admins.some(admin => admin.aliases.has(id))).length;
    const quorum = entry.allowedVoters?.length ? 1 : Math.floor(admins.length / 2) + 1;
    if (continueCount >= quorum) await finish(entry, 'continue', sock);
}

async function processUpsert(sock, batch) {
    for (const message of batch?.messages || []) {
        const update = pollVoteFromMessage(message);
        const pollId = update?.pollCreationMessageKey?.id;
        if (pollId) await processVote(sock, { key: message.key }, update, update.vote);
    }
}

async function processUpdates(sock, updates) {
    for (const item of (Array.isArray(updates) ? updates : [updates])) {
        if (!item) continue;
        const outerKey = item.key || {};
        const pollUpdates = item.update?.pollUpdates || item.pollUpdates || [];
        for (const update of pollUpdates) {
            await processVote(sock, { key: outerKey }, update, update?.vote);
        }
    }
}

function setupPollApprovalListener(sock) {
    if (!sock?.ev?.on || wiredSockets.has(sock)) return;
    wiredSockets.add(sock);
    sock.ev.on('messages.upsert', batch => {
        processUpsert(sock, batch).catch(error => console.error('[POLL APPROVAL] upsert handler:', error.message));
    });
    sock.ev.on('messages.update', updates => {
        processUpdates(sock, updates).catch(error => console.error('[POLL APPROVAL] update handler:', error.message));
    });
}

async function requestPollApproval(sock, {
    chatId,
    title,
    actionLabel,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    allowedVoters = [],
    onApproved,
}) {
    if (!chatId) throw new Error('A chat is required for poll approval.');
    if (!String(chatId).endsWith('@g.us') && !allowedVoters.length) {
        throw new Error('Private-chat approval requires an explicit authorized voter.');
    }
    if (pendingByGroup.has(chatId)) throw new Error('There is already an approval poll pending in this chat.');
    if (typeof onApproved !== 'function') throw new Error('An approved-action handler is required.');
    setupPollApprovalListener(sock);

    const options = ['Continue', 'Cancel'];
    const requestedSecret = crypto.randomBytes(32);
    const sent = await sock.sendMessage(chatId, {
        poll: {
            name: String(title || `Approve: ${actionLabel}`).slice(0, 180),
            values: options,
            selectableCount: 1,
            hideVoter: false,
            canAddOption: false,
            messageSecret: requestedSecret,
        },
    });
    const pollId = sent?.key?.id;
    if (!pollId) throw new Error('WhatsApp did not return a poll message ID; no action was taken.');

    const returnedSecret = asBytes(sent?.message?.messageContextInfo?.messageSecret
        || sent?.message?.message?.messageContextInfo?.messageSecret);
    const pollEncKey = returnedSecret?.length === 32 ? returnedSecret : requestedSecret;
    const creatorJids = [...new Set([
        sock.user?.id,
        sock.user?.lid,
        sock.user?.jid,
        sent?.key?.participantAlt,
        sent?.key?.participant,
        sent?.key?.remoteJidAlt,
    ].map(normalizeJid).filter(Boolean))];

    const entry = {
        chatId: normalizeJid(chatId),
        pollId,
        pollKey: sent.key,
        pollEncKey,
        pollCreatorJids: creatorJids,
        options,
        actionLabel: String(actionLabel || 'group action'),
        onApproved,
        allowedVoters: [...new Set(allowedVoters.map(normalizeJid).filter(Boolean))],
        expiresAt: Date.now() + timeoutMs,
        votes: new Map(),
        finished: false,
        timer: null,
    };
    entry.timer = setTimeout(() => {
        if (!entry.finished) {
            entry.finished = true;
            clearPending(entry);
            sock.sendMessage(entry.chatId, { text: `⌛ Approval poll for *${entry.actionLabel}* expired. No changes were made.` }).catch(() => {});
        }
    }, timeoutMs);
    entry.timer.unref?.();
    pendingByPoll.set(pollId, entry);
    pendingByGroup.set(entry.chatId, entry);
    return { pollId, expiresAt: entry.expiresAt };
}

module.exports = {
    DEFAULT_TIMEOUT_MS,
    requestPollApproval,
    setupPollApprovalListener,
    // Export pure/controlled helpers for unit tests.
    _processUpdates: processUpdates,
    _pendingByPoll: pendingByPoll,
    _clearPending: clearPending,
    _optionHash: optionHash,
};
