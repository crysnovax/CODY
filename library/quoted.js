// Short-lived source-message cache plus per-chat history of confirmed revocations.
const deletedMessages = new Map();
const cachedMessages = new Map();
const MESSAGE_TTL = 48 * 60 * 60 * 1000;
const MAX_DELETED_PER_CHAT = 100;
const MAX_CACHED_MESSAGES = 5000;
const messageKey = (jid, id) => `${jid}:${id}`;

function cleanupExpired() {
    const now = Date.now();
    for (const [key, entry] of cachedMessages) {
        if (now - entry.timestamp > MESSAGE_TTL) cachedMessages.delete(key);
    }
    for (const [jid, history] of deletedMessages) {
        const current = history.filter(entry => now - entry.timestamp <= MESSAGE_TTL);
        if (current.length) deletedMessages.set(jid, current);
        else deletedMessages.delete(jid);
    }
}

// Cache original envelopes on messages.upsert, before the revoke event arrives.
function cacheMessage(message) {
    const jid = message?.key?.remoteJid;
    const id = message?.key?.id;
    if (!jid || !id || !message?.message) return;
    const key = messageKey(jid, id);
    cachedMessages.delete(key);
    cachedMessages.set(key, { message, timestamp: Date.now() });
    while (cachedMessages.size > MAX_CACHED_MESSAGES) {
        cachedMessages.delete(cachedMessages.keys().next().value);
    }
}

function isDeleteUpdate(update) {
    const details = update?.update;
    return details?.message === null || details?.messageStubType === 1;
}

function unwrapStoreMessage(value) {
    return value?.message?.key ? value.message : value;
}

function matchesDeleteKey(message, jid, id) {
    return message?.key?.remoteJid === jid && message?.key?.id === id && !!message?.message;
}

async function findDeletedMessage(update, customStore, jid, id) {
    const key = messageKey(jid, id);
    const cached = cachedMessages.get(key)?.message;
    if (matchesDeleteKey(cached, jid, id)) return cached;

    if (customStore?.loadMessage) {
        try {
            const loaded = unwrapStoreMessage(await customStore.loadMessage(jid, id));
            if (matchesDeleteKey(loaded, jid, id)) return loaded;
        } catch (err) {
            console.error('[QUOTED DELETE STORE]', err.message);
        }
    }
    if (customStore?.messages?.get) {
        try {
            const stored = unwrapStoreMessage(customStore.messages.get(key));
            if (matchesDeleteKey(stored, jid, id)) return stored;
        } catch (err) {
            console.error('[QUOTED DELETE STORE]', err.message);
        }
    }

    const direct = unwrapStoreMessage(update?.message || update?.update?.message);
    return matchesDeleteKey(direct, jid, id) ? direct : null;
}

async function onDelete(sock, updates, customStore) {
    cleanupExpired();
    for (const update of updates || []) {
        try {
            if (!isDeleteUpdate(update)) continue;
            const jid = update?.key?.remoteJid;
            const id = update?.key?.id;
            if (!jid || !id) continue;
            const message = await findDeletedMessage(update, customStore, jid, id);
            if (!message) continue;

            const history = deletedMessages.get(jid) || [];
            // Replayed revocation updates refresh recency without creating duplicates.
            deletedMessages.set(jid, [
                { message, timestamp: Date.now(), id },
                ...history.filter(entry => entry.id !== id)
            ].slice(0, MAX_DELETED_PER_CHAT));
            cachedMessages.delete(messageKey(jid, id));
        } catch (err) {
            console.error('[QUOTED DELETE]', err.message);
        }
    }
}

function getLastDeleted(jid, index = 1) {
    if (!Number.isInteger(index) || index < 1) return null;
    cleanupExpired();
    return deletedMessages.get(jid)?.[index - 1] || null;
}

module.exports = { cacheMessage, onDelete, getLastDeleted, cleanUp: cleanupExpired };
