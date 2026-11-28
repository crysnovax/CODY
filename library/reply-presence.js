'use strict';

const MAX_PRESENCE_DELAY_MS = 2000;
const MIN_PRESENCE_DELAY_MS = 350;

function isAudioMessage(content) {
    return Boolean(content && (
        content.audio ||
        content.ptt === true ||
        content.mimetype === 'audio/ogg; codecs=opus' ||
        String(content.mimetype || '').startsWith('audio/')
    ));
}

function isPresenceWorthyMessage(content) {
    if (!content || typeof content !== 'object') return false;
    return !content.react && !content.delete && !content.editedMessage;
}

function getPresenceDelayMs(content) {
    if (isAudioMessage(content)) return 900;

    const text = String(content?.text || content?.caption || '').trim();
    if (!text) return 550;

    // Longer responses get a little more composing time, capped at two seconds.
    return Math.min(
        MAX_PRESENCE_DELAY_MS,
        Math.max(MIN_PRESENCE_DELAY_MS, 300 + text.length * 12)
    );
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Show WhatsApp's composing indicator before a real outbound message.
 * Presence errors are deliberately ignored so an unavailable presence API
 * never prevents the actual message from being delivered.
 */
async function prepareReplyPresence(sock, chat, content) {
    if (!chat || !isPresenceWorthyMessage(content) || typeof sock?.sendPresenceUpdate !== 'function') {
        return false;
    }

    const state = isAudioMessage(content) ? 'recording' : 'composing';
    try {
        await sock.sendPresenceUpdate(state, chat);
    } catch {
        return false;
    }

    await wait(getPresenceDelayMs(content));
    return true;
}

async function clearReplyPresence(sock, chat, content) {
    if (!chat || !isPresenceWorthyMessage(content) || typeof sock?.sendPresenceUpdate !== 'function') {
        return false;
    }

    try {
        await sock.sendPresenceUpdate('paused', chat);
        return true;
    } catch {
        return false;
    }
}

module.exports = {
    MAX_PRESENCE_DELAY_MS,
    isAudioMessage,
    isPresenceWorthyMessage,
    getPresenceDelayMs,
    prepareReplyPresence,
    clearReplyPresence
};
