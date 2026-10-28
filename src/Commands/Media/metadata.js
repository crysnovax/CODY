const STICKER_FIELDS = [
    'url',
    'directPath',
    'fileSha256',
    'fileEncSha256',
    'mediaKey',
    'mimetype',
    'height',
    'width',
    'fileLength',
    'mediaKeyTimestamp',
    'firstFrameLength',
    'firstFrameSidecar',
    'isAnimated',
    'stickerSentTs',
    'isAvatar',
    'isAiSticker',
    'isLottie',
    'premium',
    'emojis',
    'accessibilityLabel',
    'audioMessage'
];

const MESSAGE_WRAPPER_FIELDS = [
    'message',
    'ephemeralMessage',
    'viewOnceMessage',
    'viewOnceMessageV2',
    'viewOnceMessageV2Extension',
    'deviceSentMessage',
    'documentWithCaptionMessage',
    'botForwardedMessage',
    'editedMessage'
];

function toJsonValue(value, seen = new WeakSet()) {
    if (value === undefined || typeof value === 'function') return undefined;
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'bigint') return value.toString();
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
        return Buffer.from(value).toString('base64');
    }
    if (typeof value !== 'object') return String(value);

    // protobuf Long values should be printed as decimal strings, not as {low, high}.
    if (Number.isInteger(value.low) && Number.isInteger(value.high) && typeof value.toString === 'function') {
        return value.toString();
    }
    if (seen.has(value)) return undefined;
    seen.add(value);

    if (Array.isArray(value)) {
        return value.map(item => toJsonValue(item, seen)).filter(item => item !== undefined);
    }

    const result = {};
    for (const [key, item] of Object.entries(value)) {
        const cleaned = toJsonValue(item, seen);
        if (cleaned !== undefined) result[key] = cleaned;
    }
    return result;
}

function findStickerMessage(value, stickerHint = false, seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || Buffer.isBuffer(value) || value instanceof Uint8Array) {
        return null;
    }
    if (seen.has(value)) return null;
    seen.add(value);

    if (value.stickerMessage && typeof value.stickerMessage === 'object') {
        const nestedSticker = findStickerMessage(value.stickerMessage, true, seen);
        if (nestedSticker) return nestedSticker;
    }

    const hasStickerFields = [
        'fileSha256', 'fileEncSha256', 'mediaKey', 'firstFrameLength',
        'firstFrameSidecar', 'isAnimated', 'stickerSentTs'
    ].some(field => value[field] !== undefined && value[field] !== null);
    const hasMediaReference = (typeof value.url === 'string' && value.url.length > 0) ||
        (typeof value.directPath === 'string' && value.directPath.length > 0);

    if (hasStickerFields && (hasMediaReference || stickerHint)) return value;

    for (const field of MESSAGE_WRAPPER_FIELDS) {
        if (!value[field] || typeof value[field] !== 'object') continue;
        const nested = findStickerMessage(value[field], stickerHint, seen);
        if (nested) return nested;
    }
    return null;
}

function serializeSticker(sticker) {
    const result = {};
    for (const field of STICKER_FIELDS) {
        if (sticker[field] !== undefined && sticker[field] !== null) {
            result[field] = toJsonValue(sticker[field]);
        }
    }

    // mediaDomainInfo is the sticker-specific context field used by the captured relay payload.
    if (sticker.contextInfo?.mediaDomainInfo !== undefined) {
        result.contextInfo = {
            mediaDomainInfo: toJsonValue(sticker.contextInfo.mediaDomainInfo)
        };
    }

    // Keep explicit defaults so the snippet can be pasted for static, animated,
    // AI, avatar, and Lottie stickers without guessing the flags.
    if (result.isAnimated === undefined) result.isAnimated = false;
    if (result.isAvatar === undefined) result.isAvatar = false;
    if (result.isAiSticker === undefined) result.isAiSticker = false;
    if (result.isLottie === undefined) result.isLottie = false;
    if (result.premium === undefined) result.premium = 0;

    return result;
}

function serializeMessageKey(key) {
    if (!key || typeof key !== 'object' || typeof key.id !== 'string' || !key.id) return null;
    const result = {};
    for (const field of ['remoteJid', 'fromMe', 'id', 'participant']) {
        if (key[field] !== undefined && key[field] !== null) {
            result[field] = toJsonValue(key[field]);
        }
    }
    return result;
}

module.exports = {
    name: 'metadata',
    category: 'Media',
    desc: 'Reply to any sticker to get a ready-to-copy sticker annotation payload',
    reactions: { start: '🔎', success: '📋' },
    execute: async (_sock, m, { reply }) => {
        const quoted = m?.quoted;
        if (!quoted) {
            return reply('⚉ Reply to a sticker with /metadata');
        }

        const stickerHint = quoted.mtype === 'stickerMessage' || quoted.isSticker === true || /webp/i.test(quoted.mimetype || '');
        const sticker = [
            quoted.msg,
            quoted.message,
            quoted.fakeObj?.message,
            quoted.fakeObj?.message?.message,
            quoted
        ].map(candidate => findStickerMessage(candidate, stickerHint)).find(Boolean);

        if (!sticker) {
            return reply('⚉ The replied message is not a sticker. Reply to a static, animated, AI, avatar, or Lottie sticker with /metadata');
        }
        if (!(sticker.url || sticker.directPath)) {
            return reply('⚉ This sticker has no usable media URL or directPath in the received message.');
        }

        const parentMessageKey = serializeMessageKey(quoted.key || quoted.fakeObj?.key || quoted.message?.key);
        if (!parentMessageKey) {
            return reply('⚉ Could not read the replied sticker message key.');
        }

        const payload = {
            parentMessageKey,
            stickerMessage: serializeSticker(sticker),
            count: 1,
            intervalMs: 1000
        };
        const command = `await sock.sendStickerAnnotation(m.chat, ${JSON.stringify(payload, null, 2)});`;
        return reply(`Sticker annotation command (copy and run):\n\n\`\`\`js\n${command}\n\`\`\`\n\nBinary sticker fields are Base64-encoded. Set count (1–20) and intervalMs (0–60000) as needed.`);
    }
};
