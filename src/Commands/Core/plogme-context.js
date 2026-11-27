'use strict';

// Passive context is intentionally process-local. It helps PLOGME understand
// the live group conversation without creating a second durable chat history
// or retaining raw WhatsApp/media envelopes.
const MAX_MESSAGES_PER_CHAT = 30;
const MAX_TEXT_CHARS = 1200;
const MAX_CHATS = 200;
const TTL_MS = 30 * 60 * 1000;
const chats = new Map();

function compact(value, max = MAX_TEXT_CHARS) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function chatBucket(chat) {
    const key = String(chat || '').trim();
    if (!key) return null;
    let bucket = chats.get(key);
    if (!bucket) {
        bucket = [];
        chats.set(key, bucket);
        while (chats.size > MAX_CHATS) chats.delete(chats.keys().next().value);
    }
    return bucket;
}

function prune(bucket, now = Date.now()) {
    const fresh = bucket.filter(item => now - item.ts <= TTL_MS);
    bucket.splice(0, bucket.length, ...fresh.slice(-MAX_MESSAGES_PER_CHAT));
    return bucket;
}

function record(message = {}) {
    const chat = String(message.chat || message.key?.remoteJid || '').trim();
    const text = compact(message.text || message.body);
    if (!chat || !text || text.includes('\u200b\u200c\ufeff')) return false;
    const id = String(message.key?.id || message.id || '').trim();
    const bucket = chatBucket(chat);
    prune(bucket);
    if (id && bucket.some(item => item.id === id)) return false;
    const quoted = message.quoted;
    bucket.push({
        id,
        ts: Date.now(),
        sender: compact(message.sender || message.key?.participant, 160),
        name: compact(message.pushName || message.notifyName, 80),
        type: compact(message.mtype || 'message', 40),
        text,
        quoted: quoted ? {
            id: compact(quoted.id || quoted.key?.id, 160),
            sender: compact(quoted.sender || quoted.key?.participant, 160),
            text: compact(quoted.text || quoted.caption || quoted.conversation, 600),
            type: compact(quoted.mtype || 'message', 40)
        } : null
    });
    prune(bucket);
    return true;
}

function getRecent(chat, limit = MAX_MESSAGES_PER_CHAT) {
    const bucket = chats.get(String(chat || '').trim());
    if (!bucket) return [];
    prune(bucket);
    return bucket.slice(-Math.max(1, Math.min(MAX_MESSAGES_PER_CHAT, Number(limit) || MAX_MESSAGES_PER_CHAT)));
}

function getReplyChain(chat, messageId, maxDepth = 4) {
    const recent = getRecent(chat, MAX_MESSAGES_PER_CHAT);
    const byId = new Map(recent.filter(item => item.id).map(item => [item.id, item]));
    const chain = [];
    let id = String(messageId || '').trim();
    for (let depth = 0; depth < maxDepth && id; depth += 1) {
        const item = byId.get(id);
        if (!item) break;
        chain.push(item);
        id = item.quoted?.id || '';
    }
    return chain;
}

function formatRecent(chat, limit = 24) {
    const recent = getRecent(chat, limit);
    if (!recent.length) return '';
    return recent.map((item, index) => {
        const who = item.name || item.sender || 'unknown participant';
        const reply = item.quoted?.text
            ? ` [replying to ${item.quoted.sender || 'message'}: ${item.quoted.text}]`
            : '';
        return `${index + 1}. ${who}: ${item.text}${reply}`;
    }).join('\n');
}

function clear(chat) {
    if (chat) chats.delete(String(chat));
    else chats.clear();
}

module.exports = {
    MAX_MESSAGES_PER_CHAT,
    record,
    getRecent,
    getReplyChain,
    formatRecent,
    clear
};
