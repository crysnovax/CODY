const crypto = require('node:crypto');
const { proto, jidNormalizedUser } = require('plogme');

const EDIT_TYPE = proto.Message.SecretEncryptedMessage.SecretEncType.MESSAGE_EDIT;
const EDIT_INFO = Buffer.from('Message Edit');
const ZERO_SALT = Buffer.alloc(32);
const GCM_TAG_LENGTH = 16;

function asBuffer(value) {
    if (!value) return null;
    if (Buffer.isBuffer(value)) return value;
    if (value instanceof Uint8Array) return Buffer.from(value);
    if (Array.isArray(value)) return Buffer.from(value);
    if (value.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data);
    return null;
}

function findSecret(value, seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return null;
    seen.add(value);
    if (value.messageSecret) return asBuffer(value.messageSecret);
    for (const key of ['messageContextInfo', 'contextInfo']) {
        const nested = value[key];
        if (nested?.messageSecret) return asBuffer(nested.messageSecret);
    }
    for (const child of Object.values(value)) {
        const found = findSecret(child, seen);
        if (found) return found;
    }
    return null;
}

function findSecretEncrypted(value, seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return null;
    seen.add(value);
    if (value.secretEncryptedMessage) return value.secretEncryptedMessage;
    for (const child of Object.values(value)) {
        const found = findSecretEncrypted(child, seen);
        if (found) return found;
    }
    return null;
}

function normalizeCandidate(value) {
    if (typeof value !== 'string' || !value) return null;
    try { return jidNormalizedUser(value); } catch { return value; }
}

function candidateJids(sock, message, targetKey) {
    const creds = sock?.authState?.creds || sock?.state?.creds || {};
    const values = [
        message?.key?.participant,
        message?.key?.participantAlt,
        message?.key?.remoteJid,
        message?.participant,
        message?.participantAlt,
        targetKey?.participant,
        targetKey?.participantAlt,
        targetKey?.remoteJid,
        sock?.user?.id,
        sock?.user?.lid,
        creds?.me?.id,
        creds?.me?.lid
    ];
    const result = [];
    for (const value of values) {
        const normalized = normalizeCandidate(value);
        if (normalized && !result.includes(normalized)) result.push(normalized);
    }
    return result;
}

async function loadOriginal(customStore, targetKey) {
    if (!targetKey?.remoteJid || !targetKey?.id) return null;
    if (typeof customStore?.loadMessage !== 'function') return null;
    const stored = await customStore.loadMessage(targetKey.remoteJid, targetKey.id);
    return stored?.message || stored || null;
}

function unwrapEditedMessage(decoded) {
    let value = decoded?.protocolMessage?.editedMessage || decoded?.editedMessage || decoded;
    while (value?.message) value = value.message;
    return value && typeof value === 'object' ? value : null;
}

/**
 * Decrypt and unwrap a modern WhatsApp message edit in-place.
 * Returns true only when a valid MESSAGE_EDIT payload was authenticated.
 */
async function decryptSecretEdit(message, customStore, sock) {
    const secretEnc = findSecretEncrypted(message?.message);
    if (!secretEnc) return false;
    if (Number(secretEnc.secretEncType) !== EDIT_TYPE) return false;

    const targetKey = secretEnc.targetMessageKey;
    const original = await loadOriginal(customStore, targetKey).catch(() => null);
    const secret = findSecret(original);
    const payload = asBuffer(secretEnc.encPayload);
    const iv = asBuffer(secretEnc.encIv);
    if (!secret || secret.length !== 32 || !payload || payload.length <= GCM_TAG_LENGTH || !iv || iv.length !== 12) return false;

    const ciphertext = payload.subarray(0, payload.length - GCM_TAG_LENGTH);
    const tag = payload.subarray(payload.length - GCM_TAG_LENGTH);
    const candidates = candidateJids(sock, message, targetKey);
    const targetId = String(targetKey?.id || '');
    if (!targetId || !candidates.length) return false;

    for (const originalSender of candidates) {
        for (const modifyingSender of candidates) {
            const info = Buffer.concat([
                Buffer.from(targetId),
                Buffer.from(originalSender),
                Buffer.from(modifyingSender),
                EDIT_INFO
            ]);
            try {
                const key = Buffer.from(crypto.hkdfSync('sha256', secret, ZERO_SALT, info, 32));
                const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
                decipher.setAuthTag(tag);
                const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
                const decoded = proto.Message.decode(plaintext);
                const editedMessage = unwrapEditedMessage(decoded);
                if (!editedMessage) continue;

                message.message = editedMessage;
                message.key = { ...message.key, ...targetKey };
                message.isEdit = true;
                return true;
            } catch {
                // Authentication failure for a candidate identity; try the next
                // bounded candidate pair without scanning group participants.
            }
        }
    }
    return false;
}

module.exports = {
    EDIT_TYPE,
    decryptSecretEdit,
    findSecret,
    findSecretEncrypted,
    unwrapEditedMessage
};
