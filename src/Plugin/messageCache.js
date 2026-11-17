'use strict';

const MEDIA_FIELDS = new Set([
    'url',
    'directPath',
    'mediaKey',
    'fileSha256',
    'fileEncSha256',
    'fileLength',
    'mimetype',
    'mediaKeyTimestamp',
    'scansSidecar',
    'midQualityFileSha256',
]);

function unwrapStoredMessage(record) {
    let current = record;
    const seen = new Set();
    while (current && typeof current === 'object' && !current.key && current.message && !seen.has(current)) {
        seen.add(current);
        current = current.message;
    }
    return current;
}

function mediaPayloadScore(value, seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return 0;
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) return 0;
    seen.add(value);

    let score = 0;
    for (const [key, child] of Object.entries(value)) {
        if (MEDIA_FIELDS.has(key) && child !== undefined && child !== null) {
            const size = child?.byteLength || child?.length || 0;
            score += key === 'mediaKey' || key.endsWith('Sha256') ? (size ? 4 : 1) : 1;
        }
        score += mediaPayloadScore(child, seen);
    }
    return score;
}

function storeBestMessage(store, message, timestamp = Date.now()) {
    const remoteJid = message?.key?.remoteJid;
    const id = message?.key?.id;
    if (!remoteJid || !id || typeof store?.messages?.set !== 'function') {
        return false;
    }

    const key = `${remoteJid}:${id}`;
    const existing = typeof store.messages.get === 'function' ? store.messages.get(key) : null;
    const previousMessage = unwrapStoredMessage(existing);
    if (previousMessage?.key && mediaPayloadScore(previousMessage) > mediaPayloadScore(message)) {
        return false;
    }

    store.messages.set(key, { message, timestamp });
    return true;
}

module.exports = { mediaPayloadScore, storeBestMessage, unwrapStoredMessage };
